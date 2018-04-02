import { omit } from 'lodash';
import React from 'react';
import State from '../State';
import './Input.css';

export default ({ style, icon, rightIcon, ...rest }) => (
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
        className={`inputWrapper ${isFocused ? 'focused' : ''}`}
      >
        <span className="inputIcon">{icon}</span>
        <input
          onFocus={() => update({ isFocused: true })}
          onBlur={() => update({ isFocused: false })}
          style={{ border: 'none', flex: 1 }}
          {...rest}
        />
        <span className="inputRightIcon">{rightIcon}</span>
      </div>
    )}
  />
);
