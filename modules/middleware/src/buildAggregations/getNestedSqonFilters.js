import { AND_OP, OR_OP, NOT_OP } from '../constants';

const getNestedSqonFilters = ({
  sqon = null,
  nestedFields,
  accumulator = {},
}) => {
  const op = sqon.op;
  if (![AND_OP, OR_OP, NOT_OP].includes(op)) {
    const { content: { field } } = sqon;
    const splitted = field.split('.') || '';
    const parentPath = splitted.slice(0, splitted.length - 1).join('.');
    const isNested = nestedFields.includes(
      splitted.slice(0, splitted.length - 1).join('.'),
    );
    if (splitted.length && isNested) {
      accumulator[parentPath] = [...(accumulator[parentPath] || []), sqon];
    }
  } else {
    const { content = [] } = sqon;
    content.forEach(c =>
      getNestedSqonFilters({
        sqon: c,
        nestedFields,
        accumulator,
      }),
    );
  }
  return accumulator;
};

export default getNestedSqonFilters;
