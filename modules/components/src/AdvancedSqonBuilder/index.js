import React from 'react';
import Component from 'react-component-component';
import SqonEntry from './SqonEntry';
import {
  resolveSyntheticSqon,
  removeSqonAtIndex,
  duplicateSqonAtIndex,
} from './utils';

export {
  resolveSyntheticSqon,
  removeSqonAtIndex,
  duplicateSqonAtIndex,
} from './utils';
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
  const onSqonRemove = indexToRemove => () => {
    return getSqonDeleteConfirmation({
      indexToRemove,
      dependentIndices: sqons
        .filter(({ content }) => content.includes(indexToRemove))
        .map(sq => sqons.indexOf(sq)),
    })
      .then(() =>
        dispatchSqonListChange(removeSqonAtIndex(indexToRemove, sqons)),
      )
      .catch(() => {});
  };
  const onSqonDuplicate = sqon => () => {
    const index = sqons.findIndex(s => s === sqon);
    dispatchSqonListChange(duplicateSqonAtIndex(index, sqons));
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
              index={i}
              sqon={sqon}
              SqonActionComponent={SqonActionComponent}
              onSqonCheckedChange={onSelectedSqonIndicesChange(i, s)}
              onSqonDuplicate={onSqonDuplicate(sqon)}
              onSqonRemove={onSqonRemove(i)}
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
