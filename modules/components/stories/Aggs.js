import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import EditAggs from '../src/Aggs/EditAggs';
import TermAgg from '../src/Aggs/TermAgg';
import AggsPanel from '../src/Aggs/AggsPanel';
import State from '../src/State';
import './Aggs.css';

let aggs = [
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
];

storiesOf('Aggs', module).add('EditAggs', () => (
  <div className="edit-aggs-wrapper">
    <EditAggs aggs={aggs} handleChange={action('Agg State Change')} />
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
          doc_count: 10,
          key: 'Acinar cell neoplasms',
        },
      ]}
      handleChange={action('Term Agg Selection')}
    />
  </div>
));

storiesOf('Aggs', module).add('AggsPanel', () => (
  <State
    initial={{ index: '', go: false }}
    render={({ index, go, update }) => (
      <div>
        <label>index: </label>
        <input // <-- could be a dropdown of available indices
          value={index}
          onChange={e => update({ index: e.target.value })}
        />
        <button onClick={() => update({ go: true })}>Go</button>
        {go && (
          <div>
            <AggsPanel aggs={aggs} index={index} />
          </div>
        )}
      </div>
    )}
  />
));
