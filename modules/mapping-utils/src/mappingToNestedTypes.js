import { capitalize } from 'lodash'
import mappingToNestedFields from './mappingToNestedFields'
import mappingToScalarFields from './mappingToScalarFields'
import createConnectionTypeDefs from './createConnectionTypeDefs'
import mappingToObjectTypes from './mappingToObjectTypes'

let mappingToNestedTypes = (type, mapping) => {
  return Object.entries(mapping)
    .filter(([, metadata]) => metadata.type === 'nested')
    .map(
      ([field, metadata]) => `
        ${mappingToObjectTypes(type + capitalize(field), metadata.properties)},
         ${mappingToNestedTypes(
           type + capitalize(field),
           metadata.properties,
         ).join('\n')}
        ${createConnectionTypeDefs({
          type: {
            name: type + capitalize(field),
            mapping: metadata.properties,
          },
          fields: [
            mappingToScalarFields(metadata.properties),
            mappingToNestedFields(
              type + capitalize(field),
              metadata.properties,
            ),
          ],
        })}

      `,
    )
}

export default mappingToNestedTypes
