import { capitalize } from 'lodash';

import mappingToNestedFields from './mappingToNestedFields';
import mappingToScalarFields from './mappingToScalarFields';
import createConnectionTypeDefs from './createConnectionTypeDefs';
import mappingToObjectTypes from './mappingToObjectTypes';

let mappingToNestedTypes = (type, mapping, parent, extendedFields) => {
  return Object.entries(mapping)
    .filter(([, metadata]) => metadata.type === 'nested')
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
        ${createConnectionTypeDefs({
          type: {
            ...type,
            name: type + capitalize(fieldName),
            mapping: metadata.properties,
          },
          fields: [
            mappingToScalarFields(
              metadata.properties,
              extendedFields,
              [parent, fieldName].filter(Boolean).join('.'),
            ),
            mappingToNestedFields(
              type + capitalize(fieldName),
              metadata.properties,
              [parent, fieldName].filter(Boolean).join('.'),
              extendedFields,
            ),
          ],
        })}
      `,
    );
};

export default mappingToNestedTypes;
