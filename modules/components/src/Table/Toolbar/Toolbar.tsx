import { useMemo } from 'react';
import { css } from '@emotion/react';
import cx from 'classnames';

import TableColumnSelectButton from '@/Table/ColumnsSelectButton';
import DownloadButton from '@/Table/DownloadButton';
import TableCounter from '@/Table/Counter';
import { useThemeContext } from '@/ThemeContext';
import getDisplayName from '@/utils/getComponentDisplayName';
import { emptyObj } from '@/utils/noops';

const TableToolbar = () => {
  const {
    components: {
      Table: {
        TableToolbar: { TableCounter: themeTableCounterProps = emptyObj } = emptyObj,
      } = emptyObj,
    } = emptyObj,
  } = useThemeContext({ callerName: 'Table - TableToolbar' });

  return useMemo(
    () => (
      <section
        className={cx('tableToolbar')}
        css={css`
          display: flex;
          flex: none;
          margin-bottom: 0.5rem;
        `}
      >
        <TableCounter
          css={css`
            margin-left: 0.3rem;

            .Spinner {
              justify-content: space-between;
              width: 65%;
            }
          `}
          theme={themeTableCounterProps}
        />

        <ul
          className="buttons"
          css={css`
            display: flex;
            list-style: none;
            margin: 0 0 0 1rem;
          `}
        >
          {/* TODO: Allow adding buttons here */}
          {[TableColumnSelectButton, DownloadButton].map((Component) => (
            <li
              css={css`
                &:not(:first-of-type) {
                  margin-left: 0.3rem;
                }
              `}
              key={getDisplayName(Component)}
            >
              <Component />
            </li>
          ))}
        </ul>
      </section>
    ),
    [themeTableCounterProps],
  );
};

export default TableToolbar;
