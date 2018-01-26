import express from 'express';
import { graphqlExpress } from 'apollo-server-express';
import elasticsearch from 'elasticsearch';

module.exports = ({
  app,
  http,
  io,
  port = 5050,
  context = {},
  schema,
  endpoints = ['/graphql', '/graphql/:query'],
} = {}) => {
  app.use(
    endpoints,
    schema
      ? graphqlExpress({ schema, context })
      : (req, res) =>
          res.json({
            error:
              'schema is undefined. Make sure you provide a valid GraphQL Schema. https://www.apollographql.com/docs/graphql-tools/generate-schema.html',
          }),
  );
};
