import { capitalize } from 'lodash';
import mappingToNestedFields from './mappingToNestedFields';
import mappingToScalarFields from './mappingToScalarFields';
import mappingToNestedTypes from './mappingToNestedTypes';

let mappingToObjectTypes = (type, mapping, parent, extendedFields) => {
  return Object.entries(mapping)
    .filter(([, metadata]) => !metadata.type && metadata.properties)
    .map(
      ([field, metadata]) => `
        ${mappingToObjectTypes(
          type + capitalize(field),
          metadata.properties,
          [parent, field].filter(Boolean).join('.'),
          extendedFields,
        )},
        ${mappingToNestedTypes(
          type + capitalize(field),
          metadata.properties,
          [parent, field].filter(Boolean).join('.'),
          extendedFields,
        ).join('\n')}
        type ${type + capitalize(field)} {
          ${mappingToNestedFields(
            type + capitalize(field),
            metadata.properties,
            [parent, field].filter(Boolean).join('.'),
            extendedFields,
          )}
          ${mappingToScalarFields(
            metadata.properties,
            extendedFields,
            [parent, field].filter(Boolean).join('.'),
          )}
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
//           ${mappingToScalarFields(metadata.properties, type.extendedFields)}
//         }
//       `,
//     )
// }

export default mappingToObjectTypes;
