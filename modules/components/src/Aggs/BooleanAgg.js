import React from 'react';
import AggsWrapper from './AggsWrapper.js';
import { replaceSQON, removeSQON } from '../SQONView/utils';
import './BooleanAgg.css';
import TextHighlight from '../TextHighlight';
import ToggleButton from '../ToggleButton';
import formatNumber from '../utils/formatNumber';

export default ({
  field,
  buckets,
  handleValueClick = () => {},
  isActive = () => false,
  collapsible,
  WrapperComponent,
  displayName,
  highlightText,
  valueKeys = {
    true: 'true',
    false: 'false',
  },
  defaultDisplayKeys = {
    any: 'Any',
    true: 'Yes',
    false: 'No',
  },
  displayValues: extendedDisplayKeys = {},
  displayKeys = Object.keys(defaultDisplayKeys).reduce(
    (obj, x) => ({
      ...obj,
      [x]: extendedDisplayKeys[x] || defaultDisplayKeys[x],
    }),
    {},
  ),
  ...rest
}) => {
  const trueBucket = buckets.find(
    ({ key_as_string }) => key_as_string === valueKeys.true,
  );
  const falseBucket = buckets.find(
    ({ key_as_string }) => key_as_string === valueKeys.false,
  );

  const missingKeyBucket = buckets.find(({ key_as_string }) => !key_as_string);

  const dotField = field.replace(/__/g, '.');

  const isTrueActive = isActive({
    value: valueKeys.true,
    field: dotField,
  });
  const isFalseActive = isActive({
    value: valueKeys.false,
    field: dotField,
  });

  const handleChange = (isTrue, field) => {
    if (isTrue !== undefined) {
      handleValueClick({
        bucket: isTrue ? trueBucket : falseBucket,
        value: isTrue ? trueBucket : falseBucket || missingKeyBucket,
        field,
        generateNextSQON: sqon =>
          replaceSQON(
            {
              op: 'and',
              content: [
                {
                  op: 'in',
                  content: {
                    field: dotField,
                    value: [valueKeys[isTrue ? 'true' : 'false']],
                  },
                },
              ],
            },
            sqon,
          ),
      });
    } else {
      handleValueClick({
        value: 'Any',
        field,
        generateNextSQON: sqon => removeSQON(dotField, sqon),
      });
    }
  };

  return (
    <AggsWrapper {...{ displayName, WrapperComponent, collapsible }}>
      <ToggleButton
        {...{
          value: isTrueActive
            ? valueKeys.true
            : isFalseActive
              ? valueKeys.false
              : undefined,
          options: [
            {
              value: undefined,
              title: displayKeys.any,
            },
            {
              value: valueKeys.true,
              title: (
                <>
                  <TextHighlight
                    content={displayKeys.true}
                    highlightText={highlightText}
                  />
                  {trueBucket && (
                    <span
                      className={`bucket-count`}
                      style={{
                        marginLeft: 2,
                      }}
                    >
                      {formatNumber(trueBucket.doc_count)}
                    </span>
                  )}
                </>
              ),
            },
            {
              value: valueKeys.false,
              title: (
                <>
                  <TextHighlight
                    content={displayKeys.false}
                    highlightText={highlightText}
                  />
                  {falseBucket && (
                    <span
                      className={`bucket-count`}
                      style={{
                        marginLeft: 2,
                      }}
                    >
                      {formatNumber(falseBucket.doc_count)}
                    </span>
                  )}
                </>
              ),
            },
          ],
          onChange: ({ value }) => {
            handleChange(
              value === valueKeys.true
                ? true
                : value === valueKeys.false
                  ? false
                  : undefined,
              dotField,
            );
          },
        }}
      />
    </AggsWrapper>
  );
};
