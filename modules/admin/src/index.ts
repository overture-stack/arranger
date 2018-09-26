import { ApolloServer, gql } from 'apollo-server-express';
import { mergeSchemas } from 'graphql-tools';
import { createSchema as createAggsStateSchema } from './AggsState';
import { createSchema as createColumnsStateSchema } from './ColumnsState';

const createSchema = async () => {
  const aggsStateSchema = await createAggsStateSchema();
  const collumnsStateSchema = await createColumnsStateSchema();

  const mergedSchema = mergeSchemas({
    schemas: [aggsStateSchema, collumnsStateSchema],
  });
  return mergedSchema;
};

export default async () => new ApolloServer({ schema: await createSchema() });
