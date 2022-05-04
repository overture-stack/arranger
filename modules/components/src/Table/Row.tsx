import { css } from '@emotion/react';
import { Row } from '@tanstack/react-table';
import cx from 'classnames';

import { useThemeContext } from '@/ThemeContext';
import { emptyObj } from '@/utils/noops';

import { getDisplayValue } from './helpers';

const TableRow = ({
  padding: themeTablePadding,
  textOverflow: themeTableTextOverflow,
  ...props
}: {
  padding?: string;
  textOverflow?: string;
} & Row<Record<string, any>>) => {
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

  const visibleCells = props.getVisibleCells();
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
    >
      {visibleCells.map((cellObj) => {

        const value = getDisplayValue(cellObj?.row?.original, cellObj.column);

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
            data-value={value}
            key={cellObj.id}
            title={value}
          >
            {cellObj.renderCell()}
          </td>
        );
      })}
    </tr>
  );
};

export default TableRow;
