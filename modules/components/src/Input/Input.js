import { omit } from 'lodash';
import React from 'react';
import State from '../State';
import './Input.css';

export default props => (
  <State
    initial={{ isFocused: false }}
    render={({ update, isFocused }) => (
      <div
        style={{
          ...props.style,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
        }}
        className={`inputWrapper ${isFocused ? 'focused' : ''}`}
      >
        <span className="inputIcon">{props.icon}</span>
        <input
          onFocus={() => update({ isFocused: true })}
          onBlur={() => update({ isFocused: false })}
          style={{ border: 'none', flex: 1 }}
          {...omit(props, 'style')}
        />
        <span className="inputRightIcon">{props.rightIcon}</span>
      </div>
    )}
  />
);
