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
              extended
            }
          }
        `),
      },
    });

    expect(data?.data?.[documentType]?.extended).to.be.not.empty;
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

  it('reads aggsState properly', async () => {
    const { data } = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${documentType} {
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

    expect(data?.data?.[documentType]?.aggsState?.state).to.be.not.empty;
    expect(data?.errors).to.be.undefined;
  });

  it('reads columns state properly', async () => {
    const { data } = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${documentType} {
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

    expect(data?.data?.[documentType]?.columnsState?.state).to.be.not.empty;
    expect(data?.errors).to.be.undefined;
  });

  it('reads matchbox state properly', async () => {
    const { data } = await api.post({
      endpoint: gqlPath,
      body: {
        query: print(gql`
          {
            ${documentType} {
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

    expect(data?.data?.[documentType]?.matchBoxState?.state).to.be.not.empty;
    expect(data?.errors).to.be.undefined;
  });
};
