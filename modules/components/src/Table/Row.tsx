import { css } from '@emotion/react';
import { Row } from '@tanstack/react-table';
import cx from 'classnames';

import { useThemeContext } from '@/ThemeContext';
import { emptyObj } from '@/utils/noops';

const TableRow = ({
  padding: themeTablePadding,
  row,
  textOverflow: themeTableTextOverflow,
  ...props
}: {
  padding?: string;
  row: Row<Record<string, any>>;
  textOverflow?: string;
}) => {
  const {
    components: {
      Table: {
        Row: {
          background: themeBackground,
          borderColor: themeBorderColor,
          className: themeClassName,
          css: themeCSS,
          fontColor: themeFontColor,
          fontFamily: themeFontFamily,
          fontSize: themeFontSize,
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
  } = useThemeContext({ callerName: 'Table - Row' });

  return (
    <tr
      className={cx('Row', themeClassName)}
      css={css`
        background: ${themeBackground};
        color: ${themeFontColor};
        font-family: ${themeFontFamily};
        font-size: ${themeFontSize};
        font-weight: ${themeFontWeight};
        letter-spacing: ${themeLetterSpacing};
        line-height: ${themeLineHeight};
        position: ${themePosition};

        &:first-of-type {
          padding-top: 0.2rem;
        }

        &:not(:last-of-type) {
          border-bottom: ${themeBorderColor && `0.1rem solid ${themeBorderColor}`};
        }
      `}
      {...props}
    >
      {row.getVisibleCells().map((cellObj) => {
        const { key: cellKey, ...otherCellProps } = cellObj.getCellProps();

        return (
          <td
            className={cx('cell')}
            css={[
              css`
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
              `,
              themeCSS,
            ]}
            key={cellKey}
            {...otherCellProps}
          >
            {cellObj.renderCell()}
          </td>
        );
      })}
    </tr>
  );
};

export default TableRow;
