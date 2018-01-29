import React from 'react';
//$FlowIgnore
import { storiesOf } from '@storybook/react';
import SQONView, { Value } from '../src/SQONView';
import { themeDecorator } from './decorators';

const ValueCrumb = ({ value, nextSQON }) => (
  <Value onClick={() => console.log(nextSQON)}>
    {value}
    <svg width="8" height="8" stroke="white" style={{ marginLeft: 11 }}>
      <line x1="0" y1="0" x2="8" y2="8" />
      <line x1="8" y1="0" x2="0" y2="8" />
    </svg>
  </Value>
);

storiesOf('SQONView', module)
  .addDecorator(themeDecorator)
  .add('Empty SQON', () => <SQONView sqon={{}} />)
  .add('one field, one value', () => (
    <SQONView
      sqon={{
        op: 'and',
        content: [
          {
            op: 'in',
            content: {
              field: 'primary_site',
              value: ['lung'],
            },
          },
        ],
      }}
      ValueCrumb={ValueCrumb}
    />
  ))
  .add('one field, two values', () => (
    <SQONView
      sqon={{
        op: 'and',
        content: [
          {
            op: 'in',
            content: {
              field: 'primary_site',
              value: ['lung', 'heart'],
            },
          },
        ],
      }}
      ValueCrumb={ValueCrumb}
    />
  ))
  .add('one field, 5 values', () => (
    <SQONView
      sqon={{
        op: 'and',
        content: [
          {
            op: 'in',
            content: {
              field: 'primary_site',
              value: ['lung', 'heart', 'brain', 'blood', 'kidney'],
            },
          },
        ],
      }}
      ValueCrumb={ValueCrumb}
    />
  ))
  .add('two fields, 3 values each', () => (
    <SQONView
      sqon={{
        op: 'and',
        content: [
          {
            op: 'in',
            content: {
              field: 'primary_site',
              value: ['lung', 'heart', 'brain'],
            },
          },
          {
            op: 'in',
            content: {
              field: 'gender',
              value: ['female', 'male', 'unknown'],
            },
          },
        ],
      }}
      ValueCrumb={ValueCrumb}
    />
  ))
  .add('range', () => (
    <SQONView
      sqon={{
        op: 'and',
        content: [
          {
            op: '>=',
            content: {
              field: 'cases.exposures.cigarettes_per_day',
              value: ['1'],
            },
          },
          {
            op: '<=',
            content: {
              field: 'cases.exposures.cigarettes_per_day',
              value: ['5'],
            },
          },
        ],
      }}
      ValueCrumb={ValueCrumb}
    />
  ))
  .add('range and term', () => (
    <SQONView
      sqon={{
        op: 'and',
        content: [
          {
            op: '>=',
            content: {
              field: 'cases.exposures.cigarettes_per_day',
              value: ['1'],
            },
          },
          {
            op: '<=',
            content: {
              field: 'cases.exposures.cigarettes_per_day',
              value: ['5'],
            },
          },
          {
            op: 'in',
            content: {
              field: 'primary_site',
              value: ['heart', 'lung', 'bone', 'blood', 'liver'],
            },
          },
        ],
      }}
      ValueCrumb={ValueCrumb}
    />
  ))
  .add('value is not array', () => (
    <SQONView
      sqon={{
        op: 'and',
        content: [
          {
            op: 'is',
            content: {
              field: 'gender',
              value: 'female',
            },
          },
          {
            op: 'is',
            content: {
              field: 'cases.exposures.cigarettes_per_day',
              value: 5,
            },
          },
        ],
      }}
      ValueCrumb={ValueCrumb}
    />
  ));
