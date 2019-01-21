import React from 'react';
import Component from 'react-component-component';
import SqonEntry from './SqonEntry';
import {
  resolveSyntheticSqon,
  removeSqonAtIndex,
  duplicateSqonAtIndex,
  isEmptySqon,
  DisplayNameMapContext,
  removeSqonPath,
} from './utils';
import './style.css';

export {
  resolveSyntheticSqon,
  removeSqonAtIndex,
  duplicateSqonAtIndex,
  isReference,
  isValueObj,
  isBooleanOp,
  isFieldOp,
} from './utils';
export default ({
  syntheticSqons = [],
  activeSqonIndex = 0,
  SqonActionComponent = ({ sqonIndex, isActive, isSelected }) => null,
  onChange = ({ newSyntheticSqons, sqonValues }) => {},
  onActiveSqonSelect = ({ index, sqonValue }) => {},
  fieldDisplayNameMap = {},
  ButtonComponent = ({ className, ...rest }) => (
    <button className={`button ${className}`} {...rest} />
  ),
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
        selectedSqonIndices: [...s.state.selectedSqonIndices, index].sort(),
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
      dependentIndices: syntheticSqons.reduce((acc, sq, i) => {
        if (sq) {
          if (sq.content.includes(indexToRemove)) {
            acc.push(i);
          }
        }
        return acc;
      }, []),
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
  const onClearAllClick = s => () => {
    dispatchSqonListChange([]);
    s.setState({ selectedSqonIndices: [] });
    onActiveSqonSelect({ index: 0, sqonValue: null });
  };
  const onNewQueryClick = () => {
    dispatchSqonListChange([...syntheticSqons, null]);
  };

  const onDisabledOverlayClick = sqonIndex => () => {
    onActiveSqonSelect({
      index: sqonIndex,
      sqonValue: resolveSyntheticSqon(syntheticSqons)(
        syntheticSqons[sqonIndex],
      ),
    });
  };
  const onFieldOpRemoved = sqonIndex => removedPath => {
    dispatchSqonListChange(
      syntheticSqons.map((sq, i) => {
        return i === sqonIndex ? removeSqonPath(removedPath)(sq) : sq;
      }),
    );
  };
  return (
    <DisplayNameMapContext.Provider value={fieldDisplayNameMap}>
      <Component initialState={initialState}>
        {s => (
          <div className={`sqonBuilder`}>
            <div className={`actionHeaderContainer`}>
              <div>
                <span>Combine Queries: </span>
                <span>
                  <ButtonComponent
                    className={`and`}
                    disabled={!s.state.selectedSqonIndices.length}
                    onClick={createIntersectSqon(s)}
                  >
                    and
                  </ButtonComponent>
                  <ButtonComponent
                    className={`or`}
                    disabled={!s.state.selectedSqonIndices.length}
                    onClick={createUnionSqon(s)}
                  >
                    or
                  </ButtonComponent>
                </span>
              </div>
              <div>
                <ButtonComponent onClick={onClearAllClick(s)}>
                  CLEAR ALL
                </ButtonComponent>
              </div>
            </div>
            {syntheticSqons.map((sq, i) => (
              <SqonEntry
                key={i}
                index={i}
                allSyntheticSqons={syntheticSqons}
                onFieldOpRemove={onFieldOpRemoved(i)}
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
            <div>
              <button onClick={onNewQueryClick}>Start new query</button>
            </div>
          </div>
        )}
      </Component>
    </DisplayNameMapContext.Provider>
  );
};
