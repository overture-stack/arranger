import { FaSearch } from 'react-icons/fa';

import TextInput from '@/Input';
import { replaceFilterSQON } from '@/SQONViewer/utils';
import noopFn from '@/utils/noopFns';

export const generateNextSQON =
  (value) =>
  ({ sqon, fields, entity }) =>
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
  Component = TextInput,
  leftIcon = { Icon: FaSearch },
  onChange = noopFn,
  placeholder = 'Filter',
  ...props
}) => {
  const handleChange = ({ target: { value } = {} } = {}) => {
    onChange({
      value,
      generateNextSQON: generateNextSQON(value),
    });
  };

  return (
    <Component
      aria-label={`Data filter`}
      leftIcon={leftIcon}
      onChange={handleChange}
      placeholder={placeholder}
      type="text"
      {...props}
    />
  );
};

export default TextFilter;
