import React from 'react';
import PropTypes from 'prop-types';
import Component from 'react-component-component';
import { PROJECT_ID } from '../utils/config';
import SqonEntry from './SqonEntry';
import {
  resolveSyntheticSqon,
  removeSqonAtIndex,
  duplicateSqonAtIndex,
  DisplayNameMapContext,
} from './utils';
import './style.css';
import defaultApi from '../utils/api';

const AdvancedSqonBuilder = ({
  arrangerProjectId = PROJECT_ID,
  arrangerProjectIndex,
  syntheticSqons = [],
  activeSqonIndex = 0,
  FieldOpModifierContainer = undefined,
  SqonActionComponent = ({ sqonIndex, isActive, isSelected, isHoverring }) =>
    null,
  onChange = ({ newSyntheticSqons, sqonValues }) => {},
  onActiveSqonSelect = ({ index, sqonValue }) => {},
  fieldDisplayNameMap = {},
  ButtonComponent = ({ className, ...rest }) => (
    <button className={`button ${className}`} {...rest} />
  ),
  getSqonDeleteConfirmation = ({ indexToRemove, dependentIndices }) =>
    Promise.resolve(),
  api = defaultApi,
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
    });
  };
  const onSqonChange = sqonIndex => newSqon => {
    dispatchSqonListChange(
      syntheticSqons.map((sq, i) => {
        return i === sqonIndex ? newSqon : sq;
      }),
    );
  };
  const getActiveExecutableSqon = () => {
    return resolveSyntheticSqon(syntheticSqons)(
      syntheticSqons[activeSqonIndex],
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
                arrangerProjectId={arrangerProjectId}
                arrangerProjectIndex={arrangerProjectIndex}
                allSyntheticSqons={syntheticSqons}
                syntheticSqon={sq}
                isActiveSqon={i === activeSqonIndex}
                isSelected={s.state.selectedSqonIndices.includes(i)}
                SqonActionComponent={SqonActionComponent}
                FieldOpModifierContainer={FieldOpModifierContainer}
                getActiveExecutableSqon={getActiveExecutableSqon}
                onSqonChange={onSqonChange(i)}
                onSqonCheckedChange={onSelectedSqonIndicesChange(i, s)}
                onSqonDuplicate={onSqonDuplicate(i)}
                onSqonRemove={onSqonRemove(i)}
                onDisabledOverlayClick={onDisabledOverlayClick(i)}
                api={api}
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

AdvancedSqonBuilder.propTypes = {
  arrangerProjectId: PropTypes.string,
  arrangerProjectIndex: PropTypes.string.isRequired,
  syntheticSqons: PropTypes.arrayOf(PropTypes.object),
  activeSqonIndex: PropTypes.number,
  FieldOpModifierContainer: PropTypes.any,
  SqonActionComponent: PropTypes.any,
  onChange: PropTypes.func,
  onActiveSqonSelect: PropTypes.func,
  fieldDisplayNameMap: PropTypes.objectOf(PropTypes.string),
  ButtonComponent: PropTypes.any,
  getSqonDeleteConfirmation: PropTypes.func,
  api: PropTypes.func,
};

export default AdvancedSqonBuilder;
export {
  resolveSyntheticSqon,
  removeSqonAtIndex,
  duplicateSqonAtIndex,
  isReference,
  isValueObj,
  isBooleanOp,
  isFieldOp,
} from './utils';
export { default as FieldOpModifier } from './filterComponents/index';
