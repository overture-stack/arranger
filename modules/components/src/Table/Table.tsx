import { css } from '@emotion/react';
import cx from 'classnames';

import Spinner from '@/Spinner';
import { useThemeContext } from '@/ThemeContext';
import { emptyObj } from '@/utils/noops';

import { useTableData } from './helpers';
import TableHeaderRow from './HeaderRow';
import RewriteWarning from './RewriteWarning';
import TableRow from './Row';
import TableWrapper from './Wrapper';
import { TableProps } from './types';

const Table = ({ customCells, hideWarning = false }: TableProps) => {
  const { isLoading, providerMissing, tableInstance } = useTableData({
    customCells,
  });
  const {
    colors,
    components: {
      Table: {
        borderColor: themeTableBorderColor = colors?.grey?.[200],
        fontColor: themeTableFontColor = colors?.grey?.[700],
        fontFamily: themeTableFontFamily,
        fontSize: themeTableFontSize = '0.8rem',
        fontWeight: themeTableFontWeight,
        letterSpacing: themeTableLetterSpacing,
        lineHeight: themeTableLineHeight,
        margin: themeTableMargin,
        padding: themeTablePadding = '0.1rem 0.4rem',
        textDecoration: themeTableTextDecoration,
        textOverflow: themeTableTextOverflow = 'ellipsis',
        textTransform: themeTableTextTransform,
        whiteSpace: themeTableWhiteSpace = 'nowrap',

        // Child Components
        HeaderGroup: {
          background: themeHeaderGroupBackground,
          borderColor: themeHeaderGroupBorderColor = themeTableBorderColor,
          borderRadius: themeHeaderGroupBorderRadius,
          className: themeHeaderGroupClassName,
          css: themeHeaderGroupCSS,
          margin: themeHeaderGroupMargin,
          overflow: themeHeaderGroupOverflow,
          position: themeHeaderGroupPosition,
        } = emptyObj,
        TableBody: {
          background: themeTableBodyBackground,
          borderColor: themeTableBodyBorderColor = themeTableBorderColor,
          borderRadius: themeTableBodyBorderRadius,
          className: themeTableBodyClassName,
          css: themeTableBodyCSS,
          margin: themeTableBodyMargin,
          overflow: themeTableBodyOverflow,
          position: themeTableBodyPosition,
        } = emptyObj,
        TableWrapper: {
          className: themeTableWrapperClassName,
          css: themeTableWrapperCSS,
          key: themeTableWrapperKey = 'ArrangerTableWrapper',
          ...themeTableWrapperProps
        } = emptyObj,
      } = emptyObj,
    } = emptyObj,
  } = useThemeContext({ callerName: 'Table' });

  return hideWarning ? (
    <TableWrapper
      className={cx('TableWrapper', themeTableWrapperClassName)}
      css={themeTableWrapperCSS}
      key={themeTableWrapperKey}
      margin={themeTableMargin}
      {...themeTableWrapperProps}
    >
      {providerMissing ? (
        <div>The table is missing one of its Context providers.</div>
      ) : isLoading ? (
        <Spinner />
      ) : (
        <table
          css={css`
            border-collapse: collapse;
            color: ${themeTableFontColor};
            font-family: ${themeTableFontFamily};
            font-size: ${themeTableFontSize};
            font-weight: ${themeTableFontWeight};
            letter-spacing: ${themeTableLetterSpacing};
            line-height: ${themeTableLineHeight};
            text-decoration: ${themeTableTextDecoration};
            text-transform: ${themeTableTextTransform};
            white-space: ${themeTableWhiteSpace};
            width: 100%;
          `}
        >
          <thead
            className={cx('TableHeaderGroup', themeHeaderGroupClassName)}
            css={[
              css`
                background: ${themeHeaderGroupBackground};
                border: ${themeHeaderGroupBorderColor &&
                `1px solid ${themeHeaderGroupBorderColor}`};
                border-radius: ${themeHeaderGroupBorderRadius};
                margin: ${themeHeaderGroupMargin};
                overflow: ${themeHeaderGroupOverflow};
                position: ${themeHeaderGroupPosition};
              `,
              themeHeaderGroupCSS,
            ]}
          >
            {tableInstance.getHeaderGroups().map((headerGroup) => (
              <TableHeaderRow
                key={headerGroup.id}
                padding={themeTablePadding}
                textOverflow={themeTableTextOverflow}
                {...headerGroup}
              />
            ))}
          </thead>

          <tbody
            className={cx('TableBody', themeTableBodyClassName)}
            css={[
              css`
                background: ${themeTableBodyBackground};
                border: ${themeTableBodyBorderColor && `1px solid ${themeTableBodyBorderColor}`};
                border-radius: ${themeTableBodyBorderRadius};
                margin: ${themeTableBodyMargin};
                overflow: ${themeTableBodyOverflow};
                position: ${themeTableBodyPosition};
              `,
              themeTableBodyCSS,
            ]}
          >
            {tableInstance.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                padding={themeTablePadding}
                textOverflow={themeTableTextOverflow}
                {...row}
              />
            ))}
          </tbody>
        </table>
      )}
    </TableWrapper>
  ) : (
    <RewriteWarning />
  );
};

export default Table;
