import { expect } from 'chai';
import { print } from 'graphql';
import gql from 'graphql-tag';

export default ({ api, graphqlField, gqlPath }) => {
  it('reads extended mapping properly', async () => {
    const { data } = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${graphqlField} {
              extended
            }
          }
        `),
      },
    });

    expect(data?.data?.[graphqlField]?.extended).to.be.not.empty;
    expect(data?.errors).to.be.undefined;
  });

  it('reads elasticsearch mappings properly', async () => {
    const { data } = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${graphqlField} {
              mapping
            }
          }
        `),
      },
    });

    expect(data?.data?.[graphqlField]?.mapping).to.be.not.empty;
    expect(data?.errors).to.be.undefined;
  });

  it('reads aggsState properly', async () => {
    const { data } = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${graphqlField} {
              aggsState {
                timestamp
                state {
                  field
                  active
                  show
                }
              }
            }
          }
        `),
      },
    });

    expect(data?.data?.[graphqlField]?.aggsState?.state).to.be.not.empty;
    expect(data?.errors).to.be.undefined;
  });

  it('reads columns state properly', async () => {
    const { data } = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${graphqlField} {
              columnsState {
                state {
                  keyField
                }
              }
            }
          }
        `),
      },
    });

    expect(data?.data?.[graphqlField]?.columnsState?.state).to.be.not.empty;
    expect(data?.errors).to.be.undefined;
  });

  it('reads matchbox state properly', async () => {
    const { data } = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${graphqlField} {
              matchBoxState {
                state {
                  field
                }
              }
            }
          }
        `),
      },
    });

    expect(data?.data?.[graphqlField]?.matchBoxState?.state).to.be.not.empty;
    expect(data?.errors).to.be.undefined;
  });
};
