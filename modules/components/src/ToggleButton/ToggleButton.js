import React from 'react';
import './ToggleButton.css';

export default ({
  value: controlledValue,
  options = [],
  onChange = () => {},
}) => (
  <div className="toggle-button">
    {options.map(({ title, value }) => (
      <div
        key={value}
        className={`toggle-button-option ${
          controlledValue === value ? 'active' : ''
        }`}
        onClick={() => onChange({ value })}
      >
        {title}
      </div>
    ))}
  </div>
);
