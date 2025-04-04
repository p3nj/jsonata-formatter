document.addEventListener('DOMContentLoaded', () => {
    const isDarkMode = localStorage.getItem('darkMode') === 'enabled' || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches && localStorage.getItem('darkMode') === null);
    if (isDarkMode) toggleDarkMode();

    let timeout;
    document.getElementById('input-box').addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            if (document.getElementById('input-box').value.trim()) formatJSONata();
        }, 800);
    });
});

function jsonataFormatter(code) {
    code = String(code || '');
    let formatted = '', indentLevel = 0, indentSize = 2, inString = false, stringChar = null, inBuiltinFunction = false, bracketCount = 0, inFilterExpression = false, inMultiLineComment = false;
    const addNewlineIndent = () => formatted += '\n' + ' '.repeat(Math.max(0, indentLevel) * indentSize);
    const builtinFunctions = ['$map', '$reduce', '$filter', '$single', '$sift', '$split', '$join', '$match', '$contains', '$replace', '$formatNumber', '$formatBase', '$formatInteger', '$substringAfter', '$substringBefore', '$substring', '$sum', '$max', '$min', '$average', '$power', '$sqrt', '$abs', '$round', '$floor', '$ceiling', '$string', '$number', '$boolean', '$not', '$count', '$append', '$distinct', '$shuffle', '$reverse', '$error', '$eval', '$base64encode', '$base64decode', '$toMillis', '$fromMillis'];
    const keywords = ['function', 'if', 'then', 'else', 'unless', 'where', 'order by', 'group by', 'case', 'when', 'default', 'and', 'or', 'in', 'not in', 'as', 'at', 'with'];

    for (let i = 0, previousChar = '', currentChar = '', nextChar = ''; i < code.length; i++, previousChar = currentChar) {
        currentChar = code[i];
        nextChar = i < code.length - 1 ? code[i + 1] : '';

        // Multi-line comment handling
        if (currentChar === '/' && nextChar === '*' && !inString) {
            if (formatted.trim().length > 0) {
                addNewlineIndent();
            }
            formatted += '/*';
            i++;
            inMultiLineComment = true;
            continue;
        }

        if (currentChar === '*' && nextChar === '/' && inMultiLineComment) {
            formatted += '*/';
            i++;
            inMultiLineComment = false;
            if (i < code.length && code[i] !== '\n') {
                addNewlineIndent();
            }
            continue;
        }

        if (inMultiLineComment) {
            formatted += currentChar;
            continue;
        }

        if ((currentChar === '"' || currentChar === "'") && previousChar !== '\\') {
            if (!inString) { inString = true; stringChar = currentChar; }
            else if (currentChar === stringChar) { inString = false; stringChar = null; }
            formatted += currentChar; continue;
        }
        if (inString) { formatted += currentChar; continue; }

        if (currentChar === '$' && !inBuiltinFunction) {
            for (const func of builtinFunctions) {
                if (code.substring(i, i + func.length) === func && code[i + func.length] === '(') {
                    inBuiltinFunction = true; bracketCount = 0; break;
                }
            }
        }

        if (inBuiltinFunction) {
            if (currentChar === '(') bracketCount++;
            if (currentChar === ')') bracketCount--;
            if (bracketCount === 0 && (currentChar === ')' || currentChar === ']') && nextChar !== '[') inBuiltinFunction = false;
            formatted += currentChar;
            if (currentChar === ',' && nextChar !== ' ') formatted += ' ';
            continue;
        }

        switch (currentChar) {
            case '(': formatted += (/[a-zA-Z0-9_$]/.test(previousChar) ? '' : '') + currentChar; if (nextChar !== ')') { indentLevel++; addNewlineIndent(); } break;
            case '[':
                formatted += currentChar;
                if (/[a-zA-Z0-9_$]/.test(previousChar)) {
                    inFilterExpression = true;
                } else {
                    indentLevel++;
                    addNewlineIndent();
                }
                break;
            case '{':
                if (previousChar === '.') {
                    formatted = formatted.trimEnd() + currentChar; // Remove space before '{' after '.'
                } else {
                    formatted += currentChar;
                }
                indentLevel++;
                addNewlineIndent();
                break;
            case ')': if (previousChar !== '(') { if (indentLevel > 0) indentLevel--; addNewlineIndent(); } formatted += currentChar; break;
            case ']':
                formatted += currentChar;
                if (!inFilterExpression) {
                    indentLevel--;
                    addNewlineIndent();
                } else {
                    inFilterExpression = false;
                }
                break;
            case '}':
                indentLevel--;
                addNewlineIndent();
                formatted += currentChar;
                break;
            case ',':
                formatted += ',';
                if (!(nextChar === ']' || nextChar === '}' || nextChar === ')')) {
                    addNewlineIndent();
                } else if (inBuiltinFunction) {
                    formatted += ' ';
                }
                break;
            case ';': formatted += ';'; addNewlineIndent(); break;
            case '.': formatted += (nextChar === '.' ? (i++, '..') : nextChar === '*' ? (i++, '.*') : nextChar === '(' ? (i++, '.(') : '.'); break;
            case ':': formatted += (nextChar === '=' ? (i++, ':= ') : ': '); break;
            case '|': formatted += (nextChar === '|' ? (i++, ' || ') : ' | '); break;
            case '&': formatted += (nextChar === '&' ? (i++, ' && ') : ' & '); break;
            case '~': formatted += (nextChar === '>' ? (i++, ' ~>' + (inBuiltinFunction ? '' : (addNewlineIndent(), ''))) : '~'); break;
            case '=': case '+': case '-': case '*': case '/': case '<': case '>': case '!': formatted += ` ${currentChar}${nextChar === '=' ? (i++, nextChar) : ''} `; break;
            case ' ': case '\t': case '\n': case '\r': if (formatted.length > 0 && !/\s/.test(formatted[formatted.length - 1]) && nextChar.trim() !== '') formatted += ' '; break;
            case '$': formatted += currentChar; break;
            default:
                let isKeyword = false;
                for (const keyword of keywords) {
                    if (code.substring(i, i + keyword.length) === keyword && (i + keyword.length >= code.length || !/[a-zA-Z0-9_]/.test(code[i + keyword.length]))) {
                        formatted += keyword; i += keyword.length - 1; isKeyword = true;
                        if (i + 1 < code.length && !/\s/.test(code[i + 1])) formatted += ' '; break;
                    }
                }
                if (!isKeyword) formatted += currentChar;
        }
    }

    formatted = formatted.replace(/]\s*,/g, '],'); // Fix comma after ']'
    try { return formatted.replace(/\n\s*\n/g, '\n').replace(/\s+$/gm, '').trim(); }
    catch (e) { console.error('Error during final formatting cleanup:', e); return formatted.trim(); }
}

function copyOutput() {
    const output = document.getElementById('output-box');
    if (!output.textContent.trim()) { showToast('Nothing to copy!', 'warning'); return; }
    navigator.clipboard.writeText(output.textContent).then(() => showToast('Copied to clipboard!', 'success')).catch(err => { console.error('Error copying text: ', err); showToast('Failed to copy!', 'error'); });
}

function clearInput() {
    document.getElementById('input-box').value = '';
    document.getElementById('output-box').textContent = '';
    Prism.highlightElement(document.getElementById('output-box'));
}

function formatJSONata() {
    const input = document.getElementById('input-box').value;
    if (!input.trim()) { showToast('Please enter some JSONata code first!', 'warning'); return; }
    try {
        const formatted = jsonataFormatter(input);
        const output = document.getElementById('output-box');
        output.textContent = formatted;
        Prism.highlightElement(output);
        showToast('Formatting completed!', 'success');
    } catch (e) { showToast('Error formatting JSONata code', 'error'); console.error(e); }
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
    localStorage.setItem('darkMode', darkModeEnabled ? 'enabled' : 'disabled');
    icon.className = `fas fa-${darkModeEnabled ? 'sun' : 'moon'}`;
}