// Global variables for editor instances
let inputEditor, outputEditor;

// Initialize Monaco Editor when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Use proper AMD loading for Monaco
    require(['vs/editor/editor.main'], function() {
        initializeMonaco();
    });
});

function initializeMonaco() {
    try {
        console.log('Initializing Monaco editors...');
        
        // Create input editor
        inputEditor = monaco.editor.create(document.getElementById('input-editor'), {
            value: '',
            language: 'json',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
            automaticLayout: true
        });

        // Create output editor (read-only)
        outputEditor = monaco.editor.create(document.getElementById('output-editor'), {
            value: '',
            language: 'json',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
            readOnly: true,
            automaticLayout: true
        });

        // Auto-format on content change with debounce
        let timeout;
        inputEditor.onDidChangeModelContent(() => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                if (inputEditor.getValue().trim()) formatJSONata();
            }, 800);
        });

        // Apply initial dark mode if needed
        const isDarkMode = localStorage.getItem('darkMode') === 'enabled' || 
            (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches && 
            localStorage.getItem('darkMode') === null);
        if (isDarkMode) toggleDarkMode();

        console.log('Monaco editor initialized successfully');
    } catch (e) {
        console.error('Error initializing Monaco editor:', e);
    }
}

function jsonataFormatter(code) {
    code = String(code || '');
    let formatted = '';
    let indentLevel = 0;
    let indentSize = 2;
    let inString = false;
    let stringChar = null;
    let bracketStack = []; // Track all brackets for proper pairing
    let inMultiLineComment = false;
    
    // Helper functions
    const addNewlineIndent = () => formatted += '\n' + ' '.repeat(Math.max(0, indentLevel) * indentSize);
    const isWhitespace = char => /\s/.test(char);
    
    // Lists of JSONata elements
    const builtinFunctions = [
        '$abs', '$floor', '$ceil', '$round', '$power', '$sqrt', '$random', '$number', "$formatNumber", "$formatBase", "$formatInteger", "$parseInteger",
        '$string', '$length', '$substring', '$substringBefore', '$substringAfter', '$uppercase', '$lowercase', '$trim', '$pad', '$contains', '$split', '$join', '$match', '$replace', '$eval', '$base64encode', '$base64decode', '$encodeUrlComponent', '$encodeUrl', '$decodeUrlComponent', '$decodeUrl',
        '$boolean', '$not', '$exists',
        '$count', '$append', '$sort', '$reverse', '$shuffle', '$distinct', '$zip', '$each', '$filter', '$map', '$reduce', '$sift',
        '$keys', '$lookup', '$spread', '$merge', '$sift', '$each', '$error', '$assert', '$type',
        '$now', '$millis', '$fromMillis', '$toMillis',
        '$lambda', '$map', '$filter', '$single', '$reduce',
        '$sum', '$max', '$min', '$average',
        '$',
        '$context'
    ];

    const keywords = [
        'and', 'or', 'in', 'as', 'true', 'false', 'null', 'if', 'then', 'else', 'some', 'every'
    ];

    // Process the code character by character
    for (let i = 0; i < code.length; i++) {
        const currentChar = code[i];
        const nextChar = i < code.length - 1 ? code[i + 1] : '';
        const prevChar = i > 0 ? code[i - 1] : '';
        
        // Handle multi-line comments
        if (inMultiLineComment) {
            formatted += currentChar;
            if (currentChar === '*' && nextChar === '/') {
                formatted += nextChar;
                i++;
                inMultiLineComment = false;
            }
            continue;
        }
        
        if (currentChar === '/' && nextChar === '*' && !inString) {
            inMultiLineComment = true;
            formatted += '/*';
            i++;
            continue;
        }
        
        // Handle strings
        if (inString) {
            formatted += currentChar;
            if (currentChar === stringChar && prevChar !== '\\') {
                inString = false;
            }
            continue;
        } else if ((currentChar === '"' || currentChar === "'") && prevChar !== '\\') {
            inString = true;
            stringChar = currentChar;
            formatted += currentChar;
            continue;
        }
        
        // Handle operators and punctuation
        switch (currentChar) {
            case '(':
                bracketStack.push('(');
                formatted += currentChar;
                
                // Check if we're starting a function call (preceded by $)
                const functionStart = isFunctionStart(code, i);
                if (!functionStart && nextChar !== ')') {
                    indentLevel++;
                    addNewlineIndent();
                }
                break;
                
            case '[':
                bracketStack.push('[');
                formatted += currentChar;
                
                // Don't add newline for filter expressions or function arguments
                const isPathFilter = isFilterExpression(code, i);
                if (!isPathFilter) {
                    indentLevel++;
                    addNewlineIndent();
                }
                break;
                
            case '{':
                bracketStack.push('{');
                formatted += currentChar;
                indentLevel++;
                addNewlineIndent();
                break;
                
            case ')':
                if (bracketStack.length && bracketStack[bracketStack.length - 1] === '(') {
                    bracketStack.pop();
                }
                
                // Only decrease indent and add newline if not inside a function call
                // or if this closes the outermost function parenthesis
                if (prevChar !== '(' && shouldDecreaseIndent(bracketStack, '(')) {
                    indentLevel--;
                    addNewlineIndent();
                }
                formatted += currentChar;
                break;
                
            case ']':
                if (bracketStack.length && bracketStack[bracketStack.length - 1] === '[') {
                    bracketStack.pop();
                }
                
                // Only decrease indent for array brackets, not filter expressions
                if (shouldDecreaseIndent(bracketStack, '[')) {
                    indentLevel--;
                    addNewlineIndent();
                }
                formatted += currentChar;
                break;
                
            case '}':
                if (bracketStack.length && bracketStack[bracketStack.length - 1] === '{') {
                    bracketStack.pop();
                }
                indentLevel--;
                addNewlineIndent();
                formatted += currentChar;
                break;
                
            case ',':
                formatted += ',';
                // Don't add newline if next char is closing bracket or if inside a function
                if (![']', '}', ')'].includes(nextChar) && !isInFunction(bracketStack)) {
                    addNewlineIndent();
                } else if (nextChar !== ' ' && !isWhitespace(nextChar)) {
                    formatted += ' ';
                }
                break;
                
            case ':':
                if (nextChar === '=') {
                    formatted += ': ';
                    formatted += '=';
                    i++;
                    if (!isWhitespace(code[i + 1])) formatted += ' ';
                } else {
                    formatted += ': ';
                }
                break;
                
            case ';':
                formatted += ';';
                addNewlineIndent();
                break;
                
            case '|':
                formatted += nextChar === '|' ? (i++, ' || ') : ' | ';
                break;
                
            case '&':
                formatted += nextChar === '&' ? (i++, ' && ') : ' & ';
                break;
                
            case '~':
                if (nextChar === '>') {
                    formatted += ' ~>';
                    i++;
                    // Add newline after ~> unless it's part of a function chain
                    if (!isInFunction(bracketStack) && !isNextCharFunctionStart(code, i + 1)) {
                        addNewlineIndent();
                    }
                } else {
                    formatted += '~';
                }
                break;
                
            case '=':
            case '+':
            case '-':
            case '*':
            case '/':
            case '<':
            case '>':
            case '!':
                // Add spaces around operators
                if (prevChar !== ' ' && !isWhitespace(prevChar) && formatted.length > 0 && formatted[formatted.length - 1] !== ' ') {
                    formatted += ' ';
                }
                
                formatted += currentChar;
                
                if (nextChar === '=') {
                    formatted += nextChar;
                    i++;
                }
                
                if (!isWhitespace(code[i + 1]) && i + 1 < code.length && code[i + 1] !== ')' && code[i + 1] !== ']' && code[i + 1] !== '}') {
                    formatted += ' ';
                }
                break;
                
            case ' ':
            case '\t':
            case '\n':
            case '\r':
                // Only add one space if the previous character isn't a space
                if (formatted.length > 0 && !isWhitespace(formatted[formatted.length - 1]) && !isWhitespace(nextChar)) {
                    formatted += ' ';
                }
                break;
                
            case '$':
                // Special handling for variable/function references
                if (isVariableOrFunctionRef(code, i)) {
                    const token = extractVariableOrFunction(code, i);
                    formatted += token;
                    i += token.length - 1;
                } else {
                    formatted += currentChar;
                }
                break;
                
            default:
                // Check for keywords
                let matched = false;
                for (const keyword of keywords) {
                    if (code.substring(i, i + keyword.length) === keyword && 
                        (i + keyword.length >= code.length || !/[a-zA-Z0-9_]/.test(code[i + keyword.length]))) {
                        formatted += keyword;
                        i += keyword.length - 1;
                        matched = true;
                        
                        // Add a space after keywords if needed
                        if (i + 1 < code.length && !isWhitespace(code[i + 1]) && ![',', ';', ')', ']', '}'].includes(code[i + 1])) {
                            formatted += ' ';
                        }
                        break;
                    }
                }
                
                if (!matched) {
                    formatted += currentChar;
                }
        }
    }
    
    return formatted.trim();

    // Helper functions for the formatter
    function isFunctionStart(code, pos) {
        // Check if we're at a function call (preceded by $)
        if (pos > 0) {
            let j = pos - 1;
            while (j >= 0 && isWhitespace(code[j])) j--; // Skip whitespace
            
            if (j >= 0 && code[j] === '$') return true;
            
            // Check if it's a built-in function
            for (const func of builtinFunctions) {
                const startPos = pos - func.length;
                if (startPos >= 0 && code.substring(startPos, pos) === func) {
                    return true;
                }
            }
        }
        return false;
    }
    
    function isFilterExpression(code, pos) {
        // Check if this is a filter expression [...]
        if (pos > 0) {
            let j = pos - 1;
            while (j >= 0 && isWhitespace(code[j])) j--; // Skip whitespace
            if (j >= 0 && /[a-zA-Z0-9_$\)\]]/.test(code[j])) {
                return true; // It's a filter if preceded by variable/property reference
            }
        }
        return false;
    }
    
    function shouldDecreaseIndent(stack, bracket) {
        // Check if we should decrease indent level based on bracket type and stack
        return stack.lastIndexOf(bracket) === -1;
    }
    
    function isInFunction(stack) {
        // Check if we're inside a function call
        return stack.includes('(');
    }
    
    function isNextCharFunctionStart(code, pos) {
        // Check if next non-whitespace is a function start
        let j = pos;
        while (j < code.length && isWhitespace(code[j])) j++;
        return j < code.length && code[j] === '$';
    }
    
    function isVariableOrFunctionRef(code, pos) {
        return code[pos] === '$';
    }
    
    function extractVariableOrFunction(code, pos) {
        // Extract a variable or function reference starting with $
        let end = pos + 1;
        while (end < code.length && /[a-zA-Z0-9_]/.test(code[end])) {
            end++;
        }
        return code.substring(pos, end);
    }
}

function copyOutput() {
    const outputText = outputEditor.getValue();
    if (!outputText.trim()) {
        showToast('Nothing to copy!', 'warning');
        return;
    }
    
    navigator.clipboard.writeText(outputText)
        .then(() => showToast('Copied to clipboard!', 'success'))
        .catch(err => {
            console.error('Error copying text: ', err);
            showToast('Failed to copy!', 'error');
        });
}

function clearInput() {
    inputEditor.setValue('');
    outputEditor.setValue('');
}

function formatJSONata() {
    const input = inputEditor.getValue();
    if (!input.trim()) {
        showToast('Please enter some JSONata code first!', 'warning');
        return;
    }
    
    try {
        const formatted = jsonataFormatter(input);
        outputEditor.setValue(formatted);
        showToast('Formatting completed!', 'success');
    } catch (e) {
        showToast('Error formatting JSONata code', 'error');
        console.error(e);
    }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    const icon = toast.querySelector('i');
    icon.className = `fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-circle' : 'times-circle'}`;
    toast.style.background = type === 'success' ? '#4caf50' : type === 'warning' ? '#ff9800' : '#f44336';
    toastMessage.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const icon = document.querySelector('.dark-mode-toggle i');
    const darkModeEnabled = document.body.classList.contains('dark-mode');
    
    // Update Monaco editor theme
    if (monaco && monaco.editor) {
        monaco.editor.setTheme(darkModeEnabled ? 'vs-dark' : 'vs');
    }
    
    localStorage.setItem('darkMode', darkModeEnabled ? 'enabled' : 'disabled');
    icon.className = `fas fa-${darkModeEnabled ? 'sun' : 'moon'}`;
}