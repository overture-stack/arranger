import { expect } from 'chai';
import { print } from 'graphql';
import gql from 'graphql-tag';

export default ({ api, documentType, gqlPath }) => {
  it('reads extended mapping properly', async () => {
    const { data } = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${documentType} {
              configs {
                extended
              }
            }
          }
        `),
      },
    });

    expect(data?.data?.[documentType]?.configs?.extended).to.be.not.empty;
    expect(data?.errors).to.be.undefined;
  });

  it('reads elasticsearch mappings properly', async () => {
    const { data } = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${documentType} {
              mapping
            }
          }
        `),
      },
    });

    expect(data?.data?.[documentType]?.mapping).to.be.not.empty;
    expect(data?.errors).to.be.undefined;
  });

  it('reads aggregations properly', async () => {
    const { data } = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${documentType} {
              configs {
                facets {
                  aggregations {
                    field
                    active
                    show
                  }
                }
              }
            }
          }
        `),
      },
    });

    expect(data?.data?.[documentType]?.configs?.facets?.aggregations).to.be.not.empty;
    expect(data?.errors).to.be.undefined;
  });

  it('reads table configs properly', async () => {
    const { data } = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${documentType} {
              configs {
                table {
                  keyField
                }
              }
            }
          }
        `),
      },
    });

    expect(data?.data?.[documentType]?.configs?.table).to.be.not.empty;
    expect(data?.errors).to.be.undefined;
  });

  it('reads matchbox state properly', async () => {
    const { data } = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${documentType} {
              configs {
                matchbox {
                  field
                }
              }
            }
          }
        `),
      },
    });

    expect(data?.data?.[documentType]?.configs?.matchbox).to.be.not.empty;
    expect(data?.errors).to.be.undefined;
  });
};
