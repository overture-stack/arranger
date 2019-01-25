import React from 'react';
import Component from 'react-component-component';
import { sortBy } from 'lodash';
import './FilterContainerStyle.css';
import { AggsWrapper, TermAgg } from '../../Aggs';
import TextFilter from '../../TextFilter';
import { inCurrentSQON } from '../../SQONView/utils';
import { getOperationAtPath, setSqonAtPath } from '../utils';
import { lensPath, set } from 'ramda';

const mockBuckets = [
  { doc_count: 2, key: 'GF_9V1MT6CM' },
  { doc_count: 10, key: 'Cancer' },
  { doc_count: 10, key: 'Acute Myeloid Leukemia' },
  {
    doc_count: 10,
    key: 'Abnormality of nervous system physiology (HP:0012638)',
  },
  { doc_count: 10, key: 'Ewing Sarcoma: Genetic Risk' },
  { doc_count: 10, key: 'Pediatric Brain Tumors: CBTTC' },
];

const FilterContainer = ({
  onSubmit = () => {},
  onCancel = () => {},
  children,
}) => (
  <div className="filterContainer" children={children}>
    <div className="content">{children}</div>
    <div className="Footer">
      <button
        onClick={onCancel}
        className={'filterContainerActionButton cancel'}
      >
        Cancel
      </button>
      <button
        onClick={onSubmit}
        className={'filterContainerActionButton apply'}
      >
        Apply
      </button>
    </div>
  </div>
);

const TermAggsWrapper = ({ children }) => (
  <div className="aggregation-card">{children}</div>
);

export default ({
  initialSqon = null,
  onSubmit = sqon => {},
  onCancel = () => {},
  ContainerComponent = FilterContainer,
  InputComponent = TextFilter,
  sqonPath = [],
}) => {
  const fieldSqon = getOperationAtPath(sqonPath)(initialSqon);
  const initialState = { searchString: '', localSqon: initialSqon };
  const onSearchChange = s => e => {
    s.setState({
      searchString: e.value,
    });
  };
  const isFilterActive = s => d =>
    inCurrentSQON({
      value: d.value,
      dotField: d.field,
      currentSQON: getOperationAtPath(sqonPath)(s.state.localSqon),
    });
  const onFilterClick = s => ({ generateNextSQON }) => {
    setTimeout(() => {
      // state change in the same tick somehow results in this component dismounting (probably  something to do with TermAgg's click event, needs investigation)
      const deltaSqon = generateNextSQON();
      const deltaFiterObjContentValue = deltaSqon.content[0].content.value;
      // we're only interested in the new field operation's content value
      const currentFieldSqon = getOperationAtPath(sqonPath)(s.state.localSqon);
      const existingValue = (currentFieldSqon.content.value || []).find(v =>
        deltaFiterObjContentValue.includes(v),
      );
      const newFieldSqon = {
        ...currentFieldSqon,
        content: {
          ...currentFieldSqon.content,
          value: [
            ...(currentFieldSqon.content.value || []).filter(
              v => v !== existingValue,
            ),
            ...(existingValue ? [] : deltaFiterObjContentValue),
          ],
        },
      };
      s.setState({
        localSqon: setSqonAtPath(sqonPath, newFieldSqon)(s.state.localSqon),
      });
    }, 0);
  };
  const onSqonSubmit = s => () => onSubmit(s.state.localSqon);
  const computeBuckets = (s, buckets) =>
    sortBy(
      buckets,
      bucket =>
        !inCurrentSQON({
          value: bucket.key,
          dotField: fieldSqon.content.field,
          currentSQON: getOperationAtPath(sqonPath)(initialSqon),
        }),
    ).filter(({ key }) => key.includes(s.state.searchString));
  return (
    <Component initialState={initialState}>
      {s => (
        <ContainerComponent onSubmit={onSqonSubmit(s)} onCancel={onCancel}>
          <InputComponent
            value={s.state.searchString}
            onChange={onSearchChange(s)}
          />
          <TermAgg
            WrapperComponent={TermAggsWrapper}
            field={fieldSqon.content.field}
            displayName="Disease Type"
            buckets={computeBuckets(s, mockBuckets)}
            handleValueClick={onFilterClick(s)}
            isActive={isFilterActive(s)}
            maxTerms={Infinity}
          />
        </ContainerComponent>
      )}
    </Component>
  );
};
