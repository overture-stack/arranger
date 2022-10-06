import { createRef, useState } from 'react';
import { css } from '@emotion/react';
import { isEmpty, orderBy, partition, truncate } from 'lodash';
import { FaSearch } from 'react-icons/fa';
import cx from 'classnames';

import { TransparentButton } from '@/Button';
import { removeSQON, toggleSQON } from '@/SQONViewer/utils';
import TextFilter from '@/TextFilter';
import TextHighlight from '@/TextHighlight';
import { useThemeContext } from '@/ThemeContext';
import ToggleButton from '@/ToggleButton';
import formatNumber from '@/utils/formatNumber';
import noopFn, { emptyObj, emptyStrFn } from '@/utils/noops';
import strToReg from '@/utils/strToReg';
import internalTranslateSQONValue from '@/utils/translateSQONValue';

import AggsWrapper from './AggsWrapper';
import BucketCount from './BucketCount';

const generateNextSQON = ({ dotFieldName, bucket, isExclude, sqon }) =>
  toggleSQON(
    {
      op: 'and',
      content: [
        {
          op: isExclude ? 'not-in' : 'in',
          content: {
            fieldName: dotFieldName,
            value: [].concat(bucket.name || []),
          },
        },
      ],
    },
    sqon,
  );

const IncludeExcludeButton = ({
  buckets,
  dotFieldName,
  handleIncludeExcludeChange,
  isActive,
  isExclude,
  ToggleButtonThemeProps,
  updateIsExclude,
}) => (
  <ToggleButton
    onChange={({ value, isExclude = value === 'exclude' }) => {
      const activeBuckets = buckets.filter((b) =>
        isActive({ fieldName: dotFieldName, value: b.name }),
      );
      handleIncludeExcludeChange({
        isExclude,
        buckets: activeBuckets,
        generateNextSQON: (sqon) =>
          activeBuckets.reduce(
            (q, bucket) => generateNextSQON({ dotFieldName, isExclude, bucket, sqon: q }),
            removeSQON(dotFieldName, sqon),
          ),
      });
      updateIsExclude(isExclude);
    }}
    options={[
      { title: 'Include', value: 'include' },
      { title: 'Exclude', value: 'exclude' },
    ]}
    theme={ToggleButtonThemeProps}
    value={isExclude ? 'exclude' : 'include'}
  />
);

const MoreOrLessButton = ({ className, css: customCSS, howManyMore, isMore, ...props }) => (
  <TransparentButton
    className={cx('showMore-wrapper', isMore ? 'more' : 'less', className)}
    css={css`
      margin-left: 0.5rem;
      text-decoration: underline;
      ${customCSS}
    `}
    {...props}
  >
    {isMore ? `${howManyMore} More` : 'Less'}
  </TransparentButton>
);

const decorateBuckets = ({ buckets, searchText }) => {
  const namedFilteredBuckets = buckets
    .map((b) => ({ ...b, name: b.key_as_string || b.key }))
    .filter((b) => !searchText || internalTranslateSQONValue(b.name).match(strToReg(searchText)));
  const [missing, notMissing] = partition(namedFilteredBuckets, {
    name: '__missing__',
  });
  return [...orderBy(notMissing, 'doc_count', 'desc'), ...missing];
};

const TermAgg = ({
  aggHeaderRef = createRef(),
  aggWrapperRef = createRef(),
  buckets = [],
  collapsible: customCollapsible,
  constructBucketItemClassName = emptyStrFn,
  constructEntryId = ({ value }) => value,
  containerRef,
  Content = 'div',
  displayName = 'Unnamed Field',
  fieldName = '',
  handleIncludeExcludeChange = noopFn,
  handleValueClick = noopFn,
  headerTitle = null,
  highlightText,
  InputComponent = TextFilter,
  isActive = noopFn,
  isExclude: externalIsExclude = noopFn,
  maxTerms = 5,
  scrollToAgg = () => {
    if (containerRef?.current)
      containerRef.current.scrollTop =
        aggWrapperRef.current.offsetTop - aggHeaderRef.current.getBoundingClientRect().height;
  },
  searchPlaceholder = 'Search',
  showExcludeOption = false,
  type,
  valueCharacterLimit,
  WrapperComponent,
}) => {
  const [stateShowingMore, setShowingMore] = useState(false);
  const [stateIsExclude, setIsExclude] = useState(false);
  const [stateShowingSearch, setShowingSearch] = useState(false);
  const [searchText, setSearchText] = useState('');
  const decoratedBuckets = decorateBuckets({ buckets, searchText });
  const dotFieldName = fieldName.replace(/__/g, '.');
  const isExclude = externalIsExclude({ fieldName: dotFieldName }) || stateIsExclude;
  const hasData = decoratedBuckets.length > 0;
  const hasSearchHit =
    highlightText && decoratedBuckets.some((x) => x.name.match(strToReg(searchText)));
  const showingMore = stateShowingMore || hasSearchHit;
  const isMoreEnabled = decoratedBuckets.length > maxTerms;
  const dataFields = {
    ...(fieldName && { 'data-fieldname': fieldName }),
    ...(type && { 'data-type': type }),
  };

  const {
    colors,
    components: {
      Aggregations: {
        FilterInput: themeAggregationsFilterInputProps = emptyObj,
        MoreOrLessButton: themeAggregationsMoreOrLessButtonProps = emptyObj,
        NoDataContainer: {
          fontColor: themeNoDataFontColor = colors?.grey?.[600],
          fontSize: themeNoDataFontSize = '0.8em',
        } = emptyObj,
        TermAgg: {
          BucketCount: { className: themeBucketCountClassName, ...bucketCountTheme } = emptyObj,
          collapsible: themeTermAggCollapsible = true,
          FilterInput: themeTermAggFilterInputProps = emptyObj,
          IncludeExcludeButton: ToggleButtonThemeProps = emptyObj,
          MoreOrLessButton: themeTermAggMoreOrLessButtonProps = emptyObj,
        } = emptyObj,
      } = emptyObj,
    } = emptyObj,
  } = useThemeContext({ callerName: 'TermAgg' });

  return (
    <AggsWrapper
      actionIcon={
        hasData && {
          onClick: () => setShowingSearch(!stateShowingSearch),
          Icon: FaSearch,
        }
      }
      collapsible={customCollapsible || themeTermAggCollapsible}
      componentRef={aggWrapperRef}
      dataFields={dataFields}
      headerRef={aggHeaderRef}
      filters={[
        stateShowingSearch && (
          <>
            <InputComponent
              aria-label={`Search data`}
              onChange={({ value }) => setSearchText(value || '')}
              placeholder={searchPlaceholder}
              type="text"
              value={searchText}
              {...themeAggregationsFilterInputProps}
              {...themeTermAggFilterInputProps}
            />

            {showingMore && isMoreEnabled && (
              <MoreOrLessButton
                onClick={() => {
                  setShowingMore(false);
                  scrollToAgg();
                }}
                {...themeAggregationsMoreOrLessButtonProps}
                {...themeTermAggMoreOrLessButtonProps}
              />
            )}
          </>
        ),
        showExcludeOption && !isEmpty(decoratedBuckets) && (
          <IncludeExcludeButton
            {...{
              buckets: decoratedBuckets,
              dotFieldName,
              handleIncludeExcludeChange,
              isActive,
              isExclude,
              ToggleButtonThemeProps,
              updateIsExclude: setIsExclude,
            }}
          />
        ),
      ].filter((filter) => !!filter)}
      stickyHeader
      {...{ displayName, WrapperComponent }}
    >
      <>
        {headerTitle && (
          <div
            className="header"
            css={css`
              text-align: right;
            `}
          >
            {headerTitle}
          </div>
        )}
        {hasData ? (
          <div
            css={css`
              width: 100%;
            `}
          >
            {decoratedBuckets
              .slice(0, showingMore ? Infinity : maxTerms)
              .map((bucket, i, array) => (
                <Content
                  id={constructEntryId({
                    value: `${fieldName}--${bucket.name.replace(/\s/g, '-')}`,
                  })}
                  key={bucket.name}
                  className={cx(
                    'bucket-item',
                    constructBucketItemClassName({
                      bucket,
                      i,
                      showingBuckets: array,
                      showingMore,
                    }),
                  )}
                  content={{
                    fieldName: dotFieldName,
                    value: bucket.name,
                  }}
                  css={css`
                    cursor: pointer;
                    display: flex;
                    font-size: 0.8rem;
                    justify-content: space-between;
                    margin: 0.15rem 0;
                  `}
                  onClick={() =>
                    handleValueClick({
                      fieldName: dotFieldName,
                      value: bucket,
                      isExclude,
                      generateNextSQON: (sqon) =>
                        generateNextSQON({ isExclude, dotFieldName, bucket, sqon }),
                    })
                  }
                >
                  <span
                    className="bucket-link"
                    css={css`
                      display: flex;
                    `}
                    merge="toggle"
                  >
                    <input
                      aria-label={`Select ${bucket.name}`}
                      checked={isActive({
                        fieldName: dotFieldName,
                        value: bucket.name,
                      })}
                      css={css`
                        margin: 0.2rem 0.3rem 0 0;
                      `}
                      id={`input-${fieldName}-${bucket.name.replace(/\s/g, '-')}`}
                      name={`input-${fieldName}-${bucket.name.replace(/\s/g, '-')}`}
                      readOnly
                      type="checkbox"
                    />

                    <TextHighlight
                      content={
                        truncate(internalTranslateSQONValue(bucket.name), {
                          length: valueCharacterLimit || Infinity,
                        }) + ' '
                      }
                      highlightText={searchText}
                    />
                  </span>

                  {bucket.doc_count && (
                    <BucketCount className={themeBucketCountClassName} theme={bucketCountTheme}>
                      {formatNumber(bucket.doc_count)}
                    </BucketCount>
                  )}
                </Content>
              ))}
          </div>
        ) : (
          <span
            className="no-data"
            css={css`
              color: ${themeNoDataFontColor};
              display: block;
              font-size: ${themeNoDataFontSize};
            `}
          >
            No data available
          </span>
        )}

        {isMoreEnabled && (
          <MoreOrLessButton
            howManyMore={decoratedBuckets.length - maxTerms}
            isMore={!showingMore}
            onClick={() => {
              setShowingMore(!showingMore);
              if (showingMore) scrollToAgg();
            }}
            {...themeAggregationsMoreOrLessButtonProps}
            {...themeTermAggMoreOrLessButtonProps}
          />
        )}
      </>
    </AggsWrapper>
  );
};

export default TermAgg;
