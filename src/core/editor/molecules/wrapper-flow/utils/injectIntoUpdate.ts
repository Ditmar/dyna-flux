import { detectBlockIndices } from './parsecode';

// Given the index of a '{', returns the index of its matching '}'.
function findMatchingBraceEnd(code: string, openBraceIndex: number): number {
  let depth = 1;
  for (let i = openBraceIndex + 1; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return code.length;
}

function injectBeforeLoop(code: string, beforeLoopCode: string) {
  const { startIndex, endIndex } = detectBlockIndices(code, 'update');
  if (startIndex < 0) return code;

  const before = code.slice(0, startIndex);
  const body = code.slice(startIndex, endIndex);
  const after = code.slice(endIndex);

  const newBody = `\n${beforeLoopCode.trim()}\n${body.replace(/^\s*\n/, '')}`;
  return before + newBody + after;
}

function injectInsideLoopStart(code: string, insideLoopStartCode: string) {
  const { startIndex, endIndex } = detectBlockIndices(code, 'update');
  if (startIndex < 0) return code;

  const before = code.slice(0, startIndex);
  const body = code.slice(startIndex, endIndex);
  const after = code.slice(endIndex);

  const newBody = body.replace(
    /(for\s*\([^)]*\)\s*\{)/,
    `$1\n${insideLoopStartCode.trim()}`
  );
  return before + newBody + after;
}

function injectAfterLoop(code: string, afterLoopCode: string) {
  const { startIndex, endIndex } = detectBlockIndices(code, 'update');
  if (startIndex < 0) return code;

  const before = code.slice(0, startIndex);
  const body = code.slice(startIndex, endIndex);
  const after = code.slice(endIndex);

  const forMatch = body.match(/for\s*\([^)]*\)\s*\{/);
  if (!forMatch || forMatch.index === undefined) return code;

  const openBraceIndex = forMatch.index + forMatch[0].length - 1;
  const closeBraceIndex = findMatchingBraceEnd(body, openBraceIndex);

  const newBody =
    body.slice(0, closeBraceIndex + 1) +
    '\n' + afterLoopCode.trim() + '\n' +
    body.slice(closeBraceIndex + 1);

  return before + newBody + after;
}

export { injectBeforeLoop, injectInsideLoopStart, injectAfterLoop };
