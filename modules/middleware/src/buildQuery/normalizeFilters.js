import { omit } from 'lodash';
import {
  IN_OP,
  NOT_IN_OP,
  OR_OP,
  AND_OP,
  NOT_OP,
  OP_ALIASES,
  ARRAY_CONTENT,
  REGEX,
  SET_ID,
  MISSING,
  ALL_OP,
} from '../constants';

function groupingOptimizer({ op, content }) {
  return {
    op,
    content: content.map(normalizeFilters).reduce((filters, f) => {
      if (f.op === op && !f['__unflat']) {
        return [...filters, ...f.content];
      } else {
        return [...filters, omit(f, '__unflat')];
      }
    }, []),
  };
}

function isSpecialFilter(value) {
  return [REGEX, SET_ID, MISSING].some(x => `${value}`.includes(x));
}

const applyDefaultPivots = filter => {
  const { content, pivot = null } = filter;
  const { value } = content;
  if (value) {
    return {
      ...filter,
      pivot,
    };
  } else {
    return {
      ...filter,
      pivot,
      content: filter.content.map(applyDefaultPivots),
    };
  }
};

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
  } else if ([ALL_OP].includes(op)) {
    return applyDefaultPivots({
      op: AND_OP,
      // __unflat is a ephemeral mark for groupingOptimizer to not apply grouping
      ['__unflat']: true,
      pivot: filter.pivot,
      content: filter.content.value.map(val => ({
        op: IN_OP,
        content: {
          field: filter.content.field,
          value: [val],
        },
      })),
    });
  } else if ([AND_OP, OR_OP, NOT_OP].includes(op)) {
    return groupingOptimizer(filter);
  } else {
    return filter;
  }
}

export default filter => applyDefaultPivots(normalizeFilters(filter));
