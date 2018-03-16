import { EQ, NEQ, IN, EXCLUDE, GROUP_OPS, OR } from '../constants';

function normalizeTerm({ op, content }) {
  const opMap = { [EQ]: IN, [NEQ]: EXCLUDE };
  return normalizeFilters({
    op: opMap[op],
    content: { ...content, value: [].concat(content.value) },
  });
}

function groupingOptimizer({ op, content }) {
  return {
    op,
    content: content.reduce((filters, filter) => {
      return [
        ...filters,
        ...(filter.op.toLowerCase() === op
          ? groupingOptimizer(filter).content
          : [normalizeFilters(filter)]),
      ];
    }, []),
  };
}

function isSpecialFilter(value) {
  return `${value}`.includes('*') || `${value}`.includes('set_id:');
}

function normalizeFilters(filter) {
  const { op, content: { value, field } } = filter;
  if ([EQ, NEQ].includes(op)) {
    return normalizeTerm(filter);
  } else if ([IN, EXCLUDE].includes(op) && value.some(isSpecialFilter)) {
    // Separate filters with special handling into separate filters and "or" them with the normal filter
    const specialFilters = value.filter(isSpecialFilter).map(specialValue => {
      return { op, content: { field, value: [specialValue] } };
    });

    const normalValues = value.filter(psv => !isSpecialFilter(psv));
    const content =
      normalValues.length > 0
        ? [{ op, content: { field, value: normalValues } }, ...specialFilters]
        : specialFilters;
    return content.length > 1 ? { op: OR, content } : content[0];
  } else if (GROUP_OPS.includes(op)) {
    return groupingOptimizer(filter);
  } else {
    return filter;
  }
}

export default normalizeFilters;
