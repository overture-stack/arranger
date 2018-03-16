import { OR_OP, AND_OP, NOT_OP, OP_ALIASES, ARRAY_CONTENT } from '../constants';

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

function normalizeFilters(filter) {
  const { op, content } = filter;

  if (!op) {
    throw Error(`Must specify "op" in filters: ${filter}`);
  } else if (!content) {
    throw Error(`Must specify "content" in filters: ${filter}`);
  }

  const { value, isRegex } = content;
  if (OP_ALIASES[op]) {
    return normalizeFilters({ ...filter, op: OP_ALIASES[op] });
  } else if (ARRAY_CONTENT.includes(op) && !Array.isArray(value)) {
    return normalizeFilters({
      ...filter,
      content: { ...content, value: [].concat(value) },
    });
  } else if ([AND_OP, OR_OP, NOT_OP].includes(op)) {
    return groupingOptimizer(filter);
  } else if (isRegex) {
    return normalizeFilters({
      op: OR_OP,
      content: value.map(v => ({
        ...filter,
        content: { ...content, value: [v] },
      })),
    });
  } else {
    return filter;
  }
}

export default normalizeFilters;
