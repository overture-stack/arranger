import { PropsWithChildren } from 'react';
import { css } from '@emotion/react';
import cx from 'classnames';

import { useThemeContext } from '@/ThemeContext';
import { emptyObj } from '@/utils/noops';

const Cell = ({
  children,
  colSpan,
  theme: { padding: themeTablePadding, textOverflow: themeTableTextOverflow } = emptyObj,
  value = '',
}: PropsWithChildren<{
  colSpan?: number;
  theme?: {
    padding?: string;
    textOverflow?: string;
  };
  value?: string;
}>) => {
  const {
    components: {
      Table: {
        Row: {
          borderColor: themeBorderColor,
          overflow: themeOverflow = 'hidden',
          padding: themePadding = themeTablePadding,
          textDecoration: themeTextDecoration,
          textOverflow: themeTextOverflow = themeTableTextOverflow,
          textTransform: themeTextTransform,
          verticalBorderColor: themeVerticalBorderColor,
          whiteSpace: themeWhiteSpace,
        } = emptyObj,
      } = emptyObj,
    } = emptyObj,
  } = useThemeContext({ callerName: 'Table - Row' });
  const verticalBorderColor = themeVerticalBorderColor || themeBorderColor;

  return (
    <td
      className={cx('cell')}
      colSpan={colSpan}
      css={css`
        overflow: ${themeOverflow};
        padding: ${themePadding};
        text-align: left;
        text-decoration: ${themeTextDecoration};
        text-overflow: ${themeTextOverflow};
        text-transform: ${themeTextTransform};
        white-space: ${themeWhiteSpace};

        &:not(:last-of-type) {
          border-right: ${verticalBorderColor && `1px solid ${verticalBorderColor}`};
        }
      `}
      data-value={value}
      title={value}
    >
      {children}
    </td>
  );
};

export default Cell;
