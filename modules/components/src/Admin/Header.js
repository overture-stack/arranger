import React from 'react';

export default ({ height, eshost, handleOnChange }) => (
  <div className="row">
    <div
      className="title-arranger"
      css={`
        line-height: ${height}px;
        padding: 0 10px;
      `}
    >
      ARRANGER
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
