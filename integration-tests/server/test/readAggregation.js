import { expect } from 'chai';
import { print } from 'graphql';
import gql from 'graphql-tag';
import orderBy from 'lodash/orderBy';

export default ({ api, graphqlField, gqlPath }) => {
  it('reads aggregations properly', async () => {
    const { data } = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${graphqlField} {
              aggregations {
                clinical_diagnosis__clinical_stage_grouping {
                  buckets {
                    doc_count
                    key
                  }
                }
              }
            }
          }
        `),
      },
    });

    expect(data).to.eql({
      data: {
        model: {
          aggregations: {
            clinical_diagnosis__clinical_stage_grouping: {
              buckets: [
                {
                  doc_count: 2,
                  key: 'Stage I',
                },
                {
                  doc_count: 1,
                  key: '__missing__',
                },
              ],
            },
          },
        },
      },
    });
  });

  it('reads aggregations with sqon properly', async () => {
    const { data } = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${graphqlField} {
              aggregations(
                filters: {
                  op: "and",
                  content: [
                    {
                      op: "in",
                      content: {
                        field: "clinical_diagnosis.clinical_stage_grouping",
                        value: "Stage I"
                      }
                    }
                  ]
                }, 
                aggregations_filter_themselves: true
              ) {
                clinical_diagnosis__clinical_stage_grouping {
                  buckets {
                    doc_count
                    key
                  }
                }
              }
            }
          }
        `),
      },
    });

    expect({
      data: {
        [graphqlField]: {
          aggregations: {
            clinical_diagnosis__clinical_stage_grouping: {
              buckets: orderBy(
                data.data[graphqlField].aggregations.clinical_diagnosis__clinical_stage_grouping
                  .buckets,
                'key',
              ),
            },
          },
        },
      },
    }).to.eql({
      data: {
        [graphqlField]: {
          aggregations: {
            clinical_diagnosis__clinical_stage_grouping: {
              buckets: [
                {
                  doc_count: 2,
                  key: 'Stage I',
                },
              ],
            },
          },
        },
      },
    });
  });

  it('should work with prefix filter sqon', async () => {
    const { data } = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${graphqlField} {
              aggregations(
                filters: {
                  op: "and",
                  content: [
                    {
                      op: "filter",
                      content: {
                        fields: [
                          "name",
                          "primary_site",
                          "clinical_diagnosis.clinical_tumor_diagnosis",
                          "gender",
                          "race"
                        ],
                        value: "Colorectal*"
                      }
                    }
                  ]
                }, 
                aggregations_filter_themselves: true
              ) {
                clinical_diagnosis__clinical_stage_grouping {
                  buckets {
                    doc_count
                    key
                  }
                }
              }
            }
          }
        `),
      },
    });

    expect({
      data: {
        [graphqlField]: {
          aggregations: {
            clinical_diagnosis__clinical_stage_grouping: {
              buckets: orderBy(
                data.data[graphqlField].aggregations.clinical_diagnosis__clinical_stage_grouping
                  .buckets,
                'key',
              ),
            },
          },
        },
      },
    }).to.eql({
      data: {
        [graphqlField]: {
          aggregations: {
            clinical_diagnosis__clinical_stage_grouping: {
              buckets: [
                {
                  doc_count: 2,
                  key: 'Stage I',
                },
              ],
            },
          },
        },
      },
    });
  });

  it('should work with postfix filter sqon', async () => {
    const { data } = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${graphqlField} {
              aggregations(
                filters: {
                  op: "and",
                  content: [
                    {
                      op: "filter",
                      content: {
                        fields: [
                          "name",
                          "primary_site",
                          "clinical_diagnosis.clinical_tumor_diagnosis",
                          "gender",
                          "race"
                        ],
                        value: "*cancer"
                      }
                    }
                  ]
                }, 
                aggregations_filter_themselves: true
              ) {
                clinical_diagnosis__clinical_stage_grouping {
                  buckets {
                    doc_count
                    key
                  }
                }
              }
            }
          }
        `),
      },
    });

    expect({
      data: {
        [graphqlField]: {
          aggregations: {
            clinical_diagnosis__clinical_stage_grouping: {
              buckets: orderBy(
                data.data[graphqlField].aggregations.clinical_diagnosis__clinical_stage_grouping
                  .buckets,
                'key',
              ),
            },
          },
        },
      },
    }).to.eql({
      data: {
        [graphqlField]: {
          aggregations: {
            clinical_diagnosis__clinical_stage_grouping: {
              buckets: [
                {
                  doc_count: 2,
                  key: 'Stage I',
                },
              ],
            },
          },
        },
      },
    });
  });

  it('should work with pre and post-fix filter sqon', async () => {
    const { data } = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${graphqlField} {
              aggregations(
                filters: {
                  op: "and",
                  content: [
                    {
                      op: "filter",
                      content: {
                        fields: [
                          "name",
                          "primary_site",
                          "clinical_diagnosis.clinical_tumor_diagnosis",
                          "gender",
                          "race"
                        ],
                        value: "*SOMEONE*"
                      }
                    }
                  ]
                }, 
                aggregations_filter_themselves: true
              ) {
                clinical_diagnosis__clinical_stage_grouping {
                  buckets {
                    doc_count
                    key
                  }
                }
              }
            }
          }
        `),
      },
    });

    expect({
      data: {
        [graphqlField]: {
          aggregations: {
            clinical_diagnosis__clinical_stage_grouping: {
              buckets: orderBy(
                data.data[graphqlField].aggregations.clinical_diagnosis__clinical_stage_grouping
                  .buckets,
                'key',
              ),
            },
          },
        },
      },
    }).to.eql({
      data: {
        [graphqlField]: {
          aggregations: {
            clinical_diagnosis__clinical_stage_grouping: {
              buckets: [
                {
                  doc_count: 2,
                  key: 'Stage I',
                },
              ],
            },
          },
        },
      },
    });
  });

  it('should count the correct number of buckets', async () => {
    const { data } = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${graphqlField} {
              aggregations(
                aggregations_filter_themselves: true
              ) {
                clinical_diagnosis__clinical_stage_grouping {
                  bucket_count
                }
              }
            }
          }
        `),
      },
    });

    expect({
      data: {
        [graphqlField]: {
          aggregations: {
            clinical_diagnosis__clinical_stage_grouping: {
              bucket_count:
                data.data[graphqlField].aggregations.clinical_diagnosis__clinical_stage_grouping
                  .bucket_count,
            },
          },
        },
      },
    }).to.eql({
      data: {
        [graphqlField]: {
          aggregations: {
            clinical_diagnosis__clinical_stage_grouping: {
              bucket_count: 2,
            },
          },
        },
      },
    });
  });

  it('should ignore buckets with key "MISSING" when include_missing=false', async () => {
    const { data } = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${graphqlField} {
              aggregations(
                include_missing: false
                aggregations_filter_themselves: true
              ) {
                clinical_diagnosis__histological_type {
                  bucket_count
                }
              }
            }
          }
        `),
      },
    });

    expect({
      data: {
        [graphqlField]: {
          aggregations: {
            clinical_diagnosis__histological_type: {
              bucket_count:
                data.data[graphqlField].aggregations.clinical_diagnosis__histological_type
                  .bucket_count,
            },
          },
        },
      },
    }).to.eql({
      data: {
        [graphqlField]: {
          aggregations: {
            clinical_diagnosis__histological_type: {
              bucket_count: 0,
            },
          },
        },
      },
    });
  });

  it('should count buckets with key "MISSING" when include_missing is defaulted to true', async () => {
    const { data } = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${graphqlField} {
              aggregations(
                aggregations_filter_themselves: true
              ) {
                clinical_diagnosis__histological_type {
                  bucket_count
                }
              }
            }
          }
        `),
      },
    });

    expect({
      data: {
        [graphqlField]: {
          aggregations: {
            clinical_diagnosis__histological_type: {
              bucket_count:
                data.data[graphqlField].aggregations.clinical_diagnosis__histological_type
                  .bucket_count,
            },
          },
        },
      },
    }).to.eql({
      data: {
        [graphqlField]: {
          aggregations: {
            clinical_diagnosis__histological_type: {
              bucket_count: 1,
            },
          },
        },
      },
    });
  });

  it('should not include access_denied documents', async () => {
    const { data } = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${graphqlField} {
              aggregations(
                aggregations_filter_themselves: true
                include_missing: false
              ) {
                access_denied {
                  buckets {
                    key_as_string
                  }
                }
              }
            }
          }
        `),
      },
    });

    expect({
      data: {
        [graphqlField]: {
          aggregations: {
            access_denied: {
              buckets: data.data[graphqlField].aggregations.access_denied.buckets,
            },
          },
        },
      },
    }).to.eql({
      data: {
        [graphqlField]: {
          aggregations: {
            access_denied: {
              buckets: [{ key_as_string: 'false' }],
            },
          },
        },
      },
    });
  });
};
