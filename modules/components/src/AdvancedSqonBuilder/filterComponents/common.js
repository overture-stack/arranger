import React from 'react';

export const FilterContainer = ({
  onSubmit = () => {},
  onCancel = () => {},
  loading = false,
  children,
}) => (
  <div className="filterContainer" children={children}>
    <div className="filterContent">
      {loading ? <div> loading!!!</div> : children}
    </div>
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
