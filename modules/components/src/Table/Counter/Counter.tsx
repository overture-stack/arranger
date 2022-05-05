import { css } from '@emotion/react';
import pluralize from 'pluralize';
import cx from 'classnames';

import Spinner from '@/Spinner';
import { useTableContext } from '@/Table/helpers';
import { useThemeContext } from '@/ThemeContext';
import { emptyObj } from '@/utils/noops';

import { isPlural } from './helpers';
import { CounterProps } from './types';

const TableCounter = ({
  className,
  css: customCSS,
  theme: { hideLoader: customHideLoader, Spinner: customSpinnerProps = emptyObj } = emptyObj,
}: CounterProps) => {
  const { currentPage, documentType, isLoading, pageSize, missingProvider, total } =
    useTableContext({
      callerName: 'Table - TableCounter',
    });
  const {
    components: {
      Table: {
        TableCounter: {
          hideLoader: themeHideLoader,
          Spinner: themeSpinnerProps = emptyObj,
        } = emptyObj,
      } = emptyObj,
    } = emptyObj,
  } = useThemeContext({ callerName: 'Table - TableCounter' });

  const hasData = total > 0;
  const hideLoader = customHideLoader || themeHideLoader;

  const oneOrManyDocuments =
    missingProvider || pluralize(documentType, isPlural({ total, pageSize, currentPage }) ? 2 : 1);

  return (
    <article
      className={cx('currentlyDisplayed', className)}
      css={[
        css`
          align-items: center;
          display: flex;
          flex-grow: 1;
          font-size: 0.8rem;
        `,
        customCSS,
      ]}
    >
      {missingProvider ? (
        <span className="noProvider">
          The counter is missing its {missingProvider || 'context'} provider.
        </span>
      ) : isLoading ? (
        hideLoader ? null : (
          <Spinner
            theme={{
              inverted: true,
              ...themeSpinnerProps,
              ...customSpinnerProps,
            }}
          >{`Loading ${oneOrManyDocuments}...`}</Spinner>
        )
      ) : (
        <>
          <span className="showing">Showing</span>
          {hasData ? (
            <>
              <span className="numbers">
                {`${(currentPage * pageSize + 1).toLocaleString()} - ${Math.min(
                  (currentPage + 1) * pageSize,
                  total,
                ).toLocaleString()}`}
              </span>{' '}
              <span className="ofTotal">of {total?.toLocaleString()}</span>{' '}
            </>
          ) : (
            <span className="numbers">{total}</span>
          )}
          <span className="type">{oneOrManyDocuments}</span>
        </>
      )}
    </article>
  );
};

export default TableCounter;
