import React from 'react';
import './FilterContainerStyle.css';
import { TermAgg } from '../Aggs';

const FilterContainer = ({
  onSubmit = () => {},
  onCancel = () => {},
  children,
}) => (
  <div className="filterContainer" children={children}>
    <div className="content">{children}</div>
    <div className="Footer">
      <button className={'filterContainerActionButton cancel'}>Cancel</button>
      <button className={'filterContainerActionButton apply'}>Apply</button>
    </div>
  </div>
);

export default ({
  filterObj,
  querySqon,
  onSqonChange,
  onSubmit = console.log,
  onCancel = console.log,
  field,
  value,
  ContainerComponent = FilterContainer,
}) => {
  return (
    <ContainerComponent onSubmit={onSubmit} onCancel={onCancel}>
      <TermAgg
        field={filterObj.field}
        displayName="Disease Type"
        buckets={[
          { doc_count: 2, key: 'Acute Myeloid Leukemia' },
          { doc_count: 10, key: 'Acinar cell neoplasms' },
        ]}
        handleValueClick={console.log}
      />
    </ContainerComponent>
  );
};
