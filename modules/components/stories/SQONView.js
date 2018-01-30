import React from 'react';
//$FlowIgnore
import { storiesOf } from '@storybook/react';
import SQONView from '../src/SQONView';
import { themeDecorator } from './decorators';

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
