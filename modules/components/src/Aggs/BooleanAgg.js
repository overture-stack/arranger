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
import TextHighlight from '../TextHighlight';

export default ({
  field,
  buckets,
  handleValueClick = () => {},
  isActive = () => false,
  collapsible,
  WrapperComponent,
  displayName,
  searchString,
  ...rest
}) => {
  const trueBucket = buckets.find(({ key }) => key === '1');
  const falseBucket = buckets.find(({ key }) => key === '0');
  const dotField = field.replace(/__/g, '.');

  const isTrueActive = isActive({
    value: 'true',
    field: dotField,
  });
  const isFalseActive = isActive({
    value: 'false',
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
                  value: [String(isTrue)],
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
    <AggsWrapper {...{ displayName, WrapperComponent, collapsible }}>
      <div className={`booleanFacetWrapper`}>
        <div
          className={`booleanAggOption bucket-item ${
            isNeitherActive ? 'active' : ''
          }`}
          onClick={handleAnyClick}
        >
          Any
        </div>
        <div
          className={`booleanAggOption bucket-item ${
            isTrueActive ? 'active' : ''
          }`}
          onClick={() => handleTrueFalseClick(true)}
        >
          <TextHighlight content={'Yes'} highlightText={searchString} />
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
          onClick={() => handleTrueFalseClick(false)}
        >
          <TextHighlight content={'No'} highlightText={searchString} />
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
