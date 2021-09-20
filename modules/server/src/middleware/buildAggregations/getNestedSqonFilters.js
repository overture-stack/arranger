import { AND_OP, OR_OP, NOT_OP } from '../constants';
import normalizeFilters from '../buildQuery/normalizeFilters';

const getNestedSqonFilters = ({
  sqon = null,
  nestedFields,
  accumulator = {},
  parentPivot = '.',
}) => {
  const { op } = sqon;
  if ([AND_OP, OR_OP, NOT_OP].includes(op)) {
    const { content = [], pivot } = sqon;
    // console.log('sqon: ', JSON.stringify(sqon, null, 2));
    content.forEach((c) =>
      getNestedSqonFilters({
        sqon: c,
        nestedFields,
        accumulator,
        parentPivot: pivot,
      }),
    );
  } else {
    const {
      content: { field: sqonField, fields: sqonFields },
    } = sqon;
    const fields = sqonFields || [sqonField];
    fields.forEach((field) => {
      const splitted = field.split('.') || '';
      const parentPath = splitted.slice(0, splitted.length - 1).join('.');
      const isNested = nestedFields.includes(splitted.slice(0, splitted.length - 1).join('.'));
      if (splitted.length && isNested && parentPivot !== parentPath) {
        accumulator[parentPath] = [...(accumulator[parentPath] || []), sqon];
      }
    });
  }
  return accumulator;
};

export default ({ sqon = null, nestedFields }) => {
  const normalized = normalizeFilters(sqon);
  // console.log('normalized: ', JSON.stringify(normalized, null, 2));
  return sqon
    ? getNestedSqonFilters({
        sqon: normalized,
        nestedFields,
      })
    : {};
};
