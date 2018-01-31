import React from 'react';

export default ({ height, eshost, handleOnChange, style, className = '' }) => (
  <div className={`row ${className}`} style={style}>
    <div
      className="title-arranger"
      css={`
        line-height: ${height}px;
        padding: 0 10px;
      `}
    >
      {process.env.STORYBOOK_ADMIN_TITLE || ARRANGER}
    </div>
    <div
      className="title-elasticsearch"
      css={`
        line-height: ${height}px;
        padding: 0 10px;
      `}
    >
      ELASTICSEARCH HOST :
    </div>
    <input className="eshost-input" value={eshost} onChange={handleOnChange} />
  </div>
);
