import React from 'react';

export const PillRemoveButton = ({ onClick }) => (
  <span className={`pillRemoveButton`} onClick={onClick}>
    ✕
  </span>
);

export const FilterContainer = ({
  onSubmit = () => {},
  onCancel = () => {},
  children,
}) => (
  <div className="filterContainer" children={children}>
    <div className="filterContent">{children}</div>
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
