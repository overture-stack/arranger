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
  getDependentIndices,
  DisplayNameMapContext,
  isEmptySqon,
  AND_OP,
  OR_OP,
} from './utils';
import './style.css';
import defaultApi from '../utils/api';
import FaRegClone from 'react-icons/lib/fa/clone';
import FaPlusCircle from 'react-icons/lib/fa/plus-circle';

const newEmptySqon = () => ({
  op: AND_OP,
  content: [],
});

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

const AdvancedSqonBuilder = props => {
  const {
    arrangerProjectId = PROJECT_ID,
    arrangerProjectIndex,
    syntheticSqons = [],
    activeSqonIndex: currentActiveSqonIndex = 0,
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
    emptyEntryMessage = null,
  } = props;

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

  const selectedSyntheticSqon = syntheticSqons[currentActiveSqonIndex];
  const allowsNewSqon = !syntheticSqons.some(isEmptySqon);

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
    if (
      !s.state.selectedSqonIndices.includes(index) &&
      !isEmptySqon(syntheticSqons[index])
    ) {
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

  const removeSqon = s => indexToRemove => {
    onActiveSqonSelect({
      index: Math.max(Math.min(syntheticSqons.length - 2, indexToRemove), 0),
    });
    const sqonListWithIndexRemoved = removeSqonAtIndex(
      indexToRemove,
      syntheticSqons,
    );
    return dispatchSqonListChange(s)({
      eventKey: 'SQON_REMOVED',
      eventDetails: {
        removedIndex: indexToRemove,
      },
      newSqonList: sqonListWithIndexRemoved.length
        ? sqonListWithIndexRemoved
        : [newEmptySqon()],
    });
  };

  const onSqonRemove = s => indexToRemove => () => {
    return getSqonDeleteConfirmation({
      internalStateContainer: s,
      indexToRemove,
      dependentIndices: getDependentIndices(syntheticSqons)(indexToRemove),
    })
      .then(() => removeSqon(s)(indexToRemove))
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
          op: OR_OP,
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
  const createIntersectSqon = s => () => {
    dispatchSqonListChange(s)({
      eventKey: 'NEW_INTERSECTION_COMBINATION',
      eventDetails: {
        referencedIndices: s.state.selectedSqonIndices,
      },
      newSqonList: [
        ...syntheticSqons,
        {
          op: AND_OP,
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
        newSqonList: [...syntheticSqons, newEmptySqon()],
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
      newSqonList: [newEmptySqon()],
    });
    s.setState({ selectedSqonIndices: [] });
    clearSqonDeletion(s);
    onActiveSqonSelect({ index: 0 });
  };

  const onSqonEntryActivate = s => nextActiveSqonIndex => () => {
    if (nextActiveSqonIndex !== currentActiveSqonIndex) {
      onActiveSqonSelect({
        index: nextActiveSqonIndex,
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
    if (!newSqon.content.length) {
      removeSqon(s)(sqonIndex);
    }
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
                api={api}
                arrangerProjectId={arrangerProjectId}
                arrangerProjectIndex={arrangerProjectIndex}
                syntheticSqon={sq}
                isActiveSqon={i === currentActiveSqonIndex}
                isSelected={s.state.selectedSqonIndices.includes(i)}
                isReferenced={isSqonReferenced(i)}
                isIndexReferenced={isIndexReferencedInSqon(
                  selectedSyntheticSqon,
                )}
                isDeleting={s.state.deletingIndex === i}
                disabled={isEmptySqon(sq)}
                SqonActionComponent={SqonActionComponent}
                FieldOpModifierContainer={FieldOpModifierContainer}
                getActiveExecutableSqon={getActiveExecutableSqon}
                getColorForReference={getColorForReference}
                dependentIndices={getDependentIndices(syntheticSqons)(i)}
                onSqonChange={onSqonChange(s)(i)}
                onSqonCheckedChange={onSelectedSqonIndicesChange(s)(i)}
                onSqonDuplicate={onSqonDuplicate(s)(i)}
                onSqonRemove={onSqonRemove(s)(i)}
                onActivate={onSqonEntryActivate(s)(i)}
                onDeleteConfirmed={s.state.onSqonDeleteConfirmed || (() => {})}
                onDeleteCanceled={s.state.onSqonDeleteCancel || (() => {})}
                emptyEntryMessage={emptyEntryMessage}
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
                onClick={onSqonDuplicate(s)(currentActiveSqonIndex)}
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
  emptyEntryMessage: PropTypes.node,
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
  getDependentIndices,
} from './utils';
export { default as FieldOpModifier } from './filterComponents/index';
