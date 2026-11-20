// Extracts the `{ ... }` object literal from `const model = { ... };`
const getBaseCodeBlock = (codeString: string) => {
    const firstIndex = codeString.indexOf('{');
    const lastIndex = codeString.lastIndexOf('}');
    return codeString.substring(firstIndex, lastIndex + 1);
}

// Locates the body of `functionName: function () { ... }` by matching braces,
// so it also works when other functions (with their own `{`/`}`) exist before it.
const detectBlockIndices = (code: string, functionName: string) => {
    // String.raw keeps the backslashes of the regex intact.
    const functionRegex = new RegExp(functionName + String.raw`\s*:\s*(?:function\s*\([^)]*\)|\([^)]*\)\s*=>)\s*\{`);
    const headerMatch = code.match(functionRegex);
    if (!headerMatch || headerMatch.index === undefined) {
        return { startIndex: -1, endIndex: -1 };
    }
    const openBraceIndex = headerMatch.index + headerMatch[0].length - 1;
    let depth = 1;
    let endIndex = code.length;
    for (let i = openBraceIndex + 1; i < code.length; i++) {
        if (code[i] === '{') depth++;
        else if (code[i] === '}') {
            depth--;
            if (depth === 0) {
                endIndex = i;
                break;
            }
        }
    }
    const startIndex = openBraceIndex + 1;
    return { startIndex, endIndex };
}

export { getBaseCodeBlock, detectBlockIndices };
