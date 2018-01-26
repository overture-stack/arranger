export default ({ io }) =>
  io.on('connection', socket => {
    socket.on(
      'client::stream',
      async ({ index, variables = null, size = 100, fields = '' }) => {
        let { data } = await fetch('http://localhost:5050', {
          ...fetchOptions,
          body: JSON.stringify({
            variables,
            query: `
          query ($filters: JSON) {
            ${index} {
              hits(filters: $filters) {
                total
              }
            }
          }
        `,
          }),
        }).then(r => r.json());

        let total = data[index].hits.total;
        let steps = range(0, Math.round(total / size));

        await Promise.all(
          steps.map((x, i) => {
            return fetch(process.env.API_HOST, {
              ...fetchOptions,
              body: JSON.stringify({
                variables: {
                  ...variables,
                  first: size,
                  offset: x * size,
                },
                query: `
            query ($first: Int, $offset: Int) {
              ${index} {
                hits(first: $first, offset: $offset) {
                  edges {
                    node {
                      ${fields}
                    }
                  }
                }
              }
            }
          `,
              }),
            })
              .then(r => r.json())
              .then(({ data }) => {
                socket.emit('server::chunk', { data, total });
              });
          }),
        );
        socket.emit('server::stream::end', {});
      },
    );
  });
