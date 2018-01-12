import React from 'react';
import _ from 'lodash';
// import { Route } from 'react-router-dom'
// import Link from './Link'
// import { parse } from 'query-string'
// import { inCurrentFilters } from './filters'
// import Location from './Location'

export default ({
  handleFieldClick = () => {},
  isActive = () => {},
  field = '',
  buckets = [],
  title = '',
  displayName = 'Unnamed Field',
}) => {
  const dotField = field.replace(/__/g, '.');
  const filteredBuckets = buckets;

  return (
    <div className="test-term-aggregation">
      <div>
        <span>{displayName}</span>
      </div>
      <div>
        {_.orderBy(filteredBuckets, 'doc_count', 'desc')
          // .slice(0, props.showingMore ? Infinity : 5)
          .map(b => ({ ...b, name: b.key_as_string || b.key }))
          .map(bucket => (
            <div
              key={bucket.name}
              className="bucket-item"
              style={{ display: 'flex' }}
              onClick={() =>
                handleFieldClick({
                  field: dotField,
                  value: bucket.name,
                })
              }
            >
              {/* <Location> */}
              {/* {p => ( */}
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
                  id={`input-${title}-${bucket.name.replace(/\s/g, '-')}`}
                  name={`input-${title}-${bucket.name.replace(/\s/g, '-')}`}
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
              {/* )} */}
              {/* </Location> */}
              <span className="bucket-count">
                {bucket.doc_count.toLocaleString()}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
};
