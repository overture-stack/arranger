import dataToTSVStream, { dataToTSV, columnsToHeader } from '../dataToExportFormat';
import { PassThrough } from 'stream';

describe('esHitsToTSV accessor columns', () => {
  it('should handle string accessors', () => {
    const config = {
      index: 'file',
      data: {
        hits: [{ _source: { test1: 1, test2: 'txt1' } }, { _source: { test1: 2, test2: 'txt2' } }],
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
    const stream = PassThrough();
    let actual = '';
    stream
      .on('data', (chunk) => (actual += chunk))
      .on('end', () => expect(columnsToHeader(config) + actual).toBe(expected));

    dataToTSV({ pipe: stream, ...config });
  });

  it('should accept emptyValue', () => {
    const config = {
      index: 'file',
      data: {
        hits: [{ _source: { test1: 1, test2: 'txt1' } }, { _source: { test1: 2 } }],
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
    const stream = PassThrough();
    let actual = '';
    stream
      .on('data', (chunk) => (actual += chunk))
      .on('end', () => expect(columnsToHeader(config) + actual).toBe(expected));

    dataToTSV({ pipe: stream, ...config });
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
      hits: [{ _source: { test1: 1, test2: 'txt1' } }, { _source: { test1: 2, test2: 'txt2' } }],
      total: 5,
    };

    const expected = 'Test1\tTest2\n1\ttxt1\n2\ttxt2\n';
    const stream = PassThrough();
    let actual = '';
    stream
      .pipe(dataToTSVStream(config))
      .on('data', (chunk) => (actual += chunk))
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
          field: 'test2.nestedValue',
          jsonPath: '$.test2.hits.edges[*].node.nestedValue',
        },
      ],
    };

    const expected = 'Test1\tTest2\n1\t3, 4\n2\t1, 2\n';
    const stream = PassThrough();
    let actual = '';
    stream
      .on('data', (chunk) => (actual += chunk))
      .on('end', () => expect(columnsToHeader(config) + actual).toBe(expected));

    dataToTSV({ pipe: stream, ...config });
  });

  it('should accept uniqueBy', () => {
    const config = {
      index: 'file',
      uniqueBy: 'test2.hits.edges[].node.nestedValue',
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
      },
      columns: [
        {
          Header: 'Test1',
          field: 'test1',
          accessor: 'test1',
        },
        {
          Header: 'Test2',
          field: 'test2.nestedValue',
          jsonPath: '$.test2.hits.edges[*].node.nestedValue',
        },
      ],
    };

    const expected = 'Test1\tTest2\n1\t3\n1\t4\n2\t1\n2\t2\n';
    const stream = PassThrough();
    let actual = '';
    stream
      .on('data', (chunk) => (actual += chunk))
      .on('end', () => expect(columnsToHeader(config) + actual).toBe(expected));

    dataToTSV({ pipe: stream, ...config });
  });

  it('should handle deep nested fields', () => {
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
                  nesting: [
                    {
                      nestedValue: 1,
                    },
                    {
                      nestedValue: 2,
                    },
                  ],
                },
                {
                  nestedValue: 2,
                  nesting: [
                    {
                      nestedValue: 1,
                    },
                    {
                      nestedValue: 2,
                    },
                  ],
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
          field: 'test2.nestedValue.nesting.nestedValue',
          jsonPath: '$.test2.hits.edges[*].node.nesting.hits.edges[*].node.nestedValue',
        },
      ],
    };
    const expected = 'Test1\tTest2\n1\t\n2\t1, 2, 1, 2\n';
    const stream = PassThrough();
    let actual = '';
    stream
      .on('data', (chunk) => (actual += chunk))
      .on('end', () => expect(columnsToHeader(config) + actual).toBe(expected));

    dataToTSV({ pipe: stream, ...config });
  });
});
