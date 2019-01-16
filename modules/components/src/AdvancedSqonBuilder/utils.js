const BOOLEAN_OPS = ['and', 'or', 'not'];

const FIELD_OP = ['in', 'gte', 'lte'];

/**
 * A synthetic sqon may look like: { "op": "and", "content": [1, 0, 2] }
 * where [1, 0, 2] is a list of index references to other sqons in a list
 * of given sqons. resolveSyntheticSqon resolves a synthetic sqon to an
 * executable sqon.
 **/
export const resolveSyntheticSqon = allSqons => syntheticSqon => {
  if (BOOLEAN_OPS.includes(syntheticSqon.op)) {
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
 * synthetic sqons "sqonList".
 **/
export const removeSqonAtIndex = (indexToRemove, sqonList) => {
  return sqonList
    .filter((s, i) => i !== indexToRemove) // takes out the removed sqon
    .map(sq => ({
      // removes references to the removed sqon
      ...sq,
      content: sq.content
        .filter(
          // removes references
          content => content !== indexToRemove,
        )
        .map(
          // shifts references to indices greater than the removed one
          s => (!isNaN(s) ? (s > indexToRemove ? s - 1 : s) : s),
        ),
    }));
};
