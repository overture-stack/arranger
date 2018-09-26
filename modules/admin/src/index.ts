import { ApolloServer, gql } from 'apollo-server-express';
import { mergeSchemas } from 'graphql-tools';
import { createSchema as createAggsStateSchema } from './AggsState';
import { createSchema as createColumnsStateSchema } from './ColumnsState';

const mergedSchema = mergeSchemas({
  schemas: [createAggsStateSchema(), createColumnsStateSchema()],
});

export default () => new ApolloServer({ schema: mergedSchema });
