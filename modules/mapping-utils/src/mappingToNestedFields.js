import { capitalize } from 'lodash';

// export default (type, mapping) =>
//   Object.entries(mapping)
//     .filter(([, metadata]) => !metadata.type || metadata.type === 'nested')
//     .map(
//       ([field, metadata]) => `
//           ${field}: ${!metadata.type
//         ? type + capitalize(field)
//         : `[${type + capitalize(field)}]`}
//         `,
//     )
export default (type, mapping) =>
  Object.entries(mapping)
    .filter(([, metadata]) => (!metadata.type && metadata.properties) || metadata.type === 'nested')
    .map(
      ([field, metadata]) => `
          ${field}: ${type + capitalize(field)}
        `,
    );
