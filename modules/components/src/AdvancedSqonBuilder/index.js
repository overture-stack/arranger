import React from 'react';
import { cloneDeep } from 'apollo-utilities';
import Component from 'react-component-component';
import SqonEntry from './SqonEntry';

const BOOLEAN_OPS = ['and', 'or', 'not'];

const FIELD_OP = ['in', 'gte', 'lte'];

/**
 * A synthetic sqon may look like: { "op": "and", "content": [1, 0, 2] }
 * where [1, 0, 2] is a list of index references to other sqons in a list
 * of given sqons. resolveSyntheticSqon resolves a synthetic sqon to an
 * executable sqon.
 **/
const resolveSyntheticSqon = allSqons => syntheticSqon => {
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

export default ({
  sqons,
  activeSqonIndex,
  SqonActionComponent = ({ sqon, isActive, isSelected }) => null,
  onChange = ({ sqons, sqonValues }) => {},
  onActiveSqonSelect = ({ index }) => {},
  getSqonDeleteConfirmation = ({ sqon, dependents }) => Promise.resolve(),
}) => {
  const initialState = {
    selectedSqonIndices: [],
  };
  const dispatchSqonListChange = newSqonList => {
    onChange({
      sqons: newSqonList,
      sqonValues: newSqonList.map(resolveSyntheticSqon(sqons)),
    });
  };
  const onSelectedSqonIndicesChange = (index, s) => () => {
    if (!s.state.selectedSqonIndices.includes(index)) {
      s.setState({
        selectedSqonIndices: [...s.state.selectedSqonIndices, index],
      });
    } else {
      s.setState({
        selectedSqonIndices: s.state.selectedSqonIndices.filter(
          i => i !== index,
        ),
      });
    }
  };
  const onSqonRemove = sqon => () => {
    return getSqonDeleteConfirmation({
      sqon,
      dependents: sqons.filter(({ content }) =>
        content.includes(sqons.indexOf(sqon)),
      ),
    })
      .then(() => dispatchSqonListChange(sqons.filter(s => s !== sqon)))
      .catch(() => {});
  };
  const onSqonDuplicate = sqon => () => {
    const index = sqons.findIndex(s => s === sqon);
    dispatchSqonListChange([
      ...sqons.slice(0, index),
      cloneDeep(sqon),
      ...sqons.slice(index, sqons.length),
    ]);
  };
  const createUnionSqon = s => () => {
    dispatchSqonListChange([
      ...sqons,
      {
        op: 'or',
        content: s.state.selectedSqonIndices,
      },
    ]);
  };
  const createIntersectSqon = s => () => {
    dispatchSqonListChange([
      ...sqons,
      {
        op: 'and',
        content: s.state.selectedSqonIndices,
      },
    ]);
  };
  const onDisabledOverlayClick = ({ sqonIndex }) => () => {
    onActiveSqonSelect({
      index: sqonIndex,
      sqonValue: resolveSyntheticSqon(sqons)(sqons[sqonIndex]),
    });
  };
  const onClearAllClick = s => () => {
    dispatchSqonListChange([]);
    s.setState({
      selectedSqonIndices: [],
    });
    onActiveSqonSelect({ index: 0 });
  };

  const isActiveSqon = sqon => sqons.indexOf(sqon) === activeSqonIndex;

  return (
    <Component initialState={initialState}>
      {s => (
        <div>
          <div>
            <div>
              <span>Combine Queries: </span>
              <span>
                <button
                  disabled={!s.state.selectedSqonIndices.length}
                  onClick={createUnionSqon(s)}
                >
                  union
                </button>
                <button
                  disabled={!s.state.selectedSqonIndices.length}
                  onClick={createIntersectSqon(s)}
                >
                  intersect
                </button>
              </span>
            </div>
            <div>
              <button onClick={onClearAllClick(s)}>CLEAR ALL</button>
            </div>
          </div>
          {sqons.map((sqon, i) => (
            <SqonEntry
              key={i}
              sqon={sqon}
              SqonActionComponent={SqonActionComponent}
              onSqonCheckedChange={onSelectedSqonIndicesChange(i, s)}
              onSqonDuplicate={onSqonDuplicate(sqon)}
              onSqonRemove={onSqonRemove(sqon)}
              onDisabledOverlayClick={onDisabledOverlayClick({
                sqonIndex: i,
              })}
              isActiveSqon={isActiveSqon(sqon)}
              isSelected={s.state.selectedSqonIndices.includes(i)}
            />
          ))}
        </div>
      )}
    </Component>
  );
};
