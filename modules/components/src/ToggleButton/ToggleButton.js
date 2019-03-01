import React from 'react';
import './ToggleButton.css';

export default ({ value, options = [], onChange = () => {} }) => (
  <div className="toggle-button">
    {options.map(x => {
      const isDisabled = x ? x.disabled : false;
      return (
        <div
          key={x.value || 'undefined'}
          className={`toggle-button-option ${
            value === x.value ? 'active' : ''
          }${isDisabled ? 'disabled' : ''}`}
          onClick={() => (!isDisabled ? onChange({ value: x.value }) : null)}
        >
          {x.title}
        </div>
      );
    })}
  </div>
);
