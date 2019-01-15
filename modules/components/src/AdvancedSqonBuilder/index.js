import React from 'react';
import { cloneDeep } from 'apollo-utilities';
import Component from 'react-component-component';
import SqonEntry from './SqonEntry';

const BOOLEAN_OPS = ['and', 'or', 'not'];

const FIELD_OP = ['in', 'gte', 'lte'];

export default ({
  sqons,
  activeSqonIndex,
  SqonActionComponent = ({ sqon, isActive, isSelected }) => null,
  onChange = ({ sqons }) => {},
  onActiveSqonSelect = ({ index }) => {},
}) => {
  const initialState = {
    selectedSqons: [],
  };
  const onSqonSelectionChange = (sqon, s) => () => {
    if (!s.state.selectedSqons.includes(sqon)) {
      s.setState({ selectedSqons: [...s.state.selectedSqons, sqon] });
    } else {
      s.setState({
        selectedSqons: s.state.selectedSqons.filter(sq => sq !== sqon),
      });
    }
  };
  const onSqonRemove = sqon => () => {
    onChange({ sqons: sqons.filter(s => s !== sqon) });
  };
  const onSqonDuplicate = sqon => () => {
    const index = sqons.findIndex(s => s === sqon);
    onChange({
      sqons: [
        ...sqons.slice(0, index),
        cloneDeep(sqon),
        ...sqons.slice(index, sqons.length),
      ],
    });
  };
  const createUnionSqon = s => () => {
    onChange({
      sqons: [
        ...sqons,
        {
          op: 'or',
          content: s.state.selectedSqons.map(sq => sqons.find(s => s === sq)),
        },
      ],
    });
  };
  const createIntersectSqon = s => () => {
    onChange({
      sqons: [
        ...sqons,
        {
          op: 'and',
          content: s.state.selectedSqons.map(sq => sqons.find(s => s === sq)),
        },
      ],
    });
  };
  const onDisabledOverlayClick = ({ sqonIndex }) => () =>
    onActiveSqonSelect({ index: sqonIndex });

  const onClearAllClick = s => () => {
    onChange({
      sqons: [],
    });
    s.setState({
      selectedSqons: [],
    });
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
                  disabled={!s.state.selectedSqons.length}
                  onClick={createUnionSqon(s)}
                >
                  union
                </button>
                <button
                  disabled={!s.state.selectedSqons.length}
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
              onSqonSelectionChange={onSqonSelectionChange(sqon, s)}
              onSqonDuplicate={onSqonDuplicate(sqon)}
              onSqonRemove={onSqonRemove(sqon)}
              onDisabledOverlayClick={onDisabledOverlayClick({
                sqonIndex: i,
              })}
              isActiveSqon={isActiveSqon(sqon)}
              isSelected={s.state.selectedSqons.includes(sqon)}
            />
          ))}
        </div>
      )}
    </Component>
  );
};
