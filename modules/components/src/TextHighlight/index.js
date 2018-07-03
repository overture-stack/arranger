import React from 'react';
import { css } from 'emotion';
import { isEqual } from 'lodash';

import strToReg from '../utils/strToReg';

export default class extends React.Component {
  shouldComponentUpdate(nextProps) {
    return !isEqual(nextProps, this.props);
  }

  render() {
    const {
      content,
      highlightText,
      highlightClassName = css`
        background: #f7ed9c;
      `,
    } = this.props;
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
        <span className={highlightClassName}>{foundQuery}</span>
        {seg2}
      </span>
    );
  }
}
