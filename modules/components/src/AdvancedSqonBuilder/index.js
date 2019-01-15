import React from 'react';
import SQONView from '../SQONView';
import { cloneDeep } from 'apollo-utilities';
import Component from 'react-component-component';

const BOOLEAN_OPS = ['and', 'or', 'not'];

const FIELD_OP = ['in', 'gte', 'lte'];

export default ({
  sqons,
  activeSqonIndex,
  SqonActionComponent = ({ sqon, isActive, isSelected }) => {},
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
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'row',
                position: 'relative',
                background: !isActiveSqon(sqon) ? 'lightgrey' : 'white',
              }}
            >
              <div onClick={onSqonSelectionChange(sqon, s)}>
                <input
                  readOnly
                  type="checkbox"
                  checked={s.state.selectedSqons.includes(sqon)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <SingleSqonBuilder
                  sqon={sqon}
                  isActive={isActiveSqon(sqon)}
                  isSelected={s.state.selectedSqons.includes(sqon)}
                />
              </div>
              <div>
                <button
                  disabled={!isActiveSqon(sqon)}
                  onClick={onSqonDuplicate(sqon)}
                >
                  dup
                </button>
                <button
                  disabled={!isActiveSqon(sqon)}
                  onClick={onSqonRemove(sqon)}
                >
                  delete
                </button>
                <SqonActionComponent
                  sqon={sqon}
                  isActive={isActiveSqon(sqon)}
                />
              </div>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  pointerEvents: isActiveSqon(sqon) ? 'none' : 'all',
                }}
                onClick={onDisabledOverlayClick({ sqonIndex: i })}
              />
            </div>
          ))}
        </div>
      )}
    </Component>
  );
};

const SingleSqonBuilder = ({ sqon }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'row' }}>
      <div style={{ flex: 1 }}>{JSON.stringify(sqon)}</div>
    </div>
  );
};
