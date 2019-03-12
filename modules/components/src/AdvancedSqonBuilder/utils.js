import React from 'react';
import { cloneDeep } from 'lodash';
import { view, set, lensPath as lens } from 'ramda';
import { flattenDeep } from 'lodash';

/**
 * todo: these magic sqon values should be centralized across Arranger
 */
export const GT_OP = '>';
export const LT_OP = '<';
export const BETWEEN_OP = 'between';
export const GTE_OP = '>=';
export const LTE_OP = '<=';
export const IN_OP = 'in';
export const NOT_IN_OP = 'not-in';
export const ALL_OP = 'all';
export const FIELD_OP = [
  GT_OP,
  LT_OP,
  BETWEEN_OP,
  GTE_OP,
  LTE_OP,
  IN_OP,
  NOT_IN_OP,
  ALL_OP,
];
export const RANGE_OPS = [GT_OP, LT_OP, BETWEEN_OP, GTE_OP, LTE_OP];
export const TERM_OPS = [IN_OP, ALL_OP, NOT_IN_OP];

export const AND_OP = 'and';
export const OR_OP = 'or';
export const NOT_OP = 'not';
export const BOOLEAN_OPS = [AND_OP, OR_OP, NOT_OP];
export const FIELD_OP_DISPLAY_NAME = {
  [IN_OP]: 'any of',
  [NOT_IN_OP]: 'not',
  [ALL_OP]: 'all of',
  [GTE_OP]: 'greater than or equal to',
  [LTE_OP]: 'less than or equal to',
  [LT_OP]: 'less than',
  [GT_OP]: 'greater than',
  [BETWEEN_OP]: 'between',
};

/**
 * Utilities for determining the type of sqon object
 */
export const isEmptySqon = sqonObj =>
  !sqonObj
    ? true
    : BOOLEAN_OPS.includes(sqonObj.op) && !Boolean(sqonObj.content.length);
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
    paths.slice(0, paths.length - 1).map(path => ['content', path]),
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

export const isIndexReferencedInSqon = syntheticSqon => indexReference => {
  if (isBooleanOp(syntheticSqon)) {
    return syntheticSqon.content.reduce(
      (acc, contentSqon) =>
        acc || isIndexReferencedInSqon(contentSqon)(indexReference),
      false,
    );
  } else {
    return syntheticSqon === indexReference;
  }
};

export const doesContainReference = sqon => {
  if (isBooleanOp(sqon)) {
    return sqon.content.some(doesContainReference);
  } else {
    return isReference(sqon);
  }
};

export const getDependentIndices = syntheticSqons => index =>
  syntheticSqons.reduce((acc, sq, i) => {
    if (sq && isIndexReferencedInSqon(sq)(index)) {
      acc.push(i);
    }
    return acc;
  }, []);

export const setSqonAtPath = (paths, newSqon) => sqon => {
  const lensPath = flattenDeep(paths.map(path => ['content', path]));
  const targetLens = lens(lensPath);
  return set(targetLens, newSqon, sqon);
};

export const DisplayNameMapContext = React.createContext({});
