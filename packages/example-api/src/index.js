import fs from 'fs'
import { promisify } from 'util'
import elasticsearch from 'elasticsearch'
import makeSchema from '@arranger/schema'
import server from '@arranger/server'

let writeFile = promisify(fs.writeFile)

let fetchMappings = async ({ types, es }) => {
  let mappings = await Promise.all(
    types.map(([, { index, es_type }]) =>
      es.indices.getMapping({
        index,
        type: es_type,
      }),
    ),
  )
  return mappings
}

let writeMappingsToFiles = async ({ types, mappings }) =>
  types.forEach(
    async ([type], i) =>
      await writeFile(
        mappingFolder(type),
        JSON.stringify(Object.values(mappings[i])[0].mappings, null, 2),
      ),
  )

let addMappingsToTypes = ({ types, mappings }) => {
  return types.map(([key, type], i) => {
    let mapping = Object.values(mappings[i])[0].mappings[type.es_type]
      .properties

    return {
      ...type,
      mapping,
      nestedFields: getNestedFields(mapping),
    }
  })
}

if (process.env.WITH_ES) {
  let esconfig = {
    host: process.env.ES_HOST,
  }

  if (process.env.ES_TRACE) esconfig.log = process.env.ES_TRACE

  let es = new elasticsearch.Client(esconfig)

  let mappings

  let schema = makeSchema()

  es
    .ping({
      requestTimeout: 1000,
    })
    .then(() => server({ schema, context: { es } }))
    .catch(err => {
      server({ schema })
    })
} else {
  let schema = makeSchema({ mock: true })
  server({ schema })
}
