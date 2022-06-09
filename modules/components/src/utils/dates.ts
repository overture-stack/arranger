import { format, isValid, parseISO } from 'date-fns';
import { isNil } from 'lodash';

export const STANDARD_DATE = 'yyyy-MM-dd';

const displayFormatter = (value: string, { displayFormat = STANDARD_DATE, ...props }: any) => {
  switch (true) {
    case isNil(value):
      return '';

    case isValid(new Date(value)):
      return format(new Date(value), displayFormat);

    case isValid(parseISO(value)):
      return format(parseISO(value), displayFormat);

    case !isNaN(parseInt(value, 10)):
      return format(parseInt(value, 10), displayFormat);

    default: {
      console.error('unhandled data', value, props);
      return value;
    }
  }
};

export default displayFormatter;
