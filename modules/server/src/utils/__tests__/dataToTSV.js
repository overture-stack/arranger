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

    const expected = 'Test1	Test2\n1	txt1\n2	txt2';

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

    const expected = 'Test1	Test2\n1	txt1\n2	empty';

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

    const expected = 'dTest1	Test2\n1	txt1\n2	txt2';
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
          field: 'test2',
          jsonPath: '$.test2.hits.edges..node.nestedValue',
        },
      ],
    };

    const expected = 'Test1	Test2\n1	3, 4\n2	1, 2';

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
          field: 'test2',
          jsonPath: '$.test2.hits.edges..node.nestedValue',
        },
      ],
    };

    const expected = 'Test1	Test2\n1	3\n1	4\n2	1\n2	2';

    expect(columnsToHeader(config) + dataToTSV(config)).toBe(expected);
  });
});
