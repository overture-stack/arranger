import React from 'react';
import './ToggleButton.css';

export default ({ value, options = [], onChange = () => {} }) => (
  <div className="toggle-button">
    {options.map(x => (
      <div
        key={x.value}
        className={`toggle-button-option ${value === x.value ? 'active' : ''}`}
        onClick={() => onChange({ value: x.value })}
      >
        {x.title}
      </div>
    ))}
  </div>
);
