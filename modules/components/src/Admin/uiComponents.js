import React from 'react';

export const FancyLabel = ({ children, className, ...props }) => (
  <label className={`fancy-label ${className}`} {...props}>
    {children}
  </label>
);

export const Emoji = ({ label = '', content, ...props }) => (
  <span aria-label={label} role="img" {...props}>
    {content}
  </span>
);
