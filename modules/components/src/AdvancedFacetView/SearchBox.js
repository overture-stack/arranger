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
      <div>
        <Input
          value={currentValue}
          onChange={e => update({ currentValue: e.target.value })}
        />
        <div style={{ maxHeight: 300, overflow: 'scroll' }}>
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
                    (currentValue?.length ? currentValue : null)?.toLowerCase(),
                  ) > -1,
            )
            .map(({ displayName, field, ...rest }) => (
              <div onClick={() => onFieldSelect(field)}>{displayName}</div>
            ))}
        </div>
      </div>
    )}
  />
);
