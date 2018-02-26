import React from 'react';
import TermAggs from '../../Aggs/TermAgg';
import { inCurrentSQON, replaceSQON, toggleSQON } from '../../SQONView/utils';

export default ({
  aggType,
  aggProps,
  title,
  onValueChange,
  sqon,
  path,
  maxTerms = 6,
  stackingLengthLimit = 50,
}) => {
  const buckets = aggProps ? aggProps.buckets || [] : [];
  const hasLongValues = buckets.some(
    ({ key }) => key.length > stackingLengthLimit,
  );
  return (
    <div className={hasLongValues ? 'hasLongValues' : 'hasShortValues'}>
      <TermAggs
        key={title}
        collapsible={false}
        handleValueClick={({ bucket }) => {
          onValueChange({
            value: bucket.key,
          });
        }}
        maxTerms={maxTerms}
        field={path}
        buckets={buckets}
        displayName={title}
        isActive={d => {
          return inCurrentSQON({
            value: d.value,
            dotField: d.field,
            currentSQON: sqon,
          });
        }}
      />
    </div>
  );
};
