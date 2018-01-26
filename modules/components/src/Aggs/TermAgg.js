import React from 'react';
import { orderBy } from 'lodash';

export default ({
  field = '',
  displayName = 'Unnamed Field',
  buckets = [],
  handleValueClick = () => {},
  isActive = () => {},
  Content = 'div',
}) => {
  const dotField = field.replace(/__/g, '.');

  return (
    <div className="test-term-aggregation aggregation-card">
      <div className="title-wrapper">
        <span className="title">{displayName}</span>
      </div>
      <div className="bucket">
        {orderBy(buckets, 'doc_count', 'desc')
          // .slice(0, props.showingMore ? Infinity : 5)
          .map(b => ({ ...b, name: b.key_as_string || b.key }))
          .map(bucket => (
            <Content
              key={bucket.name}
              className="bucket-item"
              style={{ display: 'flex' }}
              content={{
                field: dotField,
                value: bucket.name,
              }}
            >
              <span className="bucket-link" merge="toggle">
                <input
                  readOnly
                  type="checkbox"
                  style={{
                    pointerEvents: 'none',
                    marginRight: '5px',
                    flexShrink: 0,
                    verticalAlign: 'middle',
                  }}
                  checked={isActive({
                    field: dotField,
                    value: bucket.name,
                  })}
                  id={`input-${field}-${bucket.name.replace(/\s/g, '-')}`}
                  name={`input-${field}-${bucket.name.replace(/\s/g, '-')}`}
                />
                {bucket.name}
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
              <span className="bucket-count">
                {bucket.doc_count.toLocaleString()}
              </span>
            </Content>
          ))}
      </div>
    </div>
  );
};
