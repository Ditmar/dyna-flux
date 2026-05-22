function injectBeforeLoop(code: string, beforeLoopCode: string) {
  const updateRegex = /update:\s*function\s*\(\)\s*\{([\s\S]*?)\n\s*\}/;
  const match = code.match(updateRegex);
  if (!match) return code;

  const updateBody = match[1];
  const modifiedBody = beforeLoopCode.trim() + '\n' + updateBody;

  const newUpdateFunction = `update: function () {\n${modifiedBody}\n  }`;
  return code.replace(updateRegex, newUpdateFunction);
}

function injectInsideLoopStart(code: string, insideLoopStartCode: string) {
  return code.replace(
    /(for\s*\([^)]*\)\s*\{)/,
    `$1\n${insideLoopStartCode.trim()}`
  );
}

function injectAfterLoop(code: string, afterLoopCode: string) {
  const lines = code.split('\n');
  const result = [];
  let inFor = false;
  let depth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inFor && /^\s*for\s*\(/.test(line)) {
      inFor = true;
    }

    if (inFor) {
      if (line.includes('{')) depth++;
      if (line.includes('}')) depth--;

      result.push(line);

      if (depth === 0 && inFor) {
        result.push(afterLoopCode.trim());
        inFor = false;
        continue;
      }
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

export { injectBeforeLoop, injectInsideLoopStart, injectAfterLoop };	