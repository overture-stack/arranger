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
  .add('one field, 20 values', () => (
    <SQONView
      sqon={{
        op: 'and',
        content: [
          {
            op: 'in',
            content: {
              field: 'primary_site',
              value: [
                'lung',
                'heart',
                'brain',
                'blood',
                'kidney',
                'lung1',
                'heart1',
                'brain1',
                'blood1',
                'kidney1',
                'lung2',
                'heart2',
                'brain2',
                'blood2',
                'kidney2',
                'lung3',
                'heart3',
                'brain3',
                'blood3',
                'kidney3',
              ],
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
  ))
  .add('text filter', () => (
    <SQONView
      sqon={{
        op: 'and',
        content: [
          {
            op: 'filter',
            content: {
              fields: ['gender', 'state', 'country'],
              value: 'fema',
            },
          },
        ],
      }}
    />
  ));
