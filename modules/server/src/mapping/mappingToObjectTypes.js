import { capitalize } from 'lodash';

import mappingToNestedFields from './mappingToNestedFields';
import mappingToScalarFields from './mappingToScalarFields';
import mappingToNestedTypes from './mappingToNestedTypes';

let mappingToObjectTypes = (type, mapping, parent, extendedFields) => {
  return Object.entries(mapping)
    .filter(([, metadata]) => !metadata.type && metadata.properties)
    .map(
      ([fieldName, metadata]) => `
        ${mappingToObjectTypes(
          type + capitalize(fieldName),
          metadata.properties,
          [parent, fieldName].filter(Boolean).join('.'),
          extendedFields,
        )},
        ${mappingToNestedTypes(
          type + capitalize(fieldName),
          metadata.properties,
          [parent, fieldName].filter(Boolean).join('.'),
          extendedFields,
        ).join('\n')}
        type ${type + capitalize(fieldName)} {
          ${mappingToNestedFields(
            type + capitalize(fieldName),
            metadata.properties,
            [parent, fieldName].filter(Boolean).join('.'),
            extendedFields,
          )}
          ${mappingToScalarFields(
            metadata.properties,
            extendedFields,
            [parent, fieldName].filter(Boolean).join('.'),
          )}
        }
      `,
    );
};

// TODO: figure out where this is making a dupe field

// let mappingToObjectTypes = (type, mapping) => {
//   return Object.entries(mapping)
//     .filter(([, metadata]) => !metadata.type)
//     .map(
//       ([fieldName, metadata]) => `
//         ${mappingToFields({
//           type: {
//             name: type.name + capitalize(fieldName),
//             mapping: metadata.properties,
//           },
//         })}
//         type ${type + capitalize(fieldName)} {
//           ${mappingToScalarFields(metadata.properties, type.extendedFields)}
//         }
//       `,
//     )
// }

export default mappingToObjectTypes;
