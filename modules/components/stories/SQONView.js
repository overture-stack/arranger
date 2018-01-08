import React from 'react';
//$FlowIgnore
import { storiesOf } from '@storybook/react';
import SQONView from '../src/SQONView';

storiesOf('SQONView', module)
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
      Crumb={props => <a>test</a>}
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
      Crumb={props => <a>test</a>}
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
      Crumb={props => <a>test</a>}
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
    />
  ));
