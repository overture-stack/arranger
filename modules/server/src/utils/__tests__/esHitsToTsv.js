import dataToTSVStream, { dataToTSV, columnsToHeader } from '../esHitsToTsv';
import { PassThrough } from 'stream';

describe('esHitsToTSV accessor columns', () => {
  it('should handle string accessors', () => {
    const config = {
      index: 'file',
      data: {
        hits: [
          { _source: { test1: 1, test2: 'txt1' } },
          { _source: { test1: 2, test2: 'txt2' } },
        ],
        total: 5,
      },
      columns: [
        {
          Header: 'Test1',
          field: 'test1',
          accessor: 'test1',
        },
        {
          Header: 'Test2',
          field: 'test2',
          accessor: 'test2',
        },
      ],
    };

    const expected = 'Test1\tTest2\n1\ttxt1\n2\ttxt2\n';

    expect(columnsToHeader(config) + dataToTSV(config)).toBe(expected);
  });

  it('should accept emptyValue', () => {
    const config = {
      index: 'file',
      data: {
        hits: [
          { _source: { test1: 1, test2: 'txt1' } },
          { _source: { test1: 2 } },
        ],
        total: 5,
      },
      columns: [
        {
          Header: 'Test1',
          field: 'test1',
          accessor: 'test1',
        },
        {
          Header: 'Test2',
          field: 'test2',
          accessor: 'test2',
        },
      ],
      emptyValue: 'empty',
    };

    const expected = 'Test1\tTest2\n1\ttxt1\n2\tempty\n';

    expect(columnsToHeader(config) + dataToTSV(config)).toBe(expected);
  });

  it('should stream', () => {
    const config = {
      index: 'file',
      columns: [
        {
          Header: 'Test1',
          field: 'test1',
          accessor: 'test1',
        },
        {
          Header: 'Test2',
          field: 'test2',
          accessor: 'test2',
        },
      ],
    };

    const data = {
      data: {
        hits: [
          { _source: { test1: 1, test2: 'txt1' } },
          { _source: { test1: 2, test2: 'txt2' } },
        ],
        total: 5,
      },
    };

    const expected = 'Test1\tTest2\n1\ttxt1\n2\ttxt2\n';
    const stream = PassThrough();
    let actual = '';
    stream
      .pipe(dataToTSVStream(config))
      .on('data', chunk => (actual += chunk))
      .on('end', () => expect(actual).toBe(expected))
      .write(data);
  });

  it('should join multiple values', () => {
    const config = {
      index: 'file',
      data: {
        hits: [
          {
            _source: {
              test1: 1,
              test2: [
                {
                  nestedValue: 3,
                },
                {
                  nestedValue: 4,
                },
              ],
            },
          },
          {
            _source: {
              test1: 2,
              test2: [
                {
                  nestedValue: 1,
                },
                {
                  nestedValue: 2,
                },
              ],
            },
          },
        ],
        total: 5,
      },
      columns: [
        {
          Header: 'Test1',
          field: 'test1',
          accessor: 'test1',
        },
        {
          Header: 'Test2',
          field: 'test2',
          jsonPath: '$.test2.hits.edges[*].node.nestedValue',
        },
      ],
    };

    const expected = 'Test1\tTest2\n1\t3, 4\n2\t1, 2\n';

    expect(columnsToHeader(config) + dataToTSV(config)).toBe(expected);
  });

  it('should accept uniqueBy', () => {
    const config = {
      index: 'file',
      uniqueBy: 'test2[].nestedValue',
      data: {
        hits: [
          {
            _source: {
              test1: 1,
              test2: [
                {
                  nestedValue: 3,
                },
                {
                  nestedValue: 4,
                },
                {
                  nestedValue: 1,
                },
                {
                  nestedValue: 2,
                },
              ],
            },
          },
          {
            _source: {
              test1: 2,
              test2: [
                {
                  nestedValue: 3,
                },
                {
                  nestedValue: 4,
                },
                {
                  nestedValue: 1,
                },
                {
                  nestedValue: 2,
                },
              ],
            },
          },
        ],
      },
      columns: [
        {
          Header: 'Test1',
          field: 'test1',
          accessor: 'test1',
        },
        {
          Header: 'Test2',
          field: 'test2',
          jsonPath: '$.test2.hits.edges[*].node.nestedValue',
        },
      ],
    };

    const expected = 'Test1\tTest2\n1\t3\n1\t4\n2\t1\n2\t2\n';

    expect(columnsToHeader(config) + dataToTSV(config)).toBe(expected);
  });
});
