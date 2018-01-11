import React from 'react';
import { storiesOf } from '@storybook/react';
import EditAggs from '../src/Aggs/EditAggs';

storiesOf('Aggs', module).add('EditAggs', () => (
  <EditAggs
    aggs={[
      {
        field: 'age_at_diagnosis',
        displayName: 'Age At Diagnosis',
        active: false,
        type: 'NumericAggregations',
        allowedValues: [],
        restricted: false,
      },
      {
        field: 'age_at_sampling',
        displayName: 'Age At Sampling',
        active: false,
        type: 'NumericAggregations',
        allowedValues: [],
        restricted: false,
      },
      {
        field: 'cancer_related_somatic_mutations',
        displayName: 'Cancer Related Somatic Mutations',
        active: false,
        type: 'Aggregations',
        allowedValues: [],
        restricted: false,
      },
    ]}
  />
));
