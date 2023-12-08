// https://github.com/kpdecker/jsdiff/blob/master/src/diff/base.js
/**
 * @typedef Path
 * @property {number} newPos
 * @property {Component[]} components
 */
/**
 * @typedef Component
 * @property {number} count
 * @property {boolean} [added]
 * @property {boolean} [removed]
 * @property {string} [value]
 */

/**
 * @param {string} oldString 
 * @param {string} newString 
 * @returns {Component[]}
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function diffString(oldString, newString) {
  const newLen = newString.length;
  const oldLen = oldString.length;
  let editLength = 1;
  const maxEditLength = newLen + oldLen;
  
  /** @type {Path[]} */
  const bestPath = [{ newPos: -1, components: [] }];
  
  // Seed editLength = 0, i.e. the content starts with the same values
  const oldPos = extractCommon(bestPath[0], newString, oldString, 0);
  if (bestPath[0].newPos + 1 >= newLen && oldPos + 1 >= oldLen) {
    // Identity per the equality and tokenizer
    return [{value: newString, count: newString.length}];
  }
  
  while (editLength <= maxEditLength) {
    for (let diagonalPath = -1 * editLength; diagonalPath <= editLength; diagonalPath += 2) {
      let basePath;
      const addPath = bestPath[diagonalPath - 1];
      const removePath = bestPath[diagonalPath + 1];
      let oldPos = (removePath ? removePath.newPos : 0) - diagonalPath;
      if (addPath) {
        // No one else is going to attempt to use this value, clear it
        // @ts-ignore
        bestPath[diagonalPath - 1] = undefined;
      }
      
      const canAdd = addPath && addPath.newPos + 1 < newLen;
      const canRemove = removePath && oldPos >= 0 && oldPos < oldLen;
      if (!canAdd && !canRemove) {
        // If this path is a terminal then prune
        // @ts-ignore
        bestPath[diagonalPath] = undefined;
        continue;
      }
      
      // Select the diagonal that we want to branch from. We select the prior
      // path whose position in the new string is the farthest from the origin
      // and does not pass the bounds of the diff graph
      if (!canAdd || (canRemove && addPath.newPos < removePath.newPos)) {
        basePath = clonePath(removePath);
        pushComponent(basePath.components, undefined, true);
      } else {
        basePath = addPath; // No need to clone, we've pulled it from the list
        basePath.newPos++;
        pushComponent(basePath.components, true, undefined);
      }
      
      oldPos = extractCommon(basePath, newString, oldString, diagonalPath);
      
      // If we have hit the end of both strings, then we are done
      if (basePath.newPos + 1 >= newLen && oldPos + 1 >= oldLen) {
        return buildValues(basePath.components, newString, oldString);
      } else {
        // Otherwise track this path as a potential candidate and continue.
        bestPath[diagonalPath] = basePath;
      }
    }
    
    editLength++;
  }
  
  return [];
}

/**
 * @param {Component[]} components 
 * @param {boolean | undefined} added 
 * @param {boolean | undefined} removed 
 */
function pushComponent(components, added, removed) {
  const last = components[components.length - 1];
  if (last && last.added === added && last.removed === removed) {
    // We need to clone here as the component clone operation is just
    // as shallow array clone
    components[components.length - 1] = {count: last.count + 1, added: added, removed: removed };
  } else {
    components.push({count: 1, added: added, removed: removed });
  }
}
/**
 * @param {Path} basePath 
 * @param {string} newString 
 * @param {string} oldString 
 * @param {number} diagonalPath 
 */
function extractCommon(basePath, newString, oldString, diagonalPath) {
  const newLen = newString.length;
  const oldLen = oldString.length;
  let newPos = basePath.newPos;
  let oldPos = newPos - diagonalPath;
  let commonCount = 0;
  while (newPos + 1 < newLen && oldPos + 1 < oldLen && newString[newPos + 1] === oldString[oldPos + 1]) {
    newPos++;
    oldPos++;
    commonCount++;
  }
  
  if (commonCount) {
    basePath.components.push({count: commonCount});
  }

  basePath.newPos = newPos;
  return oldPos;
}

/**
 * @param {Component[]} components 
 * @param {string} newString 
 * @param {string} oldString 
 */
function buildValues(components, newString, oldString) {
  let componentPos = 0;
  const componentLen = components.length;
  let newPos = 0;
  let oldPos = 0;

  for (; componentPos < componentLen; componentPos++) {
    const component = components[componentPos];
    if (!component.removed) {
      component.value = newString.substring(newPos, newPos + component.count);
      newPos += component.count;

      // Common case
      if (!component.added) {
        oldPos += component.count;
      }
    } else {
      component.value = oldString.substring(oldPos, oldPos + component.count);
      oldPos += component.count;

      // Reverse add and remove so removes are output first to match common convention
      // The diffing algorithm is tied to add then remove output and this is the simplest
      // route to get the desired output with minimal overhead.
      if (componentPos && components[componentPos - 1].added) {
        const tmp = components[componentPos - 1];
        components[componentPos - 1] = components[componentPos];
        components[componentPos] = tmp;
      }
    }
  }

  // Special case handle for when one terminal is ignored (i.e. whitespace).
  // For this case we merge the terminal into the prior string and drop the change.
  // This is only available for string mode.
  const lastComponent = components[componentLen - 1];
  if (
    componentLen > 1
    && typeof lastComponent.value === 'string'
    && (lastComponent.added || lastComponent.removed)
    && lastComponent.value.length === 0
  ) {
    components[componentLen - 2].value += lastComponent.value;
    components.pop();
  }
  
  return components;
}

/**
 * @param {Path} path 
 * @returns {Path}
 */
function clonePath(path) {
  return { newPos: path.newPos, components: path.components.slice(0) };
}
