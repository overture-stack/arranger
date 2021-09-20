import { omit, isArray, min, max } from 'lodash';
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

// _UNFLAT_KEY_ is a ephemeral mark for groupingOptimizer to not apply grouping
const _UNFLAT_KEY_ = '__unflat__';
function groupingOptimizer({ op, content, pivot }) {
  return {
    op,
    pivot,
    content: content.map(normalizeFilters).reduce((filters, f) => {
      const samePivot = f.pivot === pivot || !f.pivot;
      if (f.op === op && !f[_UNFLAT_KEY_] && samePivot) {
        return [...filters, ...f.content];
      } else {
        return [...filters, omit(f, _UNFLAT_KEY_)];
      }
    }, []),
  };
}

function isSpecialFilter(value) {
  return [REGEX, SET_ID, MISSING].some((x) => `${value}`.includes(x));
}

const applyDefaultPivots = (filter) => {
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
  } else if ([IN_OP, NOT_IN_OP].includes(op) && value.some(isSpecialFilter) && value.length > 1) {
    // Separate filters with special handling into separate filters and "or" them with the normal filter
    const specialFilters = value.filter(isSpecialFilter).map((specialValue) => ({
      ...filter,
      content: { ...content, value: [specialValue] },
    }));

    const normalValues = value.filter((psv) => !isSpecialFilter(psv));
    const filters =
      normalValues.length > 0
        ? [{ ...filter, content: { ...content, value: normalValues } }, ...specialFilters]
        : specialFilters;

    return normalizeFilters({ op: OR_OP, content: filters });
  } else if ([AND_OP, OR_OP, NOT_OP].includes(op)) {
    return groupingOptimizer(filter);
  } else {
    return filter;
  }
}

export default (filter) => {
  const output = filter ? applyDefaultPivots(normalizeFilters(filter)) : filter;
  return output;
};
