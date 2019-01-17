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
  syntheticSqons = [],
  activeSqonIndex = 0,
  SqonActionComponent = ({ sqonIndex, isActive, isSelected }) => null,
  onChange = ({ newSyntheticSqons, sqonValues }) => {},
  onActiveSqonSelect = ({ index, sqonValue }) => {},
  getSqonDeleteConfirmation = ({ indexToRemove, dependentIndices }) =>
    Promise.resolve(),
}) => {
  /**
   * "initialState" is used in 'react-component-component', which provides a
   * layer of state container, named 's', which consists of:
   * {state, setState}
   */
  const initialState = {
    selectedSqonIndices: [],
  };

  const dispatchSqonListChange = newSqonList => {
    onChange({
      newSyntheticSqons: newSqonList,
      sqonValues: newSqonList.map(resolveSyntheticSqon(syntheticSqons)),
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
      dependentIndices: syntheticSqons
        .filter(({ content }) => content.includes(indexToRemove))
        .map(sq => syntheticSqons.indexOf(sq)),
    })
      .then(() =>
        dispatchSqonListChange(
          removeSqonAtIndex(indexToRemove, syntheticSqons),
        ),
      )
      .catch(() => {});
  };
  const onSqonDuplicate = indexToDuplicate => () => {
    dispatchSqonListChange(
      duplicateSqonAtIndex(indexToDuplicate, syntheticSqons),
    );
  };
  const createUnionSqon = s => () => {
    dispatchSqonListChange([
      ...syntheticSqons,
      {
        op: 'or',
        content: s.state.selectedSqonIndices,
      },
    ]);
  };
  const createIntersectSqon = s => () => {
    dispatchSqonListChange([
      ...syntheticSqons,
      {
        op: 'and',
        content: s.state.selectedSqonIndices,
      },
    ]);
  };
  const onDisabledOverlayClick = sqonIndex => () => {
    onActiveSqonSelect({
      index: sqonIndex,
      sqonValue: resolveSyntheticSqon(syntheticSqons)(
        syntheticSqons[sqonIndex],
      ),
    });
  };
  const onClearAllClick = s => () => {
    dispatchSqonListChange([]);
    s.setState({
      selectedSqonIndices: [],
    });
    onActiveSqonSelect({ index: 0, sqonValue: null });
  };

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
          {syntheticSqons.map((sq, i) => (
            <SqonEntry
              key={i}
              index={i}
              allSyntheticSqons={syntheticSqons}
              syntheticSqon={sq}
              isActiveSqon={i === activeSqonIndex}
              isSelected={s.state.selectedSqonIndices.includes(i)}
              SqonActionComponent={SqonActionComponent}
              onSqonCheckedChange={onSelectedSqonIndicesChange(i, s)}
              onSqonDuplicate={onSqonDuplicate(i)}
              onSqonRemove={onSqonRemove(i)}
              onDisabledOverlayClick={onDisabledOverlayClick(i)}
            />
          ))}
        </div>
      )}
    </Component>
  );
};
