import fs from 'fs'
import { promisify } from 'util'
import elasticsearch from 'elasticsearch'
import makeSchema from '@arranger/schema'
import server from '@arranger/server'
import { addMappingsToTypes } from '@arranger/mapping-utils'

let writeFile = promisify(fs.writeFile)

let fetchMappings = ({ types, es }) => {
  return Promise.all(
    types.map(([, { index, es_type }]) =>
      es.indices.getMapping({
        index,
        type: es_type,
      }),
    ),
  )
}
//
// let writeMappingsToFiles = async ({ types, mappings }) =>
//   types.forEach(
//     async ([type], i) =>
//       await writeFile(
//         mappingFolder(type),
//         JSON.stringify(Object.values(mappings[i])[0].mappings, null, 2),
//       ),
//   )

let main = async () => {
  if (process.env.WITH_ES) {
    let esconfig = {
      host: process.env.ES_HOST,
    };

    if (process.env.ES_USER && process.env.ES_PASSWORD) {
      esconfig.httpAuth = `${process.env.ES_USER}:${process.env.ES_PASSWORD}`;
    }

    if (process.env.ES_TRACE) esconfig.log = process.env.ES_TRACE

    let es = new elasticsearch.Client(esconfig)

    es
      .ping({
        requestTimeout: 1000,
      })
      .then(async () => {
        let rootTypes = Object.entries(global.config.ROOT_TYPES)
        let types = Object.entries(global.config.ES_TYPES)
        let mappings = await fetchMappings({ types, es })
        let typesWithMappings = addMappingsToTypes({ types, mappings })
        let schema = makeSchema({ types: typesWithMappings, rootTypes })
        server({ schema, context: { es } })
      })
      .catch(err => {
        console.log(err)
        server({ schema })
      })
  } else {
    let schema = makeSchema({ mock: true })
    server({ schema })
  }
}

main()
