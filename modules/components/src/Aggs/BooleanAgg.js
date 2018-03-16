import React, { Component } from 'react';
import AggsWrapper from './AggsWrapper.js';
import { css } from 'emotion';
import {
  toggleSQON,
  inCurrentSQON,
  replaceSQON,
  removeSQON,
} from '../SQONView/utils';
import './BooleanAgg.css';

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
      <div className={`booleanFacetWrapper`}>
        <div
          className={`booleanFacetAny ${isNeitherActive ? 'active' : ''}`}
          onClick={handleAnyClick}
        >
          Any
        </div>
        <div
          className={`booleanFacetTrue ${isTrueActive ? 'active' : ''}`}
          onClick={handleTrueClick}
        >
          Yes
        </div>
        <div
          className={`booleanFacetFalse ${isFalseActive ? 'active' : ''}`}
          onClick={handleFalseClick}
        >
          No
        </div>
      </div>
    </AggsWrapper>
  );
};
