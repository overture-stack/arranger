import React from 'react';

export default ({ content, highlightText }) => {
  const regex = new RegExp(highlightText, 'i');
  const matchResult = content.match(regex);
  const foundIndex = matchResult.index;
  const seg1 = content.substring(0, foundIndex);
  const foundQuery = matchResult[0];
  const seg2 = content.substring(
    foundIndex + foundQuery.length,
    content.length,
  );
  return (
    <span className="textHighlight">
      {seg1}
      <span className="matched">{foundQuery}</span>
      {seg2}
    </span>
  );
};
