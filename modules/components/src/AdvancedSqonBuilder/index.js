import React from 'react';
import SQONView from '../SQONView';
import { cloneDeep } from 'apollo-utilities';
import Component from 'react-component-component';

const BOOLEAN_OPS = ['and', 'or', 'not'];

const FIELD_OP = ['in', 'gte', 'lte'];

export default ({
  sqons,
  activeSqonIndex,
  SqonActionComponent = ({ sqon }) => {},
  onChange = ({ sqons }) => {},
}) => {
  /**
   * local states
   */
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

  /**
   * parent state modifiers
   */
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
          content: [...s.state.selectedSqons],
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
          content: [...s.state.selectedSqons],
        },
      ],
    });
  };

  return (
    <Component initialState={initialState}>
      {s => (
        <div>
          <div>
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
          </div>
          {sqons.map((sqon, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'row' }}>
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
                  isActive={activeSqonIndex === i}
                />
              </div>
              <div>
                <button onClick={onSqonDuplicate(sqon)}>dup</button>
                <button onClick={onSqonRemove(sqon)}>delete</button>
                <SqonActionComponent sqon={sqon} />
              </div>
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
      <div style={{ flex: 1 }}>
        <SQONView sqon={sqon} />
      </div>
    </div>
  );
};
