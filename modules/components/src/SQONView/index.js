// @flow
import React from 'react';
// $FlowIgnore
import { take, xor } from 'lodash';
import {
  compose,
  withState,
  withProps,
  withHandlers,
  defaultProps,
// $FlowIgnore
} from 'recompose';

import { Row, Column } from '../Flex';
import { toggleSQON } from './utils';
import type { TGroupSQON, TValueSQON } from './types';

const Bubble = ({ children, style, ...props }) => (
  <div
    style={{
      padding: '6px 6px',
      borderRadius: '4px',
      color: 'white',
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

export const Field = ({ children, style, ...props }: { style?: Object, children?: mixed }) => (
  <Bubble
    className="sqon-field"
    style={{ backgroundColor: '#3FC5ED', ...style }}
    {...props}
  >
    {children}
  </Bubble>
);

export const Op = ({ children, style, ...props }: { style?: Object, children?: mixed }) => (
  <Bubble
    className="sqon-op"
    style={{ backgroundColor: '#C73E89', ...style }}
    {...props}
  >
    {children}
  </Bubble>
);

export const Value = ({ children, style, ...props }: { style?: Object, children?: mixed }) => (
  <Bubble
    className="sqon-value"
    style={{ backgroundColor: '#D6E02F', ...style }}
    {...props}
  >
    {children}
  </Bubble>
);

type TFieldCrumbArg = {
  field: string,
  nextSQON: TGroupSQON,
};

type TValueCrumbArg = {
  value: string,
  nextSQON: TGroupSQON,
};

type TClearArg = {
  nextSQON: TGroupSQON
};

const enhance = compose(
  defaultProps({
    FieldCrumb: ({ field, nextSQON }: TFieldCrumbArg) => (
      <Field onClick={() => console.log(nextSQON)}>{field}</Field>
    ),
    ValueCrumb: ({ value, nextSQON }: TValueCrumbArg) => (
      <Value onClick={() => console.log(nextSQON)}>{value}</Value>
    ),
    Clear: ({ nextSQON }: TClearArg) => (
      <Bubble
        style={{ backgroundColor: '#C73E89' }}
        onClick={() => console.log(nextSQON)}
      >
        Clear
      </Bubble>
    ),
  }),
  withState('expanded', 'setExpanded', []),
  withProps(({ expanded }) => ({
    isExpanded: valueSQON => expanded.includes(valueSQON),
  })),
  withHandlers({
    onLessClicked: ({ expanded, setExpanded }) => valueSQON => {
      setExpanded(xor(expanded, [valueSQON]));
    },
  }),
);

const SQON = ({
  sqon,
  FieldCrumb,
  ValueCrumb,
  Clear,
  isExpanded,
  expanded,
  setExpanded,
  onLessClicked,
}: {
  sqon: TGroupSQON,
  FieldCrumb: (props: TFieldCrumbArg) => any,
  ValueCrumb: (props: TValueCrumbArg) => any,
  Clear: (props: TClearArg) => any,
  isExpanded: (valueSQON: TValueSQON) => boolean,
  expanded: Array<TValueSQON>,
  setExpanded: () => void,
  onLessClicked: Function,
}) => {
  const sqonContent = sqon.content || [];
  return (
    <div
      className="sqon-view"
      style={{
        padding: '6px 12px',
        borderRadius: '4px',
        backgroundColor: '#EDF8FB',
      }}
    >
      {sqonContent.length === 0 && (
        <div className="sqon-empty-message">
          {'\u2190 Start by selecting a query field'}
        </div>
      )}
      {sqonContent.length >= 1 && (
        <Row spacing="0.3em" wrap>
          <div style={{ padding: '0.5rem 0' }}>{Clear({ nextSQON: {} })}</div>
          {sqonContent.map((valueSQON, i) => {
            const field = valueSQON.content.field;
            const value = [].concat(valueSQON.content.value || []);
            const op = valueSQON.op;
            return (
              <Row
                key={`${field}.${op}.${value.join()}`}
                spacing="0.3em"
                style={{ padding: '0.5rem 0' }}
              >
                {FieldCrumb({
                  field,
                  nextSQON: toggleSQON(
                    {
                      op: 'and',
                      content: [valueSQON],
                    },
                    sqon,
                  ),
                })}
                <Op>{op}</Op>
                {value.length > 1 && <span>(</span>}
                {(isExpanded(valueSQON) ? value : take(value, 2)).map(value =>
                  ValueCrumb({
                    value,
                    nextSQON: toggleSQON(
                      {
                        op: 'and',
                        content: [
                          {
                            op: op,
                            content: {
                              field: field,
                              value: [value],
                            },
                          },
                        ],
                      },
                      sqon,
                    ),
                  }),
                )}
                {value.length > 2 &&
                  !isExpanded(valueSQON) && (
                    <span onClick={() => onLessClicked(valueSQON)}>
                      {'\u2026'}
                    </span>
                  )}
                {isExpanded(valueSQON) && (
                  <div
                    style={{ padding: '6px 0' }}
                    onClick={() => onLessClicked(valueSQON)}
                  >
                    Less
                  </div>
                )}
                {value.length > 1 && <span>)</span>}
                {i < sqonContent.length - 1 && <Op>{sqon.op}</Op>}
              </Row>
            );
          })}
        </Row>
      )}
    </div>
  );
};

export default enhance(SQON);
