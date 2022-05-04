import { css } from '@emotion/react';
import { HeaderGroup } from '@tanstack/react-table';
import cx from 'classnames';
import { get } from 'lodash';

import { useThemeContext } from '@/ThemeContext';
import { emptyObj } from '@/utils/noops';

const TableHeaderRow = ({
  headers,
  padding: themeTablePadding,
  textOverflow: themeTableTextOverflow,
  ...props
}: {
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
          fontColor: themeFontColor = colors?.grey?.[800],
          fontFamily: themeFontFamily,
          fontSize: themeFontSize = '0.9rem',
          fontWeight: themeFontWeight,
          letterSpacing: themeLetterSpacing,
          lineHeight: themeLineHeight,
          overflow: themeOverflow = 'hidden',
          padding: themePadding = themeTablePadding,
          position: themePosition,
          textDecoration: themeTextDecoration,
          textOverflow: themeTextOverflow = themeTableTextOverflow,
          textTransform: themeTextTransform,
          whiteSpace: themeWhiteSpace,
        } = emptyObj,
      } = emptyObj,
    } = emptyObj,
  } = useThemeContext({ callerName: 'TableHeaderRow' });

  return (
    <tr
      className={cx('TableHeaderRow', themeClassName)}
      css={[
        css`
          background: ${themeBackground};
          color: ${themeFontColor};
          font-family: ${themeFontFamily};
          font-size: ${themeFontSize};
          font-weight: ${themeFontWeight};
          letter-spacing: ${themeLetterSpacing};
          line-height: ${themeLineHeight};
          position: ${themePosition};

          &:not(:last-of-type) {
            border-bottom: ${themeBorderColor && `0.1rem solid ${themeBorderColor}`};
          }
        `,
        themeCSS,
      ]}
    >
      {headers.map((headerObj) => {
        // TODO: lodash cheat to get around the hacky ReactTable TS mumbojumbo
        const label = get(headerObj?.column, 'displayName');

        return (
          <th
            css={css`
              overflow: ${themeOverflow};
              padding: ${themePadding};
              text-align: left;
              text-decoration: ${themeTextDecoration};
              text-overflow: ${themeTextOverflow};
              text-transform: ${themeTextTransform};
              white-space: ${themeWhiteSpace};

              &:not(:last-of-type) {
                border-right: ${themeBorderColor && `0.1rem solid ${themeBorderColor}`};
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
