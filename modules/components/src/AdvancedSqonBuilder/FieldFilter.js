import React from 'react';
import './FilterContainerStyle.css';
import { AggsWrapper, TermAgg } from '../Aggs';
import Component from 'react-component-component';
import TextFilter from '../TextFilter';
import { inCurrentSQON } from '../SQONView/utils';

const mockBuckets = [
  { doc_count: 2, key: 'Acute Myeloid Leukemia' },
  { doc_count: 10, key: 'Acinar cell neoplasms' },
  { doc_count: 10, key: 'asfsfgsdfg' },
  { doc_count: 10, key: 'dhfgbkjnv' },
  { doc_count: 10, key: 'ugs;jv' },
  { doc_count: 10, key: 'e568[ohtdnbf' },
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
  filterObj,
  querySqon,
  onSubmit = sqon => {},
  onCancel = () => {},
  field,
  value,
  ContainerComponent = FilterContainer,
  InputComponent = TextFilter,
}) => {
  /**
   * this component keeps a local sqon to dispatch when submited
   */
  const initialState = { searchString: '', localSqon: querySqon };
  const onSearchChange = s => e => {
    s.setState({
      searchString: e.value,
    });
  };
  const isFilterActive = s => d =>
    inCurrentSQON({
      value: d.value,
      dotField: d.field,
      currentSQON: s.state.localSqon,
    });
  const onFilterClick = s => ({ generateNextSQON }) => {
    setTimeout(() => {
      s.setState({
        localSqon: generateNextSQON(s.state.localSqon),
      });
    }, 0);
  };
  const onSqonSubmit = s => () => onSubmit(s.state.localSqon);
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
            field={filterObj.content.field}
            displayName="Disease Type"
            buckets={mockBuckets.filter(({ key }) =>
              key.includes(s.state.searchString),
            )}
            handleValueClick={onFilterClick(s)}
            isActive={isFilterActive(s)}
          />
        </ContainerComponent>
      )}
    </Component>
  );
};
