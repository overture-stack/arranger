import { css } from '@emotion/react';
import { HeaderGroup } from '@tanstack/react-table';
import cx from 'classnames';
import { get } from 'lodash';

import { useThemeContext } from '@/ThemeContext';
import { emptyObj } from '@/utils/noops';

const TableHeaderRow = ({
  hasVisibleRows,
  headers,
  padding: themeTablePadding,
  textOverflow: themeTableTextOverflow,
}: {
  hasVisibleRows?: boolean;
  padding?: string;
  textOverflow?: string;
} & HeaderGroup<any>) => {
  const {
    colors,
    components: {
      Table: {
        HeaderRow: {
          background: themeBackground,
          borderColor: themeBorderColor,
          className: themeClassName,
          css: themeCSS,
          disabledBackground: themeDisabledBackground = colors?.grey?.[100],
          disabledFontColor: themeDisabledFontColor = colors?.grey?.[500],
          fontColor: themeFontColor = colors?.grey?.[800],
          fontFamily: themeFontFamily,
          fontSize: themeFontSize = '0.9rem',
          fontWeight: themeFontWeight,
          horizontalBorderColor: themeHorizontalBorderColor,
          letterSpacing: themeLetterSpacing,
          lineHeight: themeLineHeight,
          overflow: themeOverflow = 'hidden',
          padding: themePadding = themeTablePadding,
          position: themePosition,
          textDecoration: themeTextDecoration,
          textOverflow: themeTextOverflow = themeTableTextOverflow,
          textTransform: themeTextTransform,
          verticalalBorderColor: themeVerticalBorderColor,
          whiteSpace: themeWhiteSpace,
        } = emptyObj,
      } = emptyObj,
    } = emptyObj,
  } = useThemeContext({ callerName: 'TableHeaderRow' });

  const horizontalBorderColor = themeHorizontalBorderColor || themeBorderColor;
  const verticalBorderColor = themeVerticalBorderColor || themeBorderColor;

  return (
    <tr
      className={cx('TableHeaderRow', themeClassName)}
      css={[
        themeCSS,
        css`
          background: ${hasVisibleRows ? themeBackground : themeDisabledBackground};
          color: ${hasVisibleRows ? themeFontColor : themeDisabledFontColor};
          font-family: ${themeFontFamily};
          font-size: ${themeFontSize};
          font-weight: ${themeFontWeight};
          letter-spacing: ${themeLetterSpacing};
          line-height: ${themeLineHeight};
          position: ${themePosition};

          &:not(:last-of-type) {
            border-bottom: ${horizontalBorderColor && `0.1rem solid ${horizontalBorderColor}`};
          }
        `,
      ]}
    >
      {headers.map((headerObj) => {
        // TODO: lodash cheat to get around the hacky ReactTable TS mumbojumbo
        const label = get(headerObj?.column, 'displayName');

        return (
          <th
            className={cx('table_header', headerObj.id)}
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
            data-accessor={headerObj.id}
            data-header={label}
            key={headerObj.id}
            title={label}
          >
            {headerObj.isPlaceholder ? null : headerObj.renderHeader()}
          </th>
        );
      })}
    </tr>
  );
};

export default TableHeaderRow;
