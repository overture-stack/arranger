import React from 'react';
import { css } from '@emotion/react';
import { isEqual } from 'lodash';

import strToReg from '../utils/strToReg';

class TextHighlight extends React.Component {
  shouldComponentUpdate(nextProps) {
    return !isEqual(nextProps, this.props);
  }

  render() {
    const { content, highlightClassName, highlightColor = '#f7ed9c', highlightText } = this.props;

    if (highlightText) {
      const regex = strToReg(highlightText, { modifiers: 'i' });
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
            className={highlightClassName}
            css={css`
              background: ${highlightColor};
            `}
          >
            {foundQuery}
          </span>
          {seg2}
        </span>
      );
    }

    return <span className="textHighlight">{content}</span>;
  }
}

export default TextHighlight;
