import express from 'express'
import bodyParser from 'body-parser'
import { graphqlExpress } from 'apollo-server-express'
import { rainbow } from 'chalk-animation'

export default ({ port = 5050, context = {}, schema } = {}) => {
  const app = express()

  app.use(
    ['/', '/graphql', '/graphql/:query'],
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
