import React from 'react';
import State from '../State';
import Input from '../Input';

import { filterOutNonValue } from './utils.js';

export default ({
  withValueOnly,
  elasticMapping,
  extendedMapping,
  aggregations,
  onFieldSelect = () => {},
}) => (
  <State
    initial={{ currentValue: null }}
    render={({ update, currentValue }) => (
      <div className="filterWrapper">
        <Input
          className="filterInput"
          value={currentValue}
          onChange={e => update({ currentValue: e.target.value })}
        />
        {
          <div className="resultList">
            {(withValueOnly
              ? filterOutNonValue({ extendedMapping, aggregations })
                  .extendedMappingWithValue
              : extendedMapping
            )
              ?.filter?.(
                ({ displayName }) =>
                  displayName
                    .toLowerCase()
                    .indexOf(
                      (currentValue?.length
                        ? currentValue
                        : null
                      )?.toLowerCase(),
                    ) > -1,
              )
              .map(({ displayName, field, ...rest }) => (
                <div
                  className="resultItem"
                  onClick={() => onFieldSelect(field)}
                >
                  <span className="title">{displayName}</span>
                  <span className="field">{field}</span>
                </div>
              ))}
          </div>
        }
      </div>
    )}
  />
);
