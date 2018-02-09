import React from 'react';
import TermAggs from '../../Aggs/TermAgg';
import { inCurrentSQON, replaceSQON, toggleSQON } from '../../SQONView/utils';

const emptySQON = {
  op: 'and',
  content: [],
};

export default ({ aggType, aggProps, title, onValueChange, sqon, path }) => (
  <TermAggs
    key={title}
    collapsible={false}
    handleValueClick={bucket => {
      onValueChange({
        value: bucket.key,
      });
    }}
    field={path}
    buckets={aggProps ? aggProps.buckets : null}
    displayName={title}
    isActive={d => {
      return inCurrentSQON({
        value: d.value,
        dotField: d.field,
        currentSQON: sqon,
      });
    }}
  />
);
