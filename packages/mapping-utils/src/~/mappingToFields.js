import { capitalize } from 'lodash'
import mappingToNestedFields from './mappingToNestedFields'
import mappingToScalarFields from './mappingToScalarFields'
import createConnectionTypeDefs from './createConnectionTypeDefs'
import mappingToObjectTypes from './mappingToObjectTypes'

let mappingToFields = ({ type }) => {
  return [
    mappingToObjectTypes(type.name, type.mapping),
    Object.entries(type.mapping)
      .filter(([, metadata]) => metadata.type === 'nested')
      .map(([field, metadata]) =>
        mappingToFields({
          type: {
            name: type.name + capitalize(field),
            mapping: metadata.properties,
          },
        }),
      ),
    createConnectionTypeDefs({
      type,
      fields: [
        mappingToScalarFields(type.mapping),
        mappingToNestedFields(type.name, type.mapping),
        type.customFields,
      ],
    }),
  ].join()
}

export default mappingToFields
