import React, { Component } from 'react';
import AggsWrapper from './AggsWrapper.js';
import { css } from 'emotion';
import {
  toggleSQON,
  inCurrentSQON,
  replaceSQON,
  removeSQON,
} from '../SQONView/utils';

const booleanValues = {
  true: 'true',
  false: 'false',
};

export default ({
  field,
  buckets,
  handleValueClick = () => {},
  isTrueSelected = () => false,
  isFalseSelected = () => false,
  ...rest
}) => {
  const trueBucket = buckets.find(({ key }) => key === '1');
  const falseBucket = buckets.find(({ key }) => key === '0');
  const dotField = field.replace(/__/g, '.');

  const isTrueActive = isTrueSelected({
    evaluateInSqon: ({ sqon }) =>
      inCurrentSQON({
        dotField,
        value: booleanValues.true,
        currentSQON: sqon,
      }),
  });
  const isFalseActive = isFalseSelected({
    evaluateInSqon: ({ sqon }) =>
      inCurrentSQON({
        dotField,
        value: booleanValues.false,
        currentSQON: sqon,
      }),
  });
  const isNeitherActive = !isTrueActive && !isFalseActive;

  const handleTrueClick = () =>
    handleValueClick({
      bucket: trueBucket,
      generateNextSQON: sqon =>
        replaceSQON(
          {
            op: 'and',
            content: [
              {
                op: 'in',
                content: {
                  field: dotField,
                  value: [booleanValues.true],
                },
              },
            ],
          },
          sqon,
        ),
    });

  const handleFalseClick = () =>
    handleValueClick({
      bucket: falseBucket,
      generateNextSQON: sqon =>
        replaceSQON(
          {
            op: 'and',
            content: [
              {
                op: 'in',
                content: {
                  field: dotField,
                  value: [booleanValues.false],
                },
              },
            ],
          },
          sqon,
        ),
    });

  const handleAnyClick = () =>
    handleValueClick({
      bucket: null,
      generateNextSQON: sqon => removeSQON(dotField, sqon),
    });

  return (
    <AggsWrapper {...{ buckets, ...rest }}>
      <div
        className={`booleanFacetWrapper ${css`
          display: flex;
          flex-direction: row;
        `}`}
      >
        <div
          className={`booleanFacetAny ${css`
            background: ${isNeitherActive ? '#e5f7fd' : 'none'};
            flex: 1;
            text-align: center;
            border: solid 1px ${isNeitherActive ? '#00afed' : '#cacbcf'};
            border-top-left-radius: 100px;
            border-bottom-left-radius: 100px;
          `}`}
          onClick={handleAnyClick}
        >
          Any
        </div>
        <div
          className={`booleanFacetTrue ${css`
            background: ${isTrueActive ? '#e5f7fd' : 'none'};
            flex: 1;
            text-align: center;
            border: solid 1px ${isTrueActive ? '#00afed' : '#cacbcf'};
          `}`}
          onClick={handleTrueClick}
        >
          Yes
        </div>
        <div
          className={`booleanFacetFalse ${css`
            background: ${isFalseActive ? '#e5f7fd' : 'none'};
            flex: 1;
            text-align: center;
            border: solid 1px ${isFalseActive ? '#00afed' : '#cacbcf'};
            border-top-right-radius: 100px;
            border-bottom-right-radius: 100px;
          `}`}
          onClick={handleFalseClick}
        >
          No
        </div>
      </div>
    </AggsWrapper>
  );
};
