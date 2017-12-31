import fetch from 'node-fetch'

let api = `${process.env.GDCAPI}/graphql`

export default ({ type, filters, score, nested_fields }) =>
  fetch(api + '/build_filters', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filters,
      score,
      doc_type: type.name.toLowerCase(),
      nested_fields,
    }),
  }).then(r => r.json())
