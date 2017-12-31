import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import { graphqlExpress } from 'apollo-server-express'
import { rainbow } from 'chalk-animation'

module.exports = ({
  port = 5050,
  context = {},
  schema,
  endpoints = ['/', '/graphql', '/graphql/:query'],
} = {}) => {
  const app = express()
  app.use(cors())

  app.use(
    endpoints,
    bodyParser.json(),
    schema
      ? graphqlExpress({ schema, context })
      : (req, res) =>
          res.json({
            error:
              'schema is undefined. Make sure you provide a valid GraphQL Schema. https://www.apollographql.com/docs/graphql-tools/generate-schema.html',
          }),
  )

  app.listen(port, () => rainbow(`⚡️ Listening on port ${port} ⚡️`))
}
