import { AND_OP, OR_OP, NOT_OP } from '../constants';
import normalizeFilters from '../buildQuery/normalizeFilters';

const getNestedSqonFilters = ({ sqon, nestedFieldNames, accumulator = {}, parentPivot = '.' }) => {
  const { op } = sqon;
  if ([AND_OP, OR_OP, NOT_OP].includes(op)) {
    const { content = [], pivot } = sqon;
    content.forEach((c) =>
      getNestedSqonFilters({
        sqon: c,
        nestedFieldNames,
        accumulator,
        parentPivot: pivot,
      }),
    );
  } else {
    const {
      content: { fieldName: sqonFieldName, fieldNames: sqonFieldNames },
    } = sqon;
    const fieldNames = sqonFieldNames || [sqonFieldName];
    fieldNames.forEach((fieldName) => {
      const splitted = fieldName.split('.') || '';
      const parentPath = splitted.slice(0, splitted.length - 1).join('.');
      const isNested = nestedFieldNames.includes(splitted.slice(0, splitted.length - 1).join('.'));
      if (splitted.length && isNested && parentPivot !== parentPath) {
        accumulator[parentPath] = [...(accumulator[parentPath] || []), sqon];
      }
    });
  }
  return accumulator;
};

export default ({ sqon = null, nestedFieldNames }) => {
  const normalized = normalizeFilters(sqon);

  return sqon
    ? getNestedSqonFilters({
        sqon: normalized,
        nestedFieldNames,
      })
    : {};
};
