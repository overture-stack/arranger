import React from 'react';
import { cloneDeep } from 'lodash';
import { view, set, lensPath as lens } from 'ramda';
import { flattenDeep } from 'lodash';

/**
 * todo: these magic sqon values should be centralized across Arranger
 */
export const BOOLEAN_OPS = ['and', 'or', 'not'];
export const FIELD_OP = ['in', 'not-in', '>=', '<=', 'between'];
export const RANGE_OPS = ['>=', '<=', 'between'];
export const TERM_OPS = ['in', 'not-in'];
export const FIELD_OP_DISPLAY_NAME = {
  in: 'all of',
  'not-in': 'not',
  '>=': 'greater than',
  '<=': 'less than',
  between: 'between',
};

/**
 * Utilities for determining the type of sqon object
 */
export const isEmptySqon = sqonObj => sqonObj === null;
export const isReference = syntheticSqon => !isNaN(syntheticSqon);
export const isValueObj = sqonObj =>
  typeof sqonObj === 'object' &&
  !isEmptySqon(sqonObj) &&
  'value' in sqonObj &&
  'field' in sqonObj;
export const isBooleanOp = sqonObj =>
  typeof sqonObj === 'object' &&
  !isEmptySqon(sqonObj) &&
  BOOLEAN_OPS.includes(sqonObj.op);
export const isFieldOp = sqonObj =>
  typeof sqonObj === 'object' &&
  !isEmptySqon(sqonObj) &&
  FIELD_OP.includes(sqonObj.op);

/**
 * A synthetic sqon may look like: { "op": "and", "content": [1, 0, 2] }
 * where [1, 0, 2] is a list of index references to other sqons in a list
 * of given sqons. resolveSyntheticSqon resolves a synthetic sqon to an
 * executable sqon.
 **/
export const resolveSyntheticSqon = allSqons => syntheticSqon => {
  if (isEmptySqon(syntheticSqon)) {
    return syntheticSqon;
  } else if (isBooleanOp(syntheticSqon)) {
    return {
      ...syntheticSqon,
      content: syntheticSqon.content
        .map(c => (!isNaN(c) ? allSqons[c] : c))
        .map(resolveSyntheticSqon(allSqons)),
    };
  } else {
    return syntheticSqon;
  }
};

/**
 * Non-mutative removal of the entry at "indexToRemove" from a list of
 * synthetic sqons "sqonList" and updates references.
 **/
export const removeSqonAtIndex = (indexToRemove, sqonList) => {
  return sqonList
    .filter((s, i) => i !== indexToRemove) // takes out the removed sqon
    .map(sqon => {
      return isEmptySqon(sqon)
        ? sqon
        : {
            // removes references to the removed sqon
            ...sqon,
            content: sqon.content
              .filter(
                // removes references
                content => content !== indexToRemove,
              )
              .map(
                // shifts references to indices greater than the removed one
                s => (!isNaN(s) ? (s > indexToRemove ? s - 1 : s) : s),
              ),
          };
    });
};

/**
 * Non-mutative duplication of the entry at "indexToRemove" from a list of
 * synthetic sqons "sqonList" and updates references.
 **/
export const duplicateSqonAtIndex = (indexToDuplicate, sqonList) => {
  return [
    ...sqonList.slice(0, indexToDuplicate),
    cloneDeep(sqonList[indexToDuplicate]),
    ...sqonList.slice(indexToDuplicate, sqonList.length),
  ].map(sqon => {
    return isEmptySqon(sqon)
      ? sqon
      : {
          ...sqon,
          content: sqon.content.map(
            s => (!isNaN(s) ? (s > indexToDuplicate ? s + 1 : s) : s),
          ),
        };
  });
};

/**
 * Paths are in the format [1, 3, 4, ...] where each number is a
 * "content" index of the obj of interest in the sqon tree.
 **/
export const getOperationAtPath = paths => sqon => {
  const [currentPath, ...rest] = paths;
  return isBooleanOp(sqon)
    ? sqon.content
        .filter((c, i) => i === currentPath)
        .map(getOperationAtPath(rest))[0]
    : sqon;
};

/**
 * Non-mutative removal of an object at location 'paths' in 'sqon', using lens (refer to https://ramdajs.com/docs/#lens)
 * @param {[Number]} paths
 * @param {*} sqon
 */
export const removeSqonPath = paths => sqon => {
  // creates the target lens
  const lensPath = flattenDeep(paths.map(path => ['content', path]));
  const targetLens = lens(lensPath);

  // creates lens to the immediate parent of target
  const parentPath = flattenDeep(
    paths
      .slice(paths.length - 2, paths.length - 1)
      .map(path => ['content', path]),
  );
  const parentLens = lens(parentPath);

  // get reference to target and its immediate parent
  const removeTarget = view(targetLens, sqon);
  const parent = view(parentLens, sqon);

  // returns the modified structure with removeTarget filtered out
  return set(
    parentLens,
    { ...parent, content: parent.content.filter(c => c !== removeTarget) },
    sqon,
  );
};

export const changeSqonOpAtPath = (paths, newOpName) => sqon => {
  const lensPath = flattenDeep(
    paths.map(path => ['content', path]).concat(['op']),
  );
  const targetLens = lens(lensPath);
  return set(targetLens, newOpName, sqon);
};

export const setSqonAtPath = (paths, newSqon) => sqon => {
  const lensPath = flattenDeep(paths.map(path => ['content', path]));
  const targetLens = lens(lensPath);
  return set(targetLens, newSqon, sqon);
};

export const DisplayNameMapContext = React.createContext({});
