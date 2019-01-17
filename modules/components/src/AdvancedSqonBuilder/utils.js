import { cloneDeep } from 'lodash';

export const BOOLEAN_OPS = ['and', 'or', 'not'];
export const FIELD_OP = ['in', '>=', '<='];

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
  } else if (BOOLEAN_OPS.includes(syntheticSqon.op)) {
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
