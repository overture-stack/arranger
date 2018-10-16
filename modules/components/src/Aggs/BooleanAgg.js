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

  console.log('field', field, 'trueBucket', trueBucket);
  console.log('field', field, 'falseBucket', falseBucket);

  const missingKeyBucket = buckets.find(({ key_as_string }) => !key_as_string);

  console.log('field', field, 'missingBucket', missingKeyBucket);

  const dotField = field.replace(/__/g, '.');

  const isTrueActive = isActive({
    value: valueKeys.true,
    field: dotField,
  });
  const isFalseActive = isActive({
    value: valueKeys.false,
    field: dotField,
  });

  const isTrueBucketDisabled =
    trueBucket === undefined || trueBucket?.doc_count <= 0;
  const isFalseBucketDisabled =
    falseBucket === undefined || falseBucket?.doc_count <= 0;

  console.log(
    'field',
    field,
    'isTrueDisabled',
    isTrueBucketDisabled,
    'isFalseDisabeld',
    isFalseBucketDisabled,
  );

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

  console.log('field', field, 'true bucket', trueBucket);
  console.log('field', field, 'false bucket', falseBucket);

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
              disabled: isTrueBucketDisabled,
              title: (
                <>
                  <TextHighlight
                    content={displayKeys.true}
                    highlightText={highlightText}
                  />
                  <span
                    className={`bucket-count`}
                    style={{
                      marginLeft: 2,
                    }}
                  >
                    {formatNumber(
                      isTrueBucketDisabled ? 0 : trueBucket.doc_count,
                    )}
                  </span>
                </>
              ),
            },
            {
              value: valueKeys.false,
              disabled: isFalseBucketDisabled,
              title: (
                <>
                  <TextHighlight
                    content={displayKeys.false}
                    highlightText={highlightText}
                  />
                  <span
                    className={`bucket-count`}
                    style={{
                      marginLeft: 2,
                    }}
                  >
                    {formatNumber(
                      isFalseBucketDisabled ? 0 : falseBucket.doc_count,
                    )}
                  </span>
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
