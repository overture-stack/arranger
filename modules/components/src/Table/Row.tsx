import { css } from '@emotion/react';
import { flexRender, Row } from '@tanstack/react-table';
import cx from 'classnames';

import MetaMorphicChild from '@/MetaMorphicChild';
import { useThemeContext } from '@/ThemeContext';
import { emptyObj } from '@/utils/noops';

import { getDisplayValue } from './helpers';
import Cell from './Cell';

const TableRow = ({
  id,
  theme: { padding: themeTablePadding, textOverflow: themeTableTextOverflow } = emptyObj,
  ...props
}: {
  id?: string;
  theme?: {
    padding?: string;
    textOverflow?: string;
  };
} & Partial<Row<unknown>>) => {
  const {
    colors,
    components: {
      Table: {
        noDataMessage = 'No data matches the search parameters.',
        Row: {
          background: themeBackground,
          borderColor: themeBorderColor,
          className: themeClassName,
          css: themeCSS,
          fontColor: themeFontColor,
          fontFamily: themeFontFamily,
          fontSize: themeFontSize,
          fontWeight: themeFontWeight,
          horizontalBorderColor: themeHorizontalBorderColor,
          hoverBackground: themeHoverBackground = colors?.grey?.[100],
          letterSpacing: themeLetterSpacing,
          lineHeight: themeLineHeight,
          position: themePosition,
          selectedBackground: themeSelectedBackground = colors?.grey?.[300],
        } = emptyObj,
      } = emptyObj,
    } = emptyObj,
  } = useThemeContext({ callerName: 'Table - Row' });

  const horizontalBorderColor = themeHorizontalBorderColor || themeBorderColor;
  const visibleCells = props?.getVisibleCells?.();
  const hasVisibleCells = visibleCells && visibleCells.length > 0;

  return (
    <tr
      className={cx('Row', themeClassName, { selected: props?.getIsSelected?.() })}
      css={[
        themeCSS,
        css`
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
            border-bottom: ${horizontalBorderColor && `0.1rem solid ${horizontalBorderColor}`};
          }

          &.selected {
            background-color: ${themeSelectedBackground};
          }

          &[data-row-id]:hover {
            background: ${themeHoverBackground};
          }
        `,
      ]}
      data-row-id={id}
    >
      {hasVisibleCells ? (
        visibleCells?.map((cellObj) => {
          const value = getDisplayValue(cellObj?.row?.original, cellObj.column.columnDef);

          return (
            <Cell
              accessor={cellObj.column.id}
              key={cellObj.id}
              value={value}
              theme={{ padding: themeTablePadding, textOverflow: themeTableTextOverflow }}
            >
              {flexRender(cellObj.column.columnDef.cell, cellObj.getContext())}
            </Cell>
          );
        })
      ) : (
        <Cell
          colSpan={100}
          theme={{ padding: themeTablePadding, textOverflow: themeTableTextOverflow }}
        >
          <MetaMorphicChild>{noDataMessage}</MetaMorphicChild>
        </Cell>
      )}
    </tr>
  );
};

export default TableRow;
