import React from 'react';
import { compose, withState } from 'recompose';
import { isEmpty, orderBy, partition, truncate } from 'lodash';
import DefaultSearchIcon from 'react-icons/lib/fa/search';
import { css } from 'emotion';

import './AggregationCard.css';

import { removeSQON, toggleSQON } from '../SQONView/utils';
import AggsWrapper from './AggsWrapper';
import TextHighlight from '../TextHighlight';
import './TermAgg.css';
import ToggleButton from '../ToggleButton';
import internalTranslateSQONValue from '../utils/translateSQONValue';
import Input from '../Input';
import strToReg from '../utils/strToReg';
import formatNumber from '../utils/formatNumber';

const generateNextSQON = ({ dotField, bucket, isExclude, sqon }) =>
  toggleSQON(
    {
      op: 'and',
      content: [
        {
          op: isExclude ? 'not-in' : 'in',
          content: {
            field: dotField,
            value: [].concat(bucket.name || []),
          },
        },
      ],
    },
    sqon,
  );

const IncludeExcludeButton = ({
  dotField,
  buckets,
  isActive,
  isExclude,
  updateIsExclude,
  handleIncludeExcludeChange,
}) => (
  <ToggleButton
    value={isExclude ? 'exclude' : 'include'}
    options={[
      { title: 'Include', value: 'include' },
      { title: 'Exclude', value: 'exclude' },
    ]}
    onChange={({ value, isExclude = value === 'exclude' }) => {
      const activeBuckets = buckets.filter(b =>
        isActive({ field: dotField, value: b.name }),
      );
      handleIncludeExcludeChange({
        isExclude,
        buckets: activeBuckets,
        generateNextSQON: sqon =>
          activeBuckets.reduce(
            (q, bucket) =>
              generateNextSQON({ dotField, isExclude, bucket, sqon: q }),
            removeSQON(dotField, sqon),
          ),
      });
      updateIsExclude(isExclude);
    }}
  />
);

const MoreOrLessButton = ({ howManyMore, isMore, onClick }) => (
  <div
    className={`showMore-wrapper ${isMore ? 'more' : 'less'}`}
    onClick={onClick}
  >
    {isMore ? `${howManyMore} More` : 'Less'}
  </div>
);

const decorateBuckets = ({ buckets, searchText }) => {
  const namedFilteredBuckets = buckets
    .map(b => ({ ...b, name: b.key_as_string || b.key }))
    .filter(
      b =>
        !searchText ||
        internalTranslateSQONValue(b.name).match(strToReg(searchText)),
    );
  const [missing, notMissing] = partition(namedFilteredBuckets, {
    name: '__missing__',
  });
  return [...orderBy(notMissing, 'doc_count', 'desc'), ...missing];
};

const enhance = compose(
  withState('stateShowingMore', 'setShowingMore', false),
  withState('stateIsExclude', 'setIsExclude', false),
  withState('stateShowingSearch', 'setShowingSearch', false),
  withState('searchText', 'setSearchText', ''),
);

const TermAgg = ({
  field = '',
  displayName = 'Unnamed Field',
  headerTitle = null,
  buckets = [],
  handleValueClick = () => {},
  isActive = () => {},
  Content = 'div',
  SearchIcon = DefaultSearchIcon,
  maxTerms = 5,
  collapsible = true,
  isExclude: externalIsExclude = () => {},
  showExcludeOption = false,
  handleIncludeExcludeChange = () => {},
  constructEntryId = ({ value }) => value,
  valueCharacterLimit,
  observableValueInFocus = null,
  WrapperComponent,
  highlightText,
  constructBucketItemClassName = () => '',
  searchPlaceholder = 'Search',
  containerRef,
  aggWrapperRef = React.createRef(),
  aggHeaderRef = React.createRef(),
  scrollToAgg = () => {
    if (containerRef?.current)
      containerRef.current.scrollTop =
        aggWrapperRef.current.offsetTop -
        aggHeaderRef.current.getBoundingClientRect().height;
  },

  // Internal State
  stateShowingMore,
  setShowingMore,
  stateIsExclude,
  setIsExclude,
  stateShowingSearch,
  setShowingSearch,
  searchText,
  setSearchText,
  InputComponent = Input,
}) => {
  const decoratedBuckets = decorateBuckets({ buckets, searchText });
  const dotField = field.replace(/__/g, '.');
  const isExclude = externalIsExclude({ field: dotField }) || stateIsExclude;
  const hasSearchHit =
    highlightText &&
    decoratedBuckets.some(x => x.name.match(strToReg(searchText)));
  const showingMore = stateShowingMore || hasSearchHit;
  const isMoreEnabled = decoratedBuckets.length > maxTerms;
  return (
    <AggsWrapper
      componentRef={aggWrapperRef}
      headerRef={aggHeaderRef}
      stickyHeader
      {...{ displayName, WrapperComponent, collapsible }}
      ActionIcon={
        <DefaultSearchIcon
          onClick={() => setShowingSearch(!stateShowingSearch)}
        />
      }
      filters={[
        ...(stateShowingSearch
          ? [
              <>
                <InputComponent
                  className={css`
                    flex-grow: 1;
                  `}
                  type="text"
                  value={searchText}
                  placeholder={searchPlaceholder}
                  icon={<DefaultSearchIcon />}
                  onChange={({ target: { value } }) =>
                    setSearchText(value || '')
                  }
                  setSearchText={setSearchText}
                  aria-label={`Search data`}
                />
                {showingMore && isMoreEnabled && (
                  <MoreOrLessButton
                    isMore={false}
                    onClick={() => {
                      setShowingMore(false);
                      setShowingSearch(false);
                      scrollToAgg();
                    }}
                  />
                )}
              </>,
            ]
          : []),
        ...(showExcludeOption && !isEmpty(decoratedBuckets)
          ? [
              <IncludeExcludeButton
                {...{
                  dotField,
                  isActive,
                  isExclude,
                  handleIncludeExcludeChange,
                  buckets: decoratedBuckets,
                  updateIsExclude: setIsExclude,
                }}
              />,
            ]
          : []),
      ]}
    >
      <>
        {headerTitle && <div className={`header`}>{headerTitle}</div>}
        <div className={`bucket`}>
          {decoratedBuckets
            .slice(0, showingMore ? Infinity : maxTerms)
            .map((bucket, i, array) => (
              <Content
                id={constructEntryId({ value: bucket.name })}
                key={bucket.name}
                className={`bucket-item ${constructBucketItemClassName({
                  bucket,
                  i,
                  showingBuckets: array,
                  showingMore,
                }) || ''}`}
                content={{
                  field: dotField,
                  value: bucket.name,
                }}
                onClick={() =>
                  handleValueClick({
                    field: dotField,
                    value: bucket,
                    isExclude,
                    generateNextSQON: sqon =>
                      generateNextSQON({ isExclude, dotField, bucket, sqon }),
                  })
                }
              >
                <span className="bucket-link" merge="toggle">
                  <input
                    readOnly
                    type="checkbox"
                    checked={isActive({
                      field: dotField,
                      value: bucket.name,
                    })}
                    aria-label={`Select ${bucket.name}`}
                    id={`input-${field}-${bucket.name.replace(/\s/g, '-')}`}
                    name={`input-${field}-${bucket.name.replace(/\s/g, '-')}`}
                  />
                  <TextHighlight
                    content={
                      truncate(internalTranslateSQONValue(bucket.name), {
                        length: valueCharacterLimit || Infinity,
                      }) + ' '
                    }
                    highlightText={highlightText}
                  />
                </span>
                {bucket.doc_count && (
                  <span className="bucket-count">
                    {formatNumber(bucket.doc_count)}
                  </span>
                )}
              </Content>
            ))}
        </div>
        {isMoreEnabled && (
          <MoreOrLessButton
            isMore={!showingMore}
            onClick={() => {
              setShowingMore(!showingMore);
              setShowingSearch(!showingMore);
              if (showingMore) scrollToAgg();
            }}
            howManyMore={decoratedBuckets.length - maxTerms}
          />
        )}
      </>
    </AggsWrapper>
  );
};

export default enhance(TermAgg);
