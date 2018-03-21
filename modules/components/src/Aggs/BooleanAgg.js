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

export default ({
  field,
  buckets,
  handleValueClick = () => {},
  isActive = () => false,
  ...rest
}) => {
  const trueBucket = buckets.find(({ key }) => key === '1');
  const falseBucket = buckets.find(({ key }) => key === '0');
  const dotField = field.replace(/__/g, '.');

  const isTrueActive = isActive({
    value: true,
    field: dotField,
  });
  const isFalseActive = isActive({
    value: false,
    field: dotField,
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
                  value: [isTrue],
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
          className={`booleanAggOption bucket-item ${
            isNeitherActive ? 'active' : ''
          }`}
          style={{ paddingTop: 0 }}
          onClick={handleAnyClick}
        >
          Any
        </div>
        <div
          className={`booleanAggOption bucket-item ${
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
          className={`booleanAggOption bucket-item ${
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
