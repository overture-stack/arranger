import React from 'react';
import State from '../State';
import './Input.css';

export default ({
  className,
  style,
  icon,
  rightIcon,
  componentRef,
  Component = 'input',
  ...props
}) => (
  <State
    initial={{ isFocused: false }}
    render={({ update, isFocused }) => (
      <div
        style={{
          ...style,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
        }}
        ref={componentRef}
        className={`inputWrapper ${isFocused ? 'focused' : ''} ${className}`}
      >
        <span className="inputIcon">{icon}</span>
        <Component
          onFocus={() => update({ isFocused: true })}
          onBlur={() => update({ isFocused: false })}
          style={{ border: 'none', flex: 1 }}
          {...props}
          autoFocus
        />
        <span className="inputRightIcon">{rightIcon}</span>
      </div>
    )}
  />
);
