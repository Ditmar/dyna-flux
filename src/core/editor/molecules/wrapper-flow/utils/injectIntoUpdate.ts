import { detectBlockIndices } from './parsecode';

// Inserts code right after the opening `{` of the first `for (...)` loop
// inside the model's update() function.
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

export { injectInsideLoopStart };
