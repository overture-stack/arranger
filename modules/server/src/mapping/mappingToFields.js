import { capitalize } from 'lodash';
import mappingToNestedFields from './mappingToNestedFields';
import mappingToScalarFields from './mappingToScalarFields';
import createConnectionTypeDefs from './createConnectionTypeDefs';
import mappingToObjectTypes from './mappingToObjectTypes';

let mappingToFields = ({ type, parent }) => {
  return [
    mappingToObjectTypes(type.name, type.mapping, parent, type.extendedFields),
    Object.entries(type.mapping)
      .filter(([, metadata]) => metadata.type === 'nested')
      .map(([field, metadata]) =>
        mappingToFields({
          parent: [parent, field].filter(Boolean).join('.'),
          type: {
            ...type,
            name: type.name + capitalize(field),
            mapping: metadata.properties,
          },
        }),
      ),
    createConnectionTypeDefs({
      type,
      fields: [
        mappingToScalarFields(type.mapping, type.extendedFields, parent),
        mappingToNestedFields(type.name, type.mapping, parent, type.extendedFields),
        type.customFields,
      ],
      createStateTypeDefs: 'createState' in type ? type.createState : true,
    }),
  ].join();
};

export default mappingToFields;
