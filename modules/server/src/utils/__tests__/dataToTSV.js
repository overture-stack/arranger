import dataToTSVStream, { dataToTSV, columnsToHeader } from '../dataToTSV';
import { PassThrough } from 'stream';

describe('dataToTSV accessor columns', () => {
  it('should handle string accessors', () => {
    const config = {
      index: 'file',
      data: {
        data: {
          file: {
            hits: {
              edges: [
                { node: { test1: 1, test2: 'txt1' } },
                { node: { test1: 2, test2: 'txt2' } },
              ],
            },
          },
        },
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
        data: {
          file: {
            hits: {
              edges: [
                { node: { test1: 1, test2: 'txt1' } },
                { node: { test1: 2 } },
              ],
            },
          },
        },
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
        file: {
          hits: {
            edges: [
              { node: { test1: 1, test2: 'txt1' } },
              { node: { test1: 2, test2: 'txt2' } },
            ],
          },
        },
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
        data: {
          file: {
            hits: {
              edges: [
                {
                  node: {
                    test1: 1,
                    test2: {
                      hits: {
                        edges: [
                          {
                            node: {
                              nestedValue: 3,
                            },
                          },
                          {
                            node: {
                              nestedValue: 4,
                            },
                          },
                        ],
                      },
                    },
                  },
                },
                {
                  node: {
                    test1: 2,
                    test2: {
                      hits: {
                        edges: [
                          {
                            node: {
                              nestedValue: 1,
                            },
                          },
                          {
                            node: {
                              nestedValue: 2,
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              ],
            },
          },
        },
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

    expect(columnsToHeader(config) + dataToTSV(config)).toBe(expected);
  });

  it('should accept uniqueBy', () => {
    const config = {
      index: 'file',
      uniqueBy: 'test2.hits.edges[].node.nestedValue',
      data: {
        data: {
          file: {
            hits: {
              edges: [
                {
                  node: {
                    test1: 1,
                    test2: {
                      hits: {
                        edges: [
                          {
                            node: {
                              nestedValue: 3,
                            },
                          },
                          {
                            node: {
                              nestedValue: 4,
                            },
                          },
                        ],
                      },
                    },
                  },
                },
                {
                  node: {
                    test1: 2,
                    test2: {
                      hits: {
                        edges: [
                          {
                            node: {
                              nestedValue: 1,
                            },
                          },
                          {
                            node: {
                              nestedValue: 2,
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              ],
            },
          },
        },
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

    expect(columnsToHeader(config) + dataToTSV(config)).toBe(expected);
  });
});
