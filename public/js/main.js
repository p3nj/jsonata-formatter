document.addEventListener('DOMContentLoaded', function() {
    // Default settings
    let settings = {
        indentSize: 2,
        maxLineLength: 80,
        bracesOnNewLine: false,
        theme: 'vs-dark',
        fontSize: 12
    };

    // Load settings from localStorage if available
    if (localStorage.getItem('jsonata-formatter-settings')) {
        try {
            const savedSettings = JSON.parse(localStorage.getItem('jsonata-formatter-settings'));
            settings = { ...settings, ...savedSettings }; // Merge with defaults
            console.log('Settings loaded from localStorage:', settings);
        } catch (e) {
            console.error('Error loading settings from localStorage:', e);
        }
    }

    // History management
    const MAX_HISTORY_ITEMS = 100;
    let editorHistory = [];

    // Load history from localStorage if available
    if (localStorage.getItem('jsonata-formatter-history')) {
        try {
            editorHistory = JSON.parse(localStorage.getItem('jsonata-formatter-history')) || [];
            console.log(`Loaded ${editorHistory.length} history items from localStorage`);
        } catch (e) {
            console.error('Error loading history from localStorage:', e);
            editorHistory = [];
        }
    }

    let inputEditor, outputEditor;
    
    // First, ensure JSONata is loaded
    loadJSONata()
        .then(() => {
            console.log('JSONata loaded successfully');
            // Test the JSONata functionality
            if (testJSONataLoading()) {
                console.log('JSONata test passed successfully');
                // Now load Monaco Editor
                loadMonacoEditor();
            } else {
                console.error('JSONata loaded but functionality test failed');
                showNotification('JSONata functionality test failed. Please refresh the page.', 'error');
            }
        })
        .catch(error => {
            console.error('Failed to load JSONata:', error);
            showNotification('Failed to load JSONata library. Please check your internet connection or try a different browser.', 'error');
        });

    function loadJSONata() {
        // If JSONata is already loaded, resolve immediately
        if (typeof window.jsonata === 'function') {
            console.log('JSONata is already loaded');
            return Promise.resolve();
        }
        
        // Otherwise load it dynamically
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/jsonata/jsonata.min.js';
            script.onload = () => {
                console.log('JSONata library loaded dynamically.');
                // Add a slight delay to ensure proper initialization
                setTimeout(() => {
                    // Check all possible ways JSONata might be exposed
                    if (typeof window.jsonata === 'function') {
                        showNotification('JSONata library loaded successfully.', 'success');
                        resolve();
                    } else if (typeof jsonata === 'function') {
                        // If it's available globally but not on window
                        window.jsonata = jsonata;
                        showNotification('JSONata library loaded successfully.', 'success');
                        resolve();
                    } else if (typeof JSONata === 'function') {
                        // Some CDN versions might expose it as JSONata
                        window.jsonata = JSONata;
                        showNotification('JSONata library loaded successfully.', 'success');
                        resolve();
                    } else {
                        // As a last resort, try to extract it from the script content
                        try {
                            // Create a temporary script to evaluate and expose jsonata globally
                            const tempScript = document.createElement('script');
                            tempScript.textContent = `
                                if (typeof jsonata === 'function') {
                                    window.jsonata = jsonata;
                                } else if (typeof JSONata === 'function') {
                                    window.jsonata = JSONata;
                                }
                            `;
                            document.head.appendChild(tempScript);
                            
                            // Check again after the temp script runs
                            if (typeof window.jsonata === 'function') {
                                showNotification('JSONata library loaded successfully.', 'success');
                                resolve();
                            } else {
                                console.error('JSONata loaded but not properly defined');
                                reject(new Error('JSONata loaded but not properly defined'));
                            }
                        } catch (e) {
                            console.error('Error exposing JSONata globally', e);
                            reject(new Error('Failed to expose JSONata globally'));
                        }
                    }
                }, 100);
            };
            script.onerror = () => {
                reject(new Error('Failed to load JSONata library'));
            };
            document.head.appendChild(script);
            console.log('Loading JSONata library...');
        });
    }

    function testJSONataLoading() {
        try {
            // Simple test with JSONata
            const testExpression = '"Hello, " & "World"';
            const result = window.jsonata(testExpression).evaluate({});
            console.log('JSONata test result:', result);
            return true;
        } catch (error) {
            console.error('JSONata test failed:', error);
            return false;
        }
    }

    function loadMonacoEditor() {
        // Configure Monaco Editor loader
        require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor/min/vs' } });
        window.MonacoEnvironment = {
            getWorkerUrl: function() {
                return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
                    self.MonacoEnvironment = {
                        baseUrl: 'https://cdn.jsdelivr.net/npm/monaco-editor/min/'
                    };
                    importScripts('https://cdn.jsdelivr.net/npm/monaco-editor/min/vs/base/worker/workerMain.js');
                `)}`;
            }
        };

        // Load Monaco Editor
        require(['vs/editor/editor.main'], function() {
            // Check if Monaco editor is available
            if (typeof monaco === 'undefined' || !monaco.editor) {
                console.error('Monaco editor not loaded!');
                showNotification('Monaco editor not loaded. Please check your internet connection.', 'error');
                return;
            }
            
            console.log('Monaco editor loaded successfully');
            initializeEditors();
            setupEventHandlers();
        });
    }

    function initializeEditors() {
        // Create a custom language for JSONata
        monaco.languages.register({ id: 'jsonata' });
        monaco.languages.setMonarchTokensProvider('jsonata', {
            tokenizer: {
                root: [
                    // Comments
                    [/\/\/.*$/, 'comment'],
                    [/\/\*/, 'comment', '@comment'],
                    
                    // Strings
                    [/"([^"\\]|\\.)*$/, 'string.invalid'],
                    [/'([^'\\]|\\.)*$/, 'string.invalid'],
                    [/"/, 'string', '@string_double'],
                    [/'/, 'string', '@string_single'],
                    
                    // Numbers
                    [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
                    [/\d+/, 'number'],
                    
                    // Language keywords
                    [/\b(true|false|null)\b/, 'keyword'],
                    [/\b(function|lambda|if|then|else|in)\b/, 'keyword'],
                    
                    // Operators
                    [/[=><!~?:&|+\-*\/\^%]+/, 'operator'],
                    
                    // Variables
                    [/\$[a-zA-Z_][\w$]*/, 'variable'],
                    
                    // Identifiers
                    [/[a-zA-Z_][\w$]*/, 'identifier'],
                    
                    // Delimiters
                    [/[\[\](){};,.]/, 'delimiter']
                ],
                comment: [
                    [/[^\/*]+/, 'comment'],
                    [/\/\*/, 'comment', '@push'],
                    [/\*\//, 'comment', '@pop'],
                    [/[\/*]/, 'comment']
                ],
                string_double: [
                    [/[^\\"]+/, 'string'],
                    [/\\./, 'string.escape'],
                    [/"/, 'string', '@pop']
                ],
                string_single: [
                    [/[^\\']+/, 'string'],
                    [/\\./, 'string.escape'],
                    [/'/, 'string', '@pop']
                ]
            }
        });

        console.log('Creating input editor');
        // Configure the editors
        inputEditor = monaco.editor.create(document.getElementById('input-editor'), {
            value: '',
            language: 'jsonata',
            theme: settings.theme,
            automaticLayout: true, // Changed to true for better responsiveness
            scrollBeyondLastLine: false,
            fontSize: settings.fontSize,
            lineNumbers: 'on',
            folding: true,
            wordWrap: 'on',
            minimap: { enabled: true },
            suggest: {
                snippetsPreventQuickSuggestions: false
            }
        });

        console.log('Creating output editor');
        outputEditor = monaco.editor.create(document.getElementById('output-editor'), {
            value: '',
            language: 'jsonata',
            theme: settings.theme,
            automaticLayout: true, // Changed to true for better responsiveness
            scrollBeyondLastLine: false,
            fontSize: settings.fontSize,
            lineNumbers: 'on',
            folding: true,
            wordWrap: 'on',
            readOnly: true,
            minimap: { enabled: true }
        });

        // Load last input from localStorage if available
        const lastInput = localStorage.getItem('jsonata-formatter-last-input');
        if (lastInput) {
            inputEditor.setValue(lastInput);
        }

        // Save input content when it changes
        inputEditor.onDidChangeModelContent(function() {
            const currentValue = inputEditor.getValue();
            localStorage.setItem('jsonata-formatter-last-input', currentValue);
        });

        // Set up settings UI - Add error checking to prevent null reference errors
        if (document.getElementById('indent-size')) {
            document.getElementById('indent-size').value = settings.indentSize;
        }
        if (document.getElementById('max-line-length')) {
            document.getElementById('max-line-length').value = settings.maxLineLength;
        }
        if (document.getElementById('braces-new-line')) {
            document.getElementById('braces-new-line').checked = settings.bracesOnNewLine;
        }
        if (document.getElementById('theme-selector')) {
            document.getElementById('theme-selector').value = settings.theme;
        }
        if (document.getElementById('font-size')) {
            document.getElementById('font-size').value = settings.fontSize;
        }

        // Initialize validation panel in collapsed state
        document.body.classList.add('validation-collapsed');

        // Set up divider after a short delay to ensure editors are fully rendered
        setTimeout(() => {
            setupDividerDrag();
        }, 300);
    }

    function setupEventHandlers() {
        // Format button click handler
        document.getElementById('format-btn').addEventListener('click', formatButtonHandler);

        // Clear button click handler
        document.getElementById('clear-btn').addEventListener('click', function() {
            inputEditor.setValue('');
            outputEditor.setValue('');
            setValidationMessage('');
        });

        // Copy button click handler
        document.getElementById('copy-btn').addEventListener('click', function() {
            const formattedText = outputEditor.getValue();
            if (!formattedText.trim()) {
                showNotification('Nothing to copy', 'info');
                return;
            }
            
            navigator.clipboard.writeText(formattedText).then(
                function() {
                    showNotification('Copied to clipboard!', 'success');
                },
                function(err) {
                    console.error('Could not copy text: ', err);
                    showNotification('Failed to copy to clipboard', 'error');
                }
            );
        });

        // Example buttons click handlers
        document.querySelectorAll('.example-btn').forEach(function(button) {
            button.addEventListener('click', function() {
                const exampleKey = this.getAttribute('data-example');
                if (examples[exampleKey]) {
                    inputEditor.setValue(examples[exampleKey]);
                    // Automatically format the example
                    formatButtonHandler();
                }
            });
        });

        // Settings modal handlers
        const modal = document.getElementById('settings-modal');
        if (!modal) {
            console.error('Settings modal not found in the DOM');
            return;
        }
        
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', function() {
                console.log('Settings button clicked');
                modal.style.display = 'block';
            });
        } else {
            console.error('Settings button not found');
        }
        
        const closeBtn = document.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                console.log('Close button clicked');
                modal.style.display = 'none';
            });
        } else {
            console.error('Close button not found');
        }
        
        window.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
        
        document.getElementById('save-settings').addEventListener('click', function() {
            // Save settings
            settings.indentSize = parseInt(document.getElementById('indent-size').value);
            settings.maxLineLength = parseInt(document.getElementById('max-line-length').value);
            settings.bracesOnNewLine = document.getElementById('braces-new-line').checked;
            settings.theme = document.getElementById('theme-selector').value;
            settings.fontSize = parseInt(document.getElementById('font-size').value);
            
            // Apply theme change immediately
            monaco.editor.setTheme(settings.theme);
            
            // Apply font size change immediately
            inputEditor.updateOptions({ fontSize: settings.fontSize });
            outputEditor.updateOptions({ fontSize: settings.fontSize });
            
            // Store settings in localStorage
            localStorage.setItem('jsonata-formatter-settings', JSON.stringify(settings));
            
            // Close modal
            modal.style.display = 'none';
            
            // Show notification
            showNotification('Settings saved successfully', 'success');
            
            // Reformat if there's content
            if (inputEditor.getValue().trim()) {
                formatButtonHandler();
            }
        });

        // Toggle validation panel
        document.getElementById('toggle-validation').addEventListener('click', function() {
            document.body.classList.toggle('validation-collapsed');
            
            // Update icon
            const icon = this.querySelector('i');
            if (document.body.classList.contains('validation-collapsed')) {
                icon.className = 'fas fa-chevron-down';
            } else {
                icon.className = 'fas fa-chevron-up';
            }
        });

        // History modal handlers
        const historyModal = document.getElementById('history-modal');
        if (historyModal) {
            const historyBtn = document.getElementById('history-btn');
            if (historyBtn) {
                historyBtn.addEventListener('click', function() {
                    historyModal.style.display = 'block';
                    updateHistoryUI(); // Update history list when opening
                });
            }
            
            const closeHistoryBtn = historyModal.querySelector('.close');
            if (closeHistoryBtn) {
                closeHistoryBtn.addEventListener('click', function() {
                    historyModal.style.display = 'none';
                });
            }
            
            // Clear history button
            const clearHistoryBtn = document.getElementById('clear-history');
            if (clearHistoryBtn) {
                clearHistoryBtn.addEventListener('click', function() {
                    if (confirm('Are you sure you want to clear all history?')) {
                        editorHistory = [];
                        localStorage.setItem('jsonata-formatter-history', JSON.stringify(editorHistory));
                        updateHistoryUI();
                        showNotification('History cleared', 'info');
                    }
                });
            }
        }

        // Handle clicks outside of modals to close them
        window.addEventListener('click', function(event) {
            if (event.target === document.getElementById('settings-modal')) {
                document.getElementById('settings-modal').style.display = 'none';
            }
            if (event.target === document.getElementById('history-modal')) {
                document.getElementById('history-modal').style.display = 'none';
            }
        });
    }

    function setupDividerDrag() {
        const divider = document.getElementById('divider');
        const leftPanel = document.getElementById('input-column');
        const rightPanel = document.getElementById('output-column');
        
        if (!divider || !leftPanel || !rightPanel) {
            console.error('Divider setup failed: Missing required DOM elements');
            return;
        }
        
        console.log('Setting up divider drag functionality');
        
        let isDragging = false;
        
        // Mouse events
        divider.addEventListener('mousedown', function(e) {
            e.preventDefault();
            isDragging = true;
            document.body.classList.add('no-select');
            divider.classList.add('active');
            
            console.log('Divider drag started');
            
            // Capture initial positions
            const containerWidth = divider.parentElement.clientWidth;
            const initialX = e.clientX;
            const leftInitialWidth = leftPanel.offsetWidth;
            
            function handleMouseMove(e) {
                if (!isDragging) return;
                
                // Calculate new widths
                const deltaX = e.clientX - initialX;
                const newLeftWidth = leftInitialWidth + deltaX;
                const containerWidth = divider.parentElement.clientWidth;
                
                // Calculate percentages (min 10%, max 90%)
                let leftPercentage = Math.max(10, Math.min(90, (newLeftWidth / containerWidth) * 100));
                let rightPercentage = 100 - leftPercentage;
                
                // Apply new widths
                leftPanel.style.width = leftPercentage + '%';
                rightPanel.style.width = rightPercentage + '%';
                
                // Force editor relayout
                if (inputEditor && outputEditor) {
                    inputEditor.layout();
                    outputEditor.layout();
                }
            }
            
            function handleMouseUp() {
                if (!isDragging) return;
                
                console.log('Divider drag ended');
                isDragging = false;
                document.body.classList.remove('no-select');
                divider.classList.remove('active');
                
                // Save the current ratio in localStorage
                if (leftPanel && divider.parentElement) {
                    const ratio = leftPanel.offsetWidth / divider.parentElement.offsetWidth;
                    localStorage.setItem('editor-ratio', ratio.toString());
                }
                
                // Clean up event listeners
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                
                // Final update to editor layouts
                if (inputEditor && outputEditor) {
                    inputEditor.layout();
                    outputEditor.layout();
                }
            }
            
            // Add temporary event listeners
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });
        
        // Touch events for mobile
        divider.addEventListener('touchstart', function(e) {
            e.preventDefault();
            isDragging = true;
            document.body.classList.add('no-select');
            divider.classList.add('active');
            
            const containerWidth = divider.parentElement.clientWidth;
            const initialX = e.touches[0].clientX;
            const leftInitialWidth = leftPanel.offsetWidth;
            
            function handleTouchMove(e) {
                if (!isDragging) return;
                
                const deltaX = e.touches[0].clientX - initialX;
                const newLeftWidth = leftInitialWidth + deltaX;
                const containerWidth = divider.parentElement.clientWidth;
                
                let leftPercentage = Math.max(10, Math.min(90, (newLeftWidth / containerWidth) * 100));
                let rightPercentage = 100 - leftPercentage;
                
                leftPanel.style.width = leftPercentage + '%';
                rightPanel.style.width = rightPercentage + '%';
                
                if (inputEditor && outputEditor) {
                    inputEditor.layout();
                    outputEditor.layout();
                }
            }
            
            function handleTouchEnd() {
                if (!isDragging) return;
                
                isDragging = false;
                document.body.classList.remove('no-select');
                divider.classList.remove('active');
                
                if (leftPanel && divider.parentElement) {
                    const ratio = leftPanel.offsetWidth / divider.parentElement.offsetWidth;
                    localStorage.setItem('editor-ratio', ratio.toString());
                }
                
                document.removeEventListener('touchmove', handleTouchMove);
                document.removeEventListener('touchend', handleTouchEnd);
                
                if (inputEditor && outputEditor) {
                    inputEditor.layout();
                    outputEditor.layout();
                }
            }
            
            document.addEventListener('touchmove', handleTouchMove);
            document.addEventListener('touchend', handleTouchEnd);
        });
        
        // Restore previous ratio if exists
        if (localStorage.getItem('editor-ratio')) {
            try {
                const ratio = parseFloat(localStorage.getItem('editor-ratio'));
                if (!isNaN(ratio) && ratio > 0 && ratio < 1) {
                    leftPanel.style.width = (ratio * 100) + '%';
                    rightPanel.style.width = ((1 - ratio) * 100) + '%';
                    
                    // Update editor layout
                    setTimeout(() => {
                        if (inputEditor && outputEditor) {
                            inputEditor.layout();
                            outputEditor.layout();
                        }
                    }, 0);
                }
            } catch (e) {
                console.error('Error restoring editor ratio:', e);
            }
        }
        
        // Also relayout on window resize
        window.addEventListener('resize', function() {
            if (inputEditor && outputEditor) {
                inputEditor.layout();
                outputEditor.layout();
            }
        });
        
        console.log('Divider drag setup completed');
    }

    function formatButtonHandler() {
        try {
            const input = inputEditor.getValue();
            
            // Add to history before formatting
            addToHistory(input);
            
            // Function to proceed with formatting once JSONata is available
            const proceedWithFormatting = () => {
                try {
                    // Check again to make sure jsonata is available
                    if (typeof window.jsonata !== 'function') {
                        throw new Error('JSONata is not available as a function');
                    }
                    
                    // Validate the expression
                    window.jsonata(input);
                    setValidationMessage('Expression is valid');
                    
                    // Format the expression
                    const formattedCode = formatJSONata(input, {
                        indentSize: settings.indentSize,
                        maxLineLength: settings.maxLineLength,
                        bracesOnNewLine: settings.bracesOnNewLine
                    });
                    
                    outputEditor.setValue(formattedCode);
                } catch (validationErr) {
                    setValidationMessage(validationErr.message, 'error');
                    
                    // Still try to format even if validation fails
                    try {
                        const formattedCode = formatJSONata(input, {
                            indentSize: settings.indentSize,
                            maxLineLength: settings.maxLineLength,
                            bracesOnNewLine: settings.bracesOnNewLine
                        });
                        outputEditor.setValue(formattedCode);
                    } catch (formatErr) {
                        console.error("Error formatting invalid expression:", formatErr);
                    }
                }
            };
            
            // Check if JSONata is already loaded
            if (typeof window.jsonata === 'function') {
                console.log('Using existing JSONata function');
                proceedWithFormatting();
            } else {
                // Try to load JSONata first
                showNotification('Loading JSONata library...', 'info');
                loadJSONata()
                    .then(() => {
                        console.log('JSONata loaded, now formatting');
                        proceedWithFormatting();
                    })
                    .catch(error => {
                        console.error('Failed to load JSONata:', error);
                        showNotification('Failed to load JSONata library. Please check your internet connection.', 'error');
                    });
            }
        } catch (error) {
            console.error('Error during formatting:', error);
            showNotification('Error during formatting: ' + error.message, 'error');
        }
    }

    // Set validation message
    function setValidationMessage(message, type = 'info') {
        const validationContent = document.getElementById('validation-content');
        validationContent.innerHTML = message;
        validationContent.className = type;
        
        // Expand validation panel if there's an error
        if (type === 'error' && document.body.classList.contains('validation-collapsed')) {
            document.getElementById('toggle-validation').click();
        }
    }

    // JSONata formatter function
    function formatJSONata(expression, options) {
        // Formatting logic
        return formatExpression(expression, options);
    }

    // The actual formatting implementation
    function formatExpression(expression, options = {}) {
        // Default options
        const defaultOptions = {
            indentSize: 2,
            maxLineLength: 80,
            bracesOnNewLine: false
        };
        
        options = Object.assign({}, defaultOptions, options);
        
        try {
            // Basic formatting implementation
            let formatted = expression
                // Add newlines after semicolons
                .replace(/;/g, ';\n')
                // Add space around operators
                .replace(/([+\-*\/=<>!&|])/g, ' $1 ')
                // Fix extra spaces
                .replace(/\s+/g, ' ')
                // Handle blocks
                .replace(/{/g, options.bracesOnNewLine ? '\n{\n' : ' {\n')
                .replace(/}/g, '\n}')
                // Add space after commas
                .replace(/,([^\s])/g, ', $1')
                // Improve path expressions formatting
                .replace(/\./g, '.');
            
            // Handle indentation
            const lines = formatted.split('\n');
            let indent = 0;
            let result = [];
            
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i].trim();
                if (!line) continue;
                
                // Adjust indent for closing braces
                if (line.startsWith('}')) {
                    indent = Math.max(0, indent - 1);
                }
                
                // Add line with proper indentation
                const indentation = ' '.repeat(indent * options.indentSize);
                
                // Handle line length
                if (line.length + indentation.length > options.maxLineLength) {
                    // Try to break the line at logical points
                    line = breakLongLine(line, options.maxLineLength - indentation.length, indent * options.indentSize);
                }
                
                if (Array.isArray(line)) {
                    // If line was broken into multiple lines
                    for (let j = 0; j < line.length; j++) {
                        const subIndent = j > 0 ? indentation + ' '.repeat(options.indentSize) : indentation;
                        result.push(subIndent + line[j]);
                    }
                } else {
                    result.push(indentation + line);
                }
                
                // Adjust indent for opening braces
                if (typeof line === 'string' && line.includes('{')) {
                    indent++;
                }
            }
            
            return result.join('\n');
        } catch (err) {
            console.error("Error in formatter:", err);
            throw err;
        }
    }

    // Helper function to break long lines
    function breakLongLine(line, maxLength, baseIndent) {
        // Simple implementation - in a real formatter this would be more sophisticated
        if (line.length <= maxLength) return line;
        
        // Try to break at logical points like operators
        const breakPoints = [',', ';', ' && ', ' || ', ' + ', ' - ', ' * ', ' / '];
        
        for (const breakPoint of breakPoints) {
            if (line.includes(breakPoint)) {
                const parts = line.split(breakPoint);
                let result = [];
                let currentLine = parts[0] + breakPoint;
                
                for (let i = 1; i < parts.length; i++) {
                    if (currentLine.length + parts[i].length > maxLength) {
                        result.push(currentLine);
                        currentLine = parts[i];
                    } else {
                        currentLine += parts[i] + (i < parts.length - 1 ? breakPoint : '');
                    }
                }
                
                if (currentLine) {
                    result.push(currentLine);
                }
                
                return result;
            }
        }
        
        // If no logical break point found, just return the original line
        return line;
    }

    // Helper function for temporarily showing notifications
    function showNotification(message, type = 'info') {
        // Check if notification container exists
        let notificationContainer = document.querySelector('.notification-container');
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.className = 'notification-container';
            document.body.appendChild(notificationContainer);
        }

        // Create notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notificationContainer.appendChild(notification);

        // Remove notification after animation
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    function addToHistory(expression) {
        // Don't add empty expressions
        if (!expression.trim()) return;
        
        // Remove this expression if it already exists (to avoid duplicates)
        editorHistory = editorHistory.filter(item => item.expression !== expression);
        
        // Add to the beginning of the array
        editorHistory.unshift({
            expression: expression,
            timestamp: new Date().toISOString()
        });
        
        // Limit the history size
        if (editorHistory.length > MAX_HISTORY_ITEMS) {
            editorHistory.pop();
        }
        
        // Save to localStorage
        localStorage.setItem('jsonata-formatter-history', JSON.stringify(editorHistory));
        
        // Update history UI if needed
        updateHistoryUI();
    }

    function updateHistoryUI() {
        const historyContainer = document.getElementById('history-list');
        if (!historyContainer) return;
        
        // Clear current history items
        historyContainer.innerHTML = '';
        
        if (editorHistory.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'history-empty';
            emptyMessage.textContent = 'No history items yet';
            historyContainer.appendChild(emptyMessage);
            return;
        }
        
        // Add each history item
        editorHistory.forEach((item, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            
            // Create a preview of the expression (limited length)
            const preview = item.expression.length > 50 
                ? item.expression.substring(0, 47) + '...' 
                : item.expression;
            
            // Format the timestamp
            const date = new Date(item.timestamp);
            const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            
            historyItem.innerHTML = `
                <div class="history-preview">${preview}</div>
                <div class="history-meta">${formattedDate}</div>
                <div class="history-actions">
                    <button class="history-load" data-index="${index}" title="Load"><i class="fas fa-arrow-circle-right"></i></button>
                    <button class="history-delete" data-index="${index}" title="Remove"><i class="fas fa-times"></i></button>
                </div>
            `;
            
            historyContainer.appendChild(historyItem);
        });
        
        // Add event listeners for history actions
        document.querySelectorAll('.history-load').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                if (editorHistory[index]) {
                    inputEditor.setValue(editorHistory[index].expression);
                    // Optional: Close history panel if it's in a modal
                    if (document.getElementById('history-modal')) {
                        document.getElementById('history-modal').style.display = 'none';
                    }
                }
            });
        });
        
        document.querySelectorAll('.history-delete').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                if (editorHistory[index]) {
                    editorHistory.splice(index, 1);
                    localStorage.setItem('jsonata-formatter-history', JSON.stringify(editorHistory));
                    updateHistoryUI();
                }
            });
        });
    }
});