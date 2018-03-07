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
  constructEntryId,
  searchboxSelectionObservable,
  valueCharacterLimit,
}) => {
  const buckets = aggProps ? aggProps.buckets || [] : [];
  const hasLongValues = buckets.some(
    ({ key }) => key.length > stackingLengthLimit,
  );
  return (
    <div className={hasLongValues ? 'hasLongValues' : 'hasShortValues'}>
      <TermAggs
        valueCharacterLimit={valueCharacterLimit}
        observableValueInFocus={searchboxSelectionObservable.filter(
          ({ field, value }) => field === path,
        )}
        key={title}
        collapsible={false}
        handleValueClick={({ bucket }) => {
          onValueChange({
            value: bucket.key_as_string || bucket.key,
          });
        }}
        constructEntryId={constructEntryId}
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
