import fetch from 'node-fetch'

let api = `${process.env.GDCAPI}/graphql`

export default ({ nested_fields, aggs }) =>
  fetch(api + '/prune_aggregations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      aggs,
      nested_fields,
    }),
  }).then(r => r.json())
