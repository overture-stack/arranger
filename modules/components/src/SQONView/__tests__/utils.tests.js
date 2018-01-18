/* @flow */
import { addInSQON, toggleSQON, mergeQuery } from '../utils';
import { stringifyJSONParam } from '../../utils/uri';

const baseFilter = {
  op: 'and',
  content: [
    {
      op: 'in',
      content: {
        field: 'file.file_id',
        value: ['fileA'],
      },
    },
  ],
};

const fileBFilter = {
  op: 'and',
  content: [
    {
      op: 'in',
      content: {
        field: 'file.file_id',
        value: ['fileB'],
      },
    },
  ],
};

const caseFilter = {
  op: 'and',
  content: [
    {
      op: 'in',
      content: {
        field: 'case.case_id',
        value: ['somecase'],
      },
    },
  ],
};

const rangeFromFilter = {
  op: '>=',
  content: {
    field: 'cases.diagnoses.age_at_diagnosis',
    value: [5113],
  },
};

const rangeToFilter = {
  op: '<=',
  content: {
    field: 'cases.diagnoses.age_at_diagnosis',
    value: [33236],
  },
};

const primarySiteFilter = {
  op: 'in',
  content: {
    field: 'cases.primary_site',
    value: ['Lung'],
  },
};

describe('addInSQON', () => {
  it('should return the base sqon if no query', () => {
    const result = addInSQON(undefined, baseFilter);
    expect(result).toEqual(baseFilter);
  });

  it('should return the query if no base sqon', () => {
    expect(false).toBe(false);
  });

  it('should add a value to base', () => {
    const result = addInSQON(fileBFilter, baseFilter);
    expect(result).toEqual({
      op: 'and',
      content: [
        {
          op: 'in',
          content: {
            field: 'file.file_id',
            value: ['fileA', 'fileB'],
          },
        },
      ],
    });
  });

  it('should keep other fields in the filter when adding', () => {
    const result = addInSQON(fileBFilter, addInSQON(caseFilter, baseFilter));
    expect(result).toMatchObject({
      op: 'and',
      content: [
        {
          op: 'in',
          content: {
            field: 'case.case_id',
            value: ['somecase'],
          },
        },
        {
          op: 'in',
          content: {
            field: 'file.file_id',
            value: ['fileA', 'fileB'],
          },
        },
      ],
    });
  });

  it('should not remove an existing value', () => {
    const result = addInSQON(baseFilter, baseFilter);
    expect(result).toEqual(result);
  });
});

describe('toggleSQON', () => {
  it('should add a value to base', () => {
    const result = toggleSQON(fileBFilter, baseFilter);
    expect(result).toEqual({
      op: 'and',
      content: [
        {
          op: 'in',
          content: {
            field: 'file.file_id',
            value: ['fileA', 'fileB'],
          },
        },
      ],
    });
  });
  it('should remove an existing value', () => {
    const result = toggleSQON(baseFilter, baseFilter);
    expect(result).toEqual(null);
  });

  const q = {
    op: 'and',
    content: [primarySiteFilter],
  };

  const ctxq = {
    op: 'and',
    content: [rangeFromFilter, rangeToFilter, primarySiteFilter],
  };
  it('should not change the range filter if an unrelated filter was removed', () => {
    const result = toggleSQON(q, ctxq);
    expect(result).toEqual({
      op: 'and',
      content: [rangeFromFilter, rangeToFilter],
    });
  });

  it('should not change the range filter if an unrelated filter was removed, regardless of order', () => {
    const result = toggleSQON(ctxq, q);
    expect(result).toEqual({
      op: 'and',
      content: [rangeFromFilter, rangeToFilter],
    });
  });
});

describe('mergeQuery', () => {
  it('should not change the range filter if an unrelated filter was removed', () => {
    const q = {
      offset: 0,
      sqon: {
        op: 'and',
        content: [primarySiteFilter],
      },
    };

    const c = {
      sqon: stringifyJSONParam({
        op: 'and',
        content: [rangeFromFilter, rangeToFilter, primarySiteFilter],
      }),
    };

    const result = mergeQuery(q, c, 'toggle', null);

    const expectedResult = {
      offset: 0,
      sqon: {
        op: 'and',
        content: [rangeFromFilter, rangeToFilter],
      },
    };

    expect(result).toEqual(expectedResult);
  });
});
