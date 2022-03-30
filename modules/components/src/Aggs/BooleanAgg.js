import { css } from '@emotion/react';
import cx from 'classnames';

import { replaceSQON, removeSQON } from '@/SQONViewer/utils';
import TextHighlight from '@/TextHighlight';
import { useThemeContext } from '@/ThemeContext';
import ToggleButton from '@/ToggleButton';
import formatNumber from '@/utils/formatNumber';
import noopFn from '@/utils/noopFns';

import AggsWrapper from './AggsWrapper';
import BucketCount from './BucketCount';

const BooleanAgg = ({
  buckets,
  collapsible,
  field,
  handleValueClick = noopFn,
  isActive = () => false,
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
  type,
}) => {
  const {
    components: {
      Aggregations: {
        BooleanAgg: {
          BucketCount: { className: themeBucketCountClassName, ...bucketCountTheme } = {},
          ToggleButton: { className: themeToggleButtonClassName, ...toggleButtonTheme } = {},
        } = {},
      } = {},
    } = {},
  } = useThemeContext();

  const trueBucket = buckets.find(({ key_as_string }) => key_as_string === valueKeys.true);
  const falseBucket = buckets.find(({ key_as_string }) => key_as_string === valueKeys.false);

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

  const isTrueBucketDisabled = trueBucket === undefined || trueBucket?.doc_count <= 0;
  const isFalseBucketDisabled = falseBucket === undefined || falseBucket?.doc_count <= 0;

  const handleChange = (isTrue, field) => {
    handleValueClick(
      isTrue === undefined // aka "Any" button clicked
        ? {
            field,
            generateNextSQON: (sqon) => removeSQON(dotField, sqon),
            value: 'Any',
          }
        : {
            bucket: isTrue ? trueBucket : falseBucket,
            field,
            generateNextSQON: (sqon) =>
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
            value: isTrue ? trueBucket : falseBucket || missingKeyBucket,
          },
    );
  };

  const options = (
    displayKeys.any
      ? [
          {
            value: undefined,
            title: displayKeys.any,
          },
        ]
      : []
  ).concat([
    {
      value: valueKeys.true,
      disabled: isTrueBucketDisabled,
      title: ({ toggleStatus = '' } = {}) => (
        <>
          <TextHighlight content={displayKeys.true} highlightText={highlightText} />
          <BucketCount
            className={cx(toggleStatus, themeBucketCountClassName)}
            css={css`
              margin-left: 0.3rem;
            `}
            theme={bucketCountTheme}
          >
            {formatNumber(isTrueBucketDisabled ? 0 : trueBucket.doc_count)}
          </BucketCount>
        </>
      ),
    },
    {
      value: valueKeys.false,
      disabled: isFalseBucketDisabled,
      title: ({ toggleStatus = '' } = {}) => (
        <>
          <TextHighlight content={displayKeys.false} highlightText={highlightText} />
          <BucketCount
            className={cx(toggleStatus, themeBucketCountClassName)}
            css={css`
              margin-left: 0.2rem;
            `}
            theme={bucketCountTheme}
          >
            {formatNumber(isFalseBucketDisabled ? 0 : falseBucket.doc_count)}
          </BucketCount>
        </>
      ),
    },
  ]);

  const dataFields = {
    ...(field && { 'data-field': field }),
    ...(type && { 'data-type': type }),
  };

  return (
    <AggsWrapper dataFields={dataFields} {...{ displayName, WrapperComponent, collapsible }}>
      <div
        css={css`
          width: 100%;
        `}
      >
        <ToggleButton
          className={themeToggleButtonClassName}
          onChange={({ value }) => {
            handleChange(
              value === valueKeys.true ? true : value === valueKeys.false ? false : undefined,
              dotField,
            );
          }}
          options={options}
          theme={toggleButtonTheme}
          value={isTrueActive ? valueKeys.true : isFalseActive ? valueKeys.false : undefined}
        />
      </div>
    </AggsWrapper>
  );
};

export default BooleanAgg;
