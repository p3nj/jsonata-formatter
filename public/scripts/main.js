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

  const pathOperators = ['.', '.*', '[]', '{}'];

    for (let i = 0, previousChar = '', currentChar = '', nextChar = ''; i < code.length; i++, previousChar = currentChar) {
        currentChar = code[i];
        nextChar = i < code.length - 1 ? code[i + 1] : '';

        if (inMultiLineComment) {
            formatted += currentChar;
            if (currentChar === '*' && nextChar === '/') { formatted += nextChar; i++; inMultiLineComment = false; if (i < code.length && code[i] !== '\n') addNewlineIndent(); }
            continue;
        } else if (currentChar === '/' && nextChar === '*' && !inString) {
            if (formatted.trim().length > 0) addNewlineIndent();
            formatted += '/*'; i++; inMultiLineComment = true; continue;
        }

        if (inString) { formatted += currentChar; if (currentChar === stringChar && previousChar !== '\\') inString = false; continue; }
        else if ((currentChar === '"' || currentChar === "'") && previousChar !== '\\') { inString = true; stringChar = currentChar; formatted += currentChar; continue; }

        if (inBuiltinFunction) {
            formatted += currentChar;
            if (currentChar === '(') bracketCount++;
            if (currentChar === ')') bracketCount--;
            if (bracketCount === 0 && (currentChar === ')' || currentChar === ']') && nextChar !== '[') inBuiltinFunction = false;
            if (currentChar === ',' && nextChar !== ' ') formatted += ' ';
            continue;
        } else if (currentChar === '$') {
            for (const func of builtinFunctions) {
                if (code.substring(i, i + func.length) === func && code[i + func.length] === '(') { inBuiltinFunction = true; bracketCount = 0; break; }
            }
        }

        let isPathOperator = false;
        for (const operator of pathOperators) {
            if (code.substring(i, i + operator.length) === operator) { formatted += operator; i += operator.length - 1; isPathOperator = true; break; }
        }
        if (isPathOperator) continue;

        switch (currentChar) {
            case '(': formatted += (/[a-zA-Z0-9_$]/.test(previousChar) ? '' : '') + currentChar; if (nextChar !== ')') { indentLevel++; addNewlineIndent(); } break;
            case '[': formatted += currentChar; if (/[a-zA-Z0-9_$]/.test(previousChar)) inFilterExpression = true; else { indentLevel++; addNewlineIndent(); } break;
            case '{': formatted += (previousChar === '.' ? '' : currentChar); indentLevel++; addNewlineIndent(); break;
            case ')': if (previousChar !== '(') { if (indentLevel > 0) indentLevel--; addNewlineIndent(); } formatted += currentChar; break;
            case ']': formatted += currentChar; if (!inFilterExpression) { indentLevel--; addNewlineIndent(); } else inFilterExpression = false; break;
            case '}': indentLevel--; addNewlineIndent(); formatted += currentChar; break;
            case ',': formatted += ','; if (!(nextChar === ']' || nextChar === '}' || nextChar === ')')) addNewlineIndent(); else if (inBuiltinFunction) formatted += ' '; break;
            case ';': formatted += ';'; addNewlineIndent(); break;
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
                    if (code.substring(i, i + keyword.length) === keyword && (i + keyword.length >= code.length || !/[a-zA-Z0-9_]/.test(code[i + keyword.length]))) { formatted += keyword; i += keyword.length - 1; isKeyword = true; if (i + 1 < code.length && !/\s/.test(code[i + 1])) formatted += ' '; break; }
                }
                if (!isKeyword) formatted += currentChar;
        }
    }

    formatted = formatted.replace(/]\s*,/g, '],');
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