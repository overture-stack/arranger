import { getProject } from '../utils/projects';

export default ({ io, schema, context }) =>
  io.on('connection', socket => {
    socket.on(
      'client::stream',
      async ({
        projectId,
        index,
        variables = null,
        size = 100,
        fields = '',
      }) => {
        const project = getProject(projectId);

        const { data } = await project.runQuery({
          query: `
            query ($sqon: JSON) {
              ${index} {
                hits(filters: $sqon) {
                  total
                }
              }
            }
          `,
          variables,
        });

        let total = data[index].hits.total;
        let steps = Array(Math.round(total / size)).fill();

        await Promise.all(
          steps.map((x, i) => {
            return project
              .runQuery({
                query: `
                  query ($sqon: JSON, $first: Int, $offset: Int) {
                    ${index} {
                      hits(first: $first, offset: $offset, filters: $sqon) {
                        edges {
                          node {
                            ${fields}
                          }
                        }
                      }
                    }
                  }
                `,
                variables: {
                  ...variables,
                  first: size,
                  offset: i * size,
                },
              })
              .then(({ data }) =>
                socket.emit('server::chunk', { data, total }),
              );
          }),
        );

        socket.emit('server::stream::end', {});
      },
    );
  });
