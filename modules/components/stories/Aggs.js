import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import EditAggs from '../src/Aggs/EditAggs';
import RangeAgg from '../src/Aggs/RangeAgg';
import TermAgg from '../src/Aggs/TermAgg';
import AggsPanel from '../src/Aggs/AggsPanel';
import AggsPanell from '../src/Aggs/AggsPanell';
import { inCurrentSQON, addInSQON, toggleSQON } from '../src/SQONView/utils';
import State from '../src/State';
import './Aggs.css';

let aggs = [
  {
    field: 'color',
    displayName: 'Color',
    active: false,
    type: 'Aggregations',
    allowedValues: [],
    restricted: false,
    buckets: [
      {
        doc_count: 1,
        key: 'green',
      },
      {
        doc_count: 5,
        key: 'yellow',
      },
      {
        doc_count: 12,
        key: 'blue',
      },
    ],
  },
  {
    field: 'taste',
    displayName: 'Taste',
    active: false,
    type: 'Aggregations',
    allowedValues: [],
    restricted: false,
    buckets: [
      {
        doc_count: 1,
        key: 'spicy',
      },
      {
        doc_count: 5,
        key: 'sweet',
      },
      {
        doc_count: 12,
        key: 'sour',
      },
    ],
  },
  {
    field: 'diagnoses__days_to_death',
    displayName: 'Days To Death',
    active: false,
    type: 'Numeric Aggregations',
    allowedValues: [],
    restricted: false,
    buckets: [
      {
        doc_count: 3841,
        key: '0.0',
        key_as_string: null,
      },
      {
        doc_count: 305,
        key: '2000.0',
        key_as_string: null,
      },
    ],
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
      handleValueClick={action('Term Agg Selection')}
    />
  </div>
));

storiesOf('Aggs', module).add('RangeAgg', () => (
  <div className="range-agg-wrapper">
    <RangeAgg
      field="days_to_death"
      displayName="Days To Death"
      buckets={[
        {
          doc_count: 3087,
          key: '0.0',
          key_as_string: null,
        },
        {
          doc_count: 754,
          key: '1000.0',
          key_as_string: null,
        },
        {
          doc_count: 227,
          key: '2000.0',
          key_as_string: null,
        },
        {
          doc_count: 78,
          key: '3000.0',
          key_as_string: null,
        },
        {
          doc_count: 23,
          key: '4000.0',
          key_as_string: null,
        },
        {
          doc_count: 10,
          key: '5000.0',
          key_as_string: null,
        },
        {
          doc_count: 11,
          key: '6000.0',
          key_as_string: null,
        },
        {
          doc_count: 2,
          key: '7000.0',
          key_as_string: null,
        },
        {
          doc_count: 1,
          key: '8000.0',
          key_as_string: null,
        },
        {
          doc_count: 1,
          key: '9000.0',
          key_as_string: null,
        },
        {
          doc_count: 2,
          key: '10000.0',
          key_as_string: null,
        },
      ]}
      handleValueClick={action('Range Agg Selection Change')}
    />
  </div>
));

let defaultSQON = {
  op: 'and',
  content: [],
};

storiesOf('Aggs', module).add('AggsWithSQON', () => (
  <State
    initial={{ sqon: null }}
    render={({ sqon, update }) => (
      <div>
        <div>SQON: {JSON.stringify(sqon)}</div>
        <div>
          {aggs.map(agg => (
            // TODO: switch on agg type
            <TermAgg
              key={agg.field}
              {...agg}
              Content={({ content, ...props }) => (
                <div
                  {...props}
                  onClick={() =>
                    update({
                      sqon: toggleSQON(
                        {
                          op: 'and',
                          content: [
                            {
                              op: 'in',
                              content,
                            },
                          ],
                        },
                        sqon || defaultSQON,
                      ),
                    })
                  }
                />
              )}
              isActive={d =>
                inCurrentSQON({
                  value: d.value,
                  dotField: d.field,
                  currentSQON: sqon?.content || defaultSQON.content,
                })
              }
            />
          ))}
        </div>
      </div>
    )}
  />
));

storiesOf('Aggs', module).add('LiveDataAggsPanel', () => (
  <State
    initial={{ index: '', sqon: {} }}
    render={({ index, update }) => (
      <div>
        <label>index: </label>
        <input // <-- could be a dropdown of available indices
          value={index}
          onChange={e => update({ index: e.target.value })}
        />
        {index && (
          <div>
            <AggsPanel aggs={aggs} index={index} debounceTime={200} />
          </div>
        )}
      </div>
    )}
  />
));
