import {
  IN_OP,
  NOT_IN_OP,
  OR_OP,
  AND_OP,
  NOT_OP,
  OP_ALIASES,
  ARRAY_CONTENT,
} from '../constants';

function groupingOptimizer({ op, content }) {
  return {
    op,
    content: content
      .map(normalizeFilters)
      .reduce(
        (filters, f) => [...filters, ...(f.op === op ? f.content : [f])],
        [],
      ),
  };
}

function isSpecialFilter(value) {
  return `${value}`.includes('*') || `${value}`.includes('set_id:');
}

function normalizeFilters(filter) {
  const { op, content } = filter;

  if (!op) {
    throw Error(`Must specify "op" in filters: ${filter}`);
  } else if (!content) {
    throw Error(`Must specify "content" in filters: ${filter}`);
  }

  const { value } = content;
  if (OP_ALIASES[op]) {
    return normalizeFilters({ ...filter, op: OP_ALIASES[op] });
  } else if (ARRAY_CONTENT.includes(op) && !Array.isArray(value)) {
    return normalizeFilters({
      ...filter,
      content: { ...content, value: [].concat(value) },
    });
  } else if (
    [IN_OP, NOT_IN_OP].includes(op) &&
    value.some(isSpecialFilter) &&
    value.length > 1
  ) {
    // Separate filters with special handling into separate filters and "or" them with the normal filter
    const specialFilters = value.filter(isSpecialFilter).map(specialValue => ({
      ...filter,
      content: { ...content, value: [specialValue] },
    }));

    const normalValues = value.filter(psv => !isSpecialFilter(psv));
    const filters =
      normalValues.length > 0
        ? [
            { ...filter, content: { ...content, value: normalValues } },
            ...specialFilters,
          ]
        : specialFilters;

    return normalizeFilters({ op: OR_OP, content: filters });
  } else if ([AND_OP, OR_OP, NOT_OP].includes(op)) {
    return groupingOptimizer(filter);
  } else {
    return filter;
  }
}

export default normalizeFilters;
