// Global variables for editor instances
let inputEditor, outputEditor;

// Initialize Monaco Editor when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Use proper AMD loading for Monaco
    require(['vs/editor/editor.main'], function () {
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
    // Tokenize the input first for more efficient processing
    const tokens = tokenizeJSONata(code);

    // Format using the tokens
    let formatted = '';
    let indentLevel = 0;
    let indentSize = 2;

    // Track previous token for context-aware formatting
    let previousToken = null;

    // Enhanced bracket tracking with positions
    const bracketStack = [];
    // Track nested structure for proper indentation
    const structureStack = [];

    // Track current function call depth
    let functionCallDepth = 0;

    // Helper function to safely create indentation
    const indent = (level) => ' '.repeat(Math.max(0, level * indentSize));

    // More efficient peek ahead function
    const peekAhead = (index) => {
        let j = index + 1;
        while (j < tokens.length &&
            (tokens[j].type === 'whitespace' || tokens[j].type === 'newline')) {
            j++;
        }
        return j < tokens.length ? tokens[j] : null;
    };

    // Helper to determine if a bracket pair is a filter in a property path
    const isPropertyFilter = (openIndex) => {
        if (openIndex <= 0) return false;

        // Look at token before the opening bracket
        let prevToken = tokens[openIndex - 1];
        while (openIndex > 1 && (prevToken.type === 'whitespace' || prevToken.type === 'newline')) {
            prevToken = tokens[--openIndex - 1];
        }

        return prevToken && (prevToken.type === 'identifier' ||
            prevToken.value === ']' || prevToken.value === ')');
    };

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const ahead = peekAhead(i);

        switch (token.type) {
            // Literals and identifiers
            case 'string':
            case 'number':
            case 'identifier':
            case 'keyword':
            case 'function':
                // Add space if needed for readability
                if (previousToken &&
                    !['(', '[', '{', '.'].includes(previousToken.value) &&
                    !['operator', 'punctuation'].includes(previousToken.type)) {
                    formatted += ' ';
                }
                formatted += token.value;
                break;

            case 'operator':
                // Handle operators with proper spacing
                if (token.value === ':=' || token.value === '~>') {
                    formatted += token.value;
                } else {
                    // Standard operators with spaces
                    if (previousToken &&
                        !['(', '['].includes(previousToken.value) &&
                        formatted[formatted.length - 1] !== ' ') {
                        formatted += ' ';
                    }
                    formatted += token.value;
                    if (ahead && ![')', ']', ',', '}'].includes(ahead.value)) {
                        formatted += ' ';
                    }
                }
                break;

            case 'punctuation':
                switch (token.value) {
                    // Opening brackets
                    case '(':
                        formatted += '(';

                        // Check if this is a function call
                        const isFunction = previousToken &&
                            (previousToken.type === 'function' || previousToken.type === 'identifier');

                        if (isFunction) {
                            functionCallDepth++;
                        }

                        // Push to bracket stack with context info
                        bracketStack.push({
                            type: '(',
                            isFunction: isFunction,
                            indentLevel: indentLevel
                        });

                        // Only add newline for non-function parentheses
                        if (!isFunction && ahead && ahead.value !== ')') {
                            indentLevel++;
                            structureStack.push('(');
                            formatted += '\n' + indent(indentLevel);
                        }
                        break;

                    case '[':
                        // Determine if this is a filter in a property path
                        const filter = isPropertyFilter(i);

                        // Save bracket context
                        bracketStack.push({
                            type: '[',
                            isFilter: filter,
                            indentLevel: indentLevel
                        });

                        formatted += '[';

                        if (filter) {
                            // This is a filter in a property path
                            // Check if it's a complex filter that needs a line break
                            const closingIdx = findMatchingBracket(tokens, i, '[', ']');
                            const complexity = getExpressionComplexity(tokens, i + 1, closingIdx - 1);

                            if (complexity > 5) {
                                indentLevel++;
                                structureStack.push('[filter]');
                                formatted += '\n' + indent(indentLevel);
                            }
                        } else {
                            // Regular array
                            indentLevel++;
                            structureStack.push('[array]');
                            formatted += '\n' + indent(indentLevel);
                        }
                        break;

                    case '{':
                        bracketStack.push({
                            type: '{',
                            indentLevel: indentLevel
                        });

                        formatted += '{';
                        indentLevel++;
                        structureStack.push('{');
                        formatted += '\n' + indent(indentLevel);
                        break;

                    // Closing brackets
                    case ')':
                        // Find matching opening bracket
                        let openingParen = null;
                        while (bracketStack.length > 0) {
                            const last = bracketStack.pop();
                            if (last.type === '(') {
                                openingParen = last;
                                break;
                            }
                        }

                        if (openingParen && openingParen.isFunction) {
                            // Function call - simple closing
                            functionCallDepth--;
                            formatted += ')';
                        } else {
                            // Grouped expression - proper indentation
                            if (structureStack.length > 0 && structureStack[structureStack.length - 1] === '(') {
                                structureStack.pop();
                                indentLevel = Math.max(0, indentLevel - 1);
                            }

                            // Only add newline if not an empty group and not right after opening paren
                            if (previousToken && previousToken.value !== '(') {
                                formatted += '\n' + indent(indentLevel);
                            }
                            formatted += ')';
                        }
                        break;

                    case ']':
                        // Find matching opening bracket
                        let openingBracket = null;
                        while (bracketStack.length > 0) {
                            const last = bracketStack.pop();
                            if (last.type === '[') {
                                openingBracket = last;
                                break;
                            }
                        }

                        if (openingBracket && openingBracket.isFilter) {
                            // Filter closing - check complexity
                            const keepOnSameLine = formatted[formatted.length - 1] !== '\n' &&
                                formatted.split('\n').pop().length < 50;

                            if (keepOnSameLine) {
                                formatted += ']';
                            } else {
                                if (structureStack.length > 0 && structureStack[structureStack.length - 1] === '[filter]') {
                                    structureStack.pop();
                                    indentLevel = Math.max(0, indentLevel - 1);
                                }
                                formatted += '\n' + indent(indentLevel) + ']';
                            }
                        } else {
                            // Array closing
                            if (structureStack.length > 0 && structureStack[structureStack.length - 1] === '[array]') {
                                structureStack.pop();
                                indentLevel = Math.max(0, indentLevel - 1);
                            }
                            formatted += '\n' + indent(indentLevel) + ']';
                        }
                        break;

                    case '}':
                        // Pop the stack until matching bracket
                        while (bracketStack.length > 0) {
                            const last = bracketStack.pop();
                            if (last.type === '{') {
                                break;
                            }
                        }

                        if (structureStack.length > 0 && structureStack[structureStack.length - 1] === '{') {
                            structureStack.pop();
                            indentLevel = Math.max(0, indentLevel - 1);
                        }

                        formatted += '\n' + indent(indentLevel) + '}';
                        break;

                    case '.':
                        // Property access - clean up any spaces before dot
                        while (formatted.length > 0 && formatted[formatted.length - 1] === ' ') {
                            formatted = formatted.slice(0, -1);
                        }
                        formatted += '.';

                        // Check if we need a line break for complex property chains
                        if (i > 0 && tokens[i - 1].value === ']') {
                            // After a filter, consider adding a line break for readability
                            if (formatted.split('\n').pop().length > 40) {
                                formatted += '\n' + indent(indentLevel);
                            }
                        }
                        break;

                    case ',':
                        formatted += ',';

                        if (ahead && [')', ']', '}'].includes(ahead.value)) {
                            // No additional formatting if followed by closing bracket
                        } else if (functionCallDepth > 0) {
                            // Simple space for function parameters
                            formatted += ' ';
                        } else {
                            // Newline for arrays and objects
                            formatted += '\n' + indent(indentLevel);
                        }
                        break;

                    case ':':
                        // Skip if part of := operator
                        if (ahead && ahead.value === '=') {
                            // Will be handled as operator
                        } else {
                            formatted += ': ';
                        }
                        break;

                    case ';':
                        formatted += ';';
                        formatted += '\n' + indent(indentLevel);
                        break;

                    default:
                        formatted += token.value;
                }
                break;

            case 'comment':
                // Preserve comments
                if (token.value.startsWith('/*')) {
                    formatted += token.value;
                } else {
                    formatted += token.value;
                    formatted += '\n' + indent(indentLevel);
                }
                break;

            // Skip whitespace tokens - we add our own
            case 'whitespace':
            case 'newline':
                break;
        }

        // Update previous token for non-whitespace tokens
        if (token.type !== 'whitespace' && token.type !== 'newline') {
            previousToken = token;
        }
    }

    return formatted.trim();
}

// Helper function to find matching closing bracket
function findMatchingBracket(tokens, startIndex, openBracket, closeBracket) {
    let depth = 1;
    let i = startIndex + 1;

    while (i < tokens.length && depth > 0) {
        if (tokens[i].value === openBracket) depth++;
        if (tokens[i].value === closeBracket) depth--;
        i++;
    }

    return i - 1;
}

// Helper to estimate the complexity of an expression
function getExpressionComplexity(tokens, startIndex, endIndex) {
    if (startIndex >= endIndex) return 0;

    let complexity = 0;
    let nonWhitespaceCount = 0;

    for (let i = startIndex; i <= endIndex; i++) {
        if (tokens[i].type !== 'whitespace' && tokens[i].type !== 'newline') {
            complexity++;
            nonWhitespaceCount++;

            // Additional weight for certain token types
            if (['operator', 'function'].includes(tokens[i].type)) {
                complexity += 1;
            }
            if (['[', '{', '('].includes(tokens[i].value)) {
                complexity += 2;
            }
        }
    }

    return complexity;
}

function tokenizeJSONata(code) {
    const tokens = [];
    let i = 0;

    // Lists for recognizing keywords and built-in functions
    const keywords = ['and', 'or', 'in', 'as', 'true', 'false', 'null', 'if', 'then', 'else', 'some', 'every'];
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

    const isWhitespace = c => /\s/.test(c);
    const isDigit = c => /[0-9]/.test(c);
    const isAlpha = c => /[a-zA-Z_]/.test(c);
    const isAlphaNumeric = c => /[a-zA-Z0-9_]/.test(c);

    while (i < code.length) {
        const char = code[i];

        // Handle whitespace
        if (isWhitespace(char)) {
            let whitespace = '';
            while (i < code.length && isWhitespace(code[i])) {
                if (code[i] === '\n' || code[i] === '\r') {
                    tokens.push({ type: 'newline', value: code[i] });
                } else {
                    whitespace += code[i];
                }
                i++;
            }
            if (whitespace) {
                tokens.push({ type: 'whitespace', value: whitespace });
            }
            continue;
        }

        // Handle strings
        if (char === '"' || char === "'") {
            const quote = char;
            let string = quote;
            i++;

            while (i < code.length) {
                string += code[i];
                if (code[i] === quote && code[i - 1] !== '\\') break;
                i++;
            }

            tokens.push({ type: 'string', value: string });
            i++;
            continue;
        }

        // Handle comments
        if (char === '/' && i + 1 < code.length) {
            if (code[i + 1] === '*') {
                // Multi-line comment
                let comment = '/*';
                i += 2;

                while (i < code.length) {
                    if (code[i] === '*' && i + 1 < code.length && code[i + 1] === '/') {
                        comment += '*/';
                        i += 2;
                        break;
                    }
                    comment += code[i];
                    i++;
                }

                tokens.push({ type: 'comment', value: comment });
                continue;
            } else if (code[i + 1] === '/') {
                // Single-line comment
                let comment = '//';
                i += 2;

                while (i < code.length && code[i] !== '\n') {
                    comment += code[i];
                    i++;
                }

                tokens.push({ type: 'comment', value: comment });
                continue;
            }
        }

        // Handle numbers
        if (isDigit(char) || (char === '.' && i + 1 < code.length && isDigit(code[i + 1]))) {
            let number = '';
            let hasDecimal = false;

            if (char === '.') {
                number += '0.';
                hasDecimal = true;
                i++;
            }

            while (i < code.length && (isDigit(code[i]) || (code[i] === '.' && !hasDecimal))) {
                if (code[i] === '.') hasDecimal = true;
                number += code[i];
                i++;
            }

            tokens.push({ type: 'number', value: number });
            continue;
        }

        // Handle identifiers, keywords, and functions
        if (isAlpha(char) || char === '$') {
            let id = '';
            while (i < code.length && (isAlphaNumeric(code[i]) || code[i] === '$')) {
                id += code[i];
                i++;
            }

            // Check if this is a keyword
            if (keywords.includes(id)) {
                tokens.push({ type: 'keyword', value: id });
            } else if (builtinFunctions.includes(id) || id.startsWith('$')) {
                tokens.push({ type: 'function', value: id });
            } else {
                // Enhanced lookahead for better context detection
                let j = i;
                while (j < code.length && isWhitespace(code[j])) j++;
                const nextChar = j < code.length ? code[j] : null;

                // Detect if this identifier is a function or part of a property path
                if (nextChar === '(') {
                    tokens.push({ type: 'function', value: id });
                } else if (nextChar === '.' || nextChar === '[') {
                    // This is part of a property path
                    tokens.push({ type: 'identifier', value: id });
                } else {
                    tokens.push({ type: 'identifier', value: id });
                }
            }
            continue;
        }

        // Handle operators
        const operators = ['==', '!=', '<=', '>=', ':=', '~>', '&&', '||', '=', '<', '>', '+', '-', '*', '/', '!', '?', '&', '|'];
        let matched = false;

        for (const op of operators) {
            if (code.substring(i, i + op.length) === op) {
                tokens.push({ type: 'operator', value: op });
                i += op.length;
                matched = true;
                break;
            }
        }

        if (matched) continue;

        // Handle punctuation
        const punctuation = ['(', ')', '[', ']', '{', '}', ',', ':', ';', '.'];
        if (punctuation.includes(char)) {
            tokens.push({ type: 'punctuation', value: char });
            i++;
            continue;
        }

        // Handle unknown characters
        tokens.push({ type: 'unknown', value: char });
        i++;
    }

    return tokens;
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