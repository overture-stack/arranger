import {
  IN_OP,
  NOT_IN_OP,
  SOME_NOT_IN_OP,
  OR_OP,
  AND_OP,
  OP_ALIASES,
  GT_OP,
  GTE_OP,
  LT_OP,
  LTE_OP,
} from '../constants';

const ARRAY_CONTENT = [
  IN_OP,
  NOT_IN_OP,
  SOME_NOT_IN_OP,
  GT_OP,
  GTE_OP,
  LT_OP,
  LTE_OP,
];

function groupingOptimizer({ op, content }) {
  return {
    op,
    content: content.reduce((filters, filter) => {
      return [
        ...filters,
        ...(filter.op === op
          ? groupingOptimizer(filter).content
          : [normalizeFilters(filter)]),
      ];
    }, []),
  };
}

function isSpecialFilter(value) {
  return `${value}`.includes('*');
}

function normalizeFilters(filter) {
  const { op, content } = filter;
  const { value, field } = content || {};

  if (!op) {
    throw Error(`Must specify "op" in filters: ${filter}`);
  } else if (!content) {
    throw Error(`Must specify "content" in filters: ${filter}`);
  }

  if (OP_ALIASES[op]) {
    return normalizeFilters({ ...filter, op: OP_ALIASES[op] });
  } else if (ARRAY_CONTENT.includes(op) && !Array.isArray(value)) {
    return normalizeFilters({
      ...filter,
      content: { ...content, value: [].concat(value) },
    });
  } else if ([IN_OP, NOT_IN_OP].includes(op) && value.some(isSpecialFilter)) {
    // Separate filters with special handling into separate filters and "or" them with the normal filter
    const specialFilters = value
      .filter(isSpecialFilter)
      .map(specialValue => ({ op, content: { field, value: [specialValue] } }));

    const normalValues = value.filter(psv => !isSpecialFilter(psv));
    const content =
      normalValues.length > 0
        ? [{ op, content: { field, value: normalValues } }, ...specialFilters]
        : specialFilters;
    return content.length > 1 ? { op: OR_OP, content } : content[0];
  } else if ([AND_OP, OR_OP].includes(op)) {
    return groupingOptimizer(filter);
  } else {
    return filter;
  }
}

export default normalizeFilters;
