import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { graphqlExpress } from 'apollo-server-express';
import { rainbow } from 'chalk-animation';

module.exports = ({
  app,
  http,
  io,
  port = 5050,
  context = {},
  schema,
  endpoints = ['/', '/graphql', '/graphql/:query'],
} = {}) => {
  app.use(cors());

  app.use(
    endpoints,
    bodyParser.json({ limit: '50mb' }),
    schema
      ? graphqlExpress({ schema, context })
      : (req, res) =>
          res.json({
            error:
              'schema is undefined. Make sure you provide a valid GraphQL Schema. https://www.apollographql.com/docs/graphql-tools/generate-schema.html',
          }),
  );

  http.listen(port, () => rainbow(`⚡️ Listening on port ${port} ⚡️`));
};
