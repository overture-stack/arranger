import React from 'react';
import { orderBy, truncate } from 'lodash';

import './AggregationCard.css';

import { removeSQON, toggleSQON } from '../SQONView/utils';
import AggsWrapper from './AggsWrapper';
import TextHighlight from '../TextHighlight';
import ToggleButton from '../ToggleButton';

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

class TermAggs extends React.Component {
  // needs ref

  state = { showingMore: false, isExclude: false };

  render() {
    const {
      field = '',
      displayName = 'Unnamed Field',
      buckets = [],
      decoratedBuckets = buckets.map(b => ({
        ...b,
        name: b.key_as_string || b.key,
      })),
      handleValueClick = () => {},
      isActive = () => {},
      Content = 'div',
      maxTerms = 5,
      collapsible = true,
      isExclude: externalIsExclude = () => {},
      showExcludeOption = false,
      handleIncludeExcludeChange = () => {},
      constructEntryId = ({ value }) => value,
      valueCharacterLimit,
      observableValueInFocus = null,
      WrapperComponent,
      searchString,
    } = this.props;
    const { showingMore } = this.state;
    const dotField = field.replace(/__/g, '.');
    const isExclude =
      externalIsExclude({ field: dotField }) || this.state.isExclude;
    return (
      <AggsWrapper
        {...{ displayName, WrapperComponent, collapsible }}
        filters={[
          ...(showExcludeOption
            ? [
                <IncludeExcludeButton
                  {...{
                    dotField,
                    isActive,
                    isExclude,
                    handleIncludeExcludeChange,
                    buckets: decoratedBuckets,
                    updateIsExclude: x => this.setState({ isExclude: x }),
                  }}
                />,
              ]
            : []),
        ]}
      >
        <div className={`bucket`}>
          {orderBy(decoratedBuckets, 'doc_count', 'desc')
            .slice(0, showingMore ? Infinity : maxTerms)
            .map(bucket => (
              <Content
                ref={el =>
                  (this.refs = {
                    ...this.refs,
                    [constructEntryId({ value: bucket.name })]: el,
                  })
                }
                id={constructEntryId({ value: bucket.name })}
                key={bucket.name}
                className="bucket-item"
                style={{
                  display: 'flex',
                }}
                content={{
                  field: dotField,
                  value: bucket.name,
                }}
                onClick={() =>
                  handleValueClick({
                    bucket,
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
                    id={`input-${field}-${bucket.name.replace(/\s/g, '-')}`}
                    name={`input-${field}-${bucket.name.replace(/\s/g, '-')}`}
                  />
                  <TextHighlight
                    content={truncate(bucket.name, {
                      length: valueCharacterLimit || Infinity,
                    })}
                    highlightText={searchString}
                  />
                  {/* <OverflowTooltippedLabel
                          htmlFor={`input-${props.title}-${bucket.name.replace(
                            /\s/g,
                            '-',
                          )}`}
                          style={{
                            marginLeft: '0.3rem',
                            verticalAlign: 'middle',
                          }}
                        >
                          {bucket.name}
                        </OverflowTooltippedLabel> */}
                </span>
                {bucket.doc_count && (
                  <span className="bucket-count">
                    {bucket.doc_count.toLocaleString()}
                  </span>
                )}
              </Content>
            ))}

          {buckets.length > maxTerms && (
            <div
              className={`showMore-wrapper ${showingMore ? 'less' : 'more'}`}
              onClick={() => this.setState({ showingMore: !showingMore })}
            >
              {showingMore ? 'Less' : `${buckets.length - maxTerms} More`}
            </div>
          )}
        </div>
      </AggsWrapper>
    );
  }
}

export default TermAggs;
