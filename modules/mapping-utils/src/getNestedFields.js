import { flattenDeep } from 'lodash'

let getNestedFields = (mapping, parent = '') => {
  return flattenDeep(
    Object.entries(mapping)
      .filter(([, metadata]) => metadata.type === 'nested')
      .map(([field, metadata]) => [
        parent ? `${parent}.${field}` : field,
        ...getNestedFields(
          metadata.properties,
          parent ? `${parent}.${field}` : field,
        ),
      ]),
  )
}

export default getNestedFields
