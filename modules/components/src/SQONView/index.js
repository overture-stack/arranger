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

const Bubble = ({ className = '', children, ...props }) => (
  <div className={`${className} sqon-bubble`} {...props}>
    <div>{children}</div>
  </div>
);

export const Field = ({ children, ...props }: { children?: mixed }) => (
  <Bubble className="sqon-field" {...props}>
    {children}
  </Bubble>
);

export const Op = ({ children, ...props }: { children?: mixed }) => (
  <Bubble className="sqon-op" {...props}>
    {children}
  </Bubble>
);

export const Value = ({ children, ...props }: { children?: mixed }) => (
  <Bubble className="sqon-value" {...props}>
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
  nextSQON: TGroupSQON,
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
      <Bubble className="sqon-clear" onClick={() => console.log(nextSQON)}>
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
  const isEmpty = sqonContent.length === 0;
  return (
    <div className={`sqon-view ${isEmpty ? 'sqon-view-empty' : ''}`}>
      {isEmpty && (
        <div className="sqon-empty-message">
          {'\u2190 Start by selecting a query field'}
        </div>
      )}
      {sqonContent.length >= 1 && (
        <Row spacing="0.3em" wrap>
          <div>{Clear({ nextSQON: {} })}</div>
          {sqonContent.map((valueSQON, i) => {
            const field = valueSQON.content.field;
            const value = [].concat(valueSQON.content.value || []);
            const op = valueSQON.op;
            console.log(op);
            return (
              <Row key={`${field}.${op}.${value.join()}`} spacing="0.3em">
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
                <Op>{op === 'in' && value.length === 1 ? 'is' : op}</Op>
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
