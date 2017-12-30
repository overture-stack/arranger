import fetch from 'node-fetch'

let api = `${process.env.GDCAPI}/graphql`

export default ({ type, fields, graphql_fields, nested_fields, args }) =>
  fetch(api + '/build_aggregations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      args,
      fields,
      graphql_fields,
      doc_type: type.name.toLowerCase(),
      nested_fields,
    }),
  }).then(r => r.json())
