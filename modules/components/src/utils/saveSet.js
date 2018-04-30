import { graphql } from './api';

export default ({ type, path, userId, sqon = {}, returnIds = false, api }) =>
  (api || graphql)({
    query: `
      mutation saveSet($type: String! $userId: String $sqon: JSON! $path: String!) {
        saveSet(type: $type, userId: $userId, sqon: $sqon, path: $path) {
          setId
          createdAt
          path
          size
          sqon
          type
          userId
          ${returnIds ? `ids` : ``}
        }
      }
    `,
    variables: { sqon, type, userId, path },
  });
