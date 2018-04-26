import { capitalize } from 'lodash';
import mappingToNestedFields from './mappingToNestedFields';
import mappingToScalarFields from './mappingToScalarFields';
import createConnectionTypeDefs from './createConnectionTypeDefs';
import mappingToObjectTypes from './mappingToObjectTypes';

let mappingToNestedTypes = (type, mapping, parent, extendedFields) => {
  return Object.entries(mapping)
    .filter(([, metadata]) => metadata.type === 'nested')
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
        ${createConnectionTypeDefs({
          type: {
            ...type,
            name: type + capitalize(field),
            mapping: metadata.properties,
          },
          fields: [
            mappingToScalarFields(
              metadata.properties,
              extendedFields,
              [parent, field].filter(Boolean).join('.'),
            ),
            mappingToNestedFields(
              type + capitalize(field),
              metadata.properties,
              [parent, field].filter(Boolean).join('.'),
              extendedFields,
            ),
          ],
        })}
      `,
    );
};

export default mappingToNestedTypes;
