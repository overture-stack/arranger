import React from 'react';
import FilterIcon from 'react-icons/lib/fa/filter';

import TextInput from '../Input';
import { replaceFilterSQON } from '../SQONView/utils';

export const generateNextSQON = value => ({ sqon, fields, entity }) =>
  replaceFilterSQON(
    {
      op: 'and',
      content: [
        {
          op: 'filter',
          content: {
            fields: fields,
            value,
            ...(entity && { entity }),
          },
        },
      ],
    },
    sqon,
  );

const TextFilter = ({
  value,
  onChange,
  Icon = FilterIcon,
  placeholder = 'Filter',
}) => (
  <TextInput
    icon={<Icon />}
    type="text"
    placeholder={placeholder}
    value={value}
    onChange={({ target: { value } }) => {
      onChange({
        value,
        generateNextSQON: generateNextSQON(value),
      });
    }}
  />
);

export default TextFilter;
