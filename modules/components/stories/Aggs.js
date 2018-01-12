import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import EditAggs from '../src/Aggs/EditAggs';
import TermAgg from '../src/Aggs/TermAgg';
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

storiesOf('Aggs', module).add('TermAgg', () => (
  <div className="term-agg-wrapper">
    <TermAgg
      field="disease_type"
      displayName="Disease Type"
      buckets={[
        {
          doc_count: 2,
          key: 'Acute Myeloid Leukemia',
        },
        {
          doc_count: 1,
          key: 'Acinar cell neoplasms',
        },
        {
          doc_count: 1,
          key: 'Adenomas and Adenocarcinomas',
        },
        {
          doc_count: 1,
          key: 'Adnexal and Skin Appendage Neoplasms',
        },
      ]}
    />
  </div>
));
storiesOf('Aggs', module).add('AggsPanel', () => <div>test</div>);
