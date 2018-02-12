import { capitalize } from 'lodash';
import mappingToNestedFields from './mappingToNestedFields';
import mappingToScalarFields from './mappingToScalarFields';
import mappingToNestedTypes from './mappingToNestedTypes';
import mappingToFields from './mappingToFields';
import createConnectionTypeDefs from './createConnectionTypeDefs';

let mappingToObjectTypes = (type, mapping) => {
  return Object.entries(mapping)
    .filter(([, metadata]) => metadata.properties)
    .map(
      ([field, metadata]) => `
        ${mappingToObjectTypes(type + capitalize(field), metadata.properties)},
        ${mappingToNestedTypes(
          type + capitalize(field),
          metadata.properties,
        ).join('\n')}
        type ${type + capitalize(field)} {
          ${mappingToNestedFields(
            type + capitalize(field),
            metadata.properties,
          )}
          ${mappingToScalarFields(metadata.properties)}
        }
      `,
    );
};

// TODO: figure out where this is making a dupe fiel

// let mappingToObjectTypes = (type, mapping) => {
//   return Object.entries(mapping)
//     .filter(([, metadata]) => !metadata.type)
//     .map(
//       ([field, metadata]) => `
//         ${mappingToFields({
//           type: {
//             name: type.name + capitalize(field),
//             mapping: metadata.properties,
//           },
//         })}
//         type ${type + capitalize(field)} {
//           ${mappingToScalarFields(metadata.properties)}
//         }
//       `,
//     )
// }

export default mappingToObjectTypes;
