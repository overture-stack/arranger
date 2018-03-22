import React from 'react';
import { css } from 'emotion';

export default ({ content, highlightText }) => {
  const regex = new RegExp(highlightText, 'i');
  const matchResult = content.match(regex);
  const foundIndex = matchResult?.index;
  const seg1 = content.substring(0, foundIndex);
  const foundQuery = matchResult?.[0];
  const seg2 =
    foundIndex !== undefined
      ? content.substring(foundIndex + foundQuery?.length, content.length)
      : null;

  return (
    <span className="textHighlight">
      {seg1}
      <span
        className={css`
          background: yellow;
        `}
      >
        {foundQuery}
      </span>
      {seg2}
    </span>
  );
};
