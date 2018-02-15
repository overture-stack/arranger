import React from 'react';
import SearchIcon from 'react-icons/lib/fa/search';

import TextInput from '../../Input';
import { replaceFilterSQON } from '../../SQONView/utils';

export const generateNextSQON = value => ({ sqon, fields }) =>
  replaceFilterSQON(
    {
      op: 'and',
      content: [
        {
          op: 'filter',
          content: {
            fields: fields,
            value,
          },
        },
      ],
    },
    sqon,
  );

const TextFilter = ({ value, onChange, Icon = SearchIcon }) => (
  <TextInput
    icon={<Icon />}
    type="text"
    placeholder="Filter"
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
