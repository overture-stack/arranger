import React from 'react';
import PropTypes from 'prop-types';
import { cloneDeep } from 'lodash';
import Component from 'react-component-component';
import { PROJECT_ID } from '../utils/config';
import SqonEntry from './SqonEntry';
import {
  resolveSyntheticSqon,
  removeSqonAtIndex,
  isIndexReferencedInSqon,
  DisplayNameMapContext,
} from './utils';
import './style.css';
import defaultApi from '../utils/api';
import FaRegClone from 'react-icons/lib/fa/clone';
import FaPlusCircle from 'react-icons/lib/fa/plus-circle';

const defaultSqonDeletionHandler = ({
  indexToRemove,
  dependentIndices,
  internalStateContainer: s,
}) =>
  new Promise((resolve, reject) => {
    s.setState({
      deletingIndex: indexToRemove,
      onSqonDeleteConfirmed: () => {
        s.setState({
          deletingIndex: null,
          deletingIndex: null,
          onSqonDeleteConfirmed: null,
        });
        resolve();
      },
      onSqonDeleteCancel: () => {
        s.setState({
          deletingIndex: null,
          deletingIndex: null,
          onSqonDeleteConfirmed: null,
        });
        reject();
      },
    });
  });

const AdvancedSqonBuilder = ({
  arrangerProjectId = PROJECT_ID,
  arrangerProjectIndex,
  syntheticSqons = [],
  activeSqonIndex = 0,
  FieldOpModifierContainer = undefined,
  SqonActionComponent = ({ sqonIndex, isActive, isSelected, isHoverring }) =>
    null,
  onChange = ({ newSyntheticSqons }) => {},
  onActiveSqonSelect = ({ index }) => {},
  fieldDisplayNameMap = {},
  ButtonComponent = ({ className, ...rest }) => (
    <button className={`button ${className}`} {...rest} />
  ),
  getSqonDeleteConfirmation = defaultSqonDeletionHandler,
  api = defaultApi,
  referenceColors = [
    '#cbeefb',
    '#fce8d3',
    '#eed5e9',
    '#cbebf1',
    '#f9d3d4',
    '#d5d7e9',
    '#fad9ea',
    '#f3ebd0',
  ],
}) => {
  /**
   * "initialState" is used in 'react-component-component', which provides a
   * layer of state container, named 's', which consists of:
   * {state, setState}
   */
  const initialState = {
    selectedSqonIndices: [],

    // the followings are to support defaultSqonDeletionHandler
    deletingIndex: null,
    onSqonDeleteConfirmed: null,
    onSqonDeleteCancel: null,
  };

  const lastSqon = syntheticSqons[Math.max(syntheticSqons.length - 1, 0)];
  const selectedSyntheticSqon = syntheticSqons[activeSqonIndex];
  const allowsNewSqon = !(!lastSqon ? false : !lastSqon.content.length);

  const getColorForReference = referenceIndex =>
    referenceColors[referenceIndex % referenceColors.length];
  const isSqonReferenced = sqonIndex =>
    isIndexReferencedInSqon(selectedSyntheticSqon)(sqonIndex);

  const clearSqonDeletion = s => {
    s.setState({
      deletingIndex: null,
      onSqonDeleteConfirmed: null,
      onSqonDeleteCancel: null,
    });
  };

  const dispatchSqonListChange = s => ({
    eventKey,
    newSqonList,
    eventDetails,
  }) => {
    clearSqonDeletion(s);
    // wraps in promise to delay to allow delaying to next frame
    return Promise.resolve(
      onChange({
        eventKey,
        eventDetails,
        newSyntheticSqons: newSqonList,
      }),
    );
  };
  const onSelectedSqonIndicesChange = s => index => () => {
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
  const onSqonRemove = s => indexToRemove => () => {
    return getSqonDeleteConfirmation({
      internalStateContainer: s,
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
        onActiveSqonSelect({
          index: Math.max(
            Math.min(syntheticSqons.length - 2, indexToRemove),
            0,
          ),
        }),
      )
      .then(() =>
        dispatchSqonListChange(s)({
          eventKey: 'SQON_REMOVED',
          eventDetails: {
            removedIndex: indexToRemove,
          },
          newSqonList: removeSqonAtIndex(indexToRemove, syntheticSqons),
        }),
      )
      .catch(() => {});
  };
  const onSqonDuplicate = s => indexToDuplicate => () => {
    dispatchSqonListChange(s)({
      eventKey: 'SQON_DUPLICATED',
      eventDetails: {
        duplicatedIndex: indexToDuplicate,
      },
      newSqonList: [
        ...syntheticSqons,
        cloneDeep(syntheticSqons[indexToDuplicate]),
      ],
    }).then(() => onActiveSqonSelect({ index: syntheticSqons.length }));
  };
  const createUnionSqon = s => () => {
    dispatchSqonListChange(s)({
      eventKey: 'NEW_UNION_COMBINATION',
      eventDetails: {
        referencedIndices: s.state.selectedSqonIndices,
      },
      newSqonList: [
        ...syntheticSqons,
        {
          op: 'or',
          content: s.state.selectedSqonIndices,
        },
      ],
    }).then(() => onActiveSqonSelect({ index: syntheticSqons.length }));
  };
  const createIntersectSqon = s => () => {
    dispatchSqonListChange(s)({
      eventKey: 'NEW_INTERSECTION_COMBINATION',
      eventDetails: {
        referencedIndices: s.state.selectedSqonIndices,
      },
      newSqonList: [
        ...syntheticSqons,
        {
          op: 'and',
          content: s.state.selectedSqonIndices,
        },
      ],
    })
      .then(() => onActiveSqonSelect({ index: syntheticSqons.length }))
      .then(() => {
        s.setState({
          selectedSqonIndices: [],
        });
        clearSqonDeletion(s);
      });
  };
  const onNewQueryClick = s => () => {
    if (allowsNewSqon) {
      dispatchSqonListChange(s)({
        eventKey: 'NEW_SQON',
        eventDetails: {},
        newSqonList: [
          ...syntheticSqons,
          {
            op: 'and',
            content: [],
          },
        ],
      })
        .then(() => onActiveSqonSelect({ index: syntheticSqons.length }))
        .then(() => {
          s.setState({
            selectedSqonIndices: [],
          });
          clearSqonDeletion(s);
        });
    }
  };
  const onClearAllClick = s => () => {
    dispatchSqonListChange(s)({
      eventKey: 'CLEAR_ALL',
      eventDetails: {},
      newSqonList: [],
    });
    s.setState({ selectedSqonIndices: [] });
    clearSqonDeletion(s);
    onActiveSqonSelect({ index: 0 });
  };

  const onSqonEntryActivate = s => sqonIndex => () => {
    if (sqonIndex !== activeSqonIndex) {
      if (sqonIndex !== s.state.deletingIndex) {
        clearSqonDeletion(s);
      }
      onActiveSqonSelect({
        index: sqonIndex,
      });
    }
  };
  const onSqonChange = s => sqonIndex => newSqon => {
    dispatchSqonListChange(s)({
      eventKey: 'SQON_CHANGE',
      eventDetails: {
        updatedIndex: sqonIndex,
      },
      newSqonList: syntheticSqons.map(
        (sq, i) => (i === sqonIndex ? newSqon : sq),
      ),
    });
  };
  const getActiveExecutableSqon = () =>
    resolveSyntheticSqon(syntheticSqons)(selectedSyntheticSqon);

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
                api={api}
                disabled={!allowsNewSqon && i === syntheticSqons.length - 1}
                getColorForReference={getColorForReference}
                isReferenced={isSqonReferenced(i)}
                isIndexReferenced={isIndexReferencedInSqon(
                  selectedSyntheticSqon,
                )}
                isDeleting={s.state.deletingIndex === i}
                onSqonChange={onSqonChange(s)(i)}
                onSqonCheckedChange={onSelectedSqonIndicesChange(s)(i)}
                onSqonDuplicate={onSqonDuplicate(s)(i)}
                onSqonRemove={onSqonRemove(s)(i)}
                onActivate={onSqonEntryActivate(s)(i)}
                onDeleteConfirmed={s.state.onSqonDeleteConfirmed || (() => {})}
                onDeleteCanceled={s.state.onSqonDeleteCancel || (() => {})}
              />
            ))}
            <div>
              <button
                className={`sqonListActionButton removeButton`}
                disabled={!allowsNewSqon}
                onClick={onNewQueryClick(s)}
              >
                <FaPlusCircle />
                {` `}Start new query
              </button>
              <button
                className={`sqonListActionButton duplicateButton`}
                disabled={
                  selectedSyntheticSqon
                    ? !selectedSyntheticSqon.content.length
                    : false
                }
                onClick={onSqonDuplicate(s)(activeSqonIndex)}
              >
                <FaRegClone />
                {` `}Duplicate Query
              </button>
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
  referenceColors: PropTypes.arrayOf(PropTypes.string),
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
  isIndexReferencedInSqon,
} from './utils';
export { default as FieldOpModifier } from './filterComponents/index';
