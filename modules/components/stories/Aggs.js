import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import EditAggs from '../src/Aggs/EditAggs';
import './Aggs.css';

storiesOf('Aggs', module).add('EditAggs', () => (
  <div className="edit-aggs-wrapper">
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
      handleChange={action('Agg State Change')}
    />
  </div>
));

storiesOf('Aggs', module).add('TermAgg', () => <div>test</div>);
storiesOf('Aggs', module).add('AggsPanel', () => <div>test</div>);
