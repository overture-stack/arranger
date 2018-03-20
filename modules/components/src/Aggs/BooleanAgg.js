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

  const createSqonGenerator = isTrue => ({ sqon }) =>
    inCurrentSQON({
      dotField,
      value: isTrue ? booleanValues.true : booleanValues.false,
      currentSQON: sqon,
    });

  const isTrueActive = isTrueSelected({
    evaluateInSqon: createSqonGenerator(true),
  });
  const isFalseActive = isFalseSelected({
    evaluateInSqon: createSqonGenerator(false),
  });
  const isNeitherActive = !isTrueActive && !isFalseActive;

  const handleTrueFalseClick = isTrue =>
    handleValueClick({
      bucket: isTrue ? trueBucket : falseBucket,
      generateNextSQON: sqon =>
        replaceSQON(
          {
            op: 'and',
            content: [
              {
                op: 'in',
                content: {
                  field: dotField,
                  value: [isTrue ? booleanValues.true : booleanValues.false],
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
          className={`booleanFacetAny bucket-item ${
            isNeitherActive ? 'active' : ''
          }`}
          style={{ paddingTop: 0 }}
          onClick={handleAnyClick}
        >
          Any
        </div>
        <div
          className={`booleanFacetTrue bucket-item ${
            isTrueActive ? 'active' : ''
          }`}
          style={{ paddingTop: 0 }}
          onClick={() => handleTrueFalseClick(true)}
        >
          Yes
          {trueBucket && (
            <span
              className={`bucket-count`}
              style={{
                marginLeft: 2,
              }}
            >
              {trueBucket.doc_count}
            </span>
          )}
        </div>
        <div
          className={`booleanFacetFalse bucket-item ${
            isFalseActive ? 'active' : ''
          }`}
          style={{ paddingTop: 0 }}
          onClick={() => handleTrueFalseClick(false)}
        >
          No
          {falseBucket && (
            <span
              className={`bucket-count`}
              style={{
                marginLeft: 2,
              }}
            >
              {falseBucket.doc_count}
            </span>
          )}
        </div>
      </div>
    </AggsWrapper>
  );
};
