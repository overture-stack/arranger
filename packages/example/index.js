let makeSchema = require('@arranger/schema')
let server = require('@arranger/server')

let schema = makeSchema()

server({ schema })
