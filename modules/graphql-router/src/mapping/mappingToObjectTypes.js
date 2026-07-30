import { capitalize } from 'lodash-es';

import mappingToNestedFields from './mappingToNestedFields.js';
import mappingToNestedTypes from './mappingToNestedTypes.js';
import mappingToScalarFields from './mappingToScalarFields.js';
import { identityGraphqlNameRegistry } from './utils/graphqlNameRegistry.js';

/**
 * Recursively builds a GraphQL `type` definition for each non-nested object field in `mapping`,
 * e.g. `type DonorBiomarker { ... }`. `registry` supplies the GraphQL-safe leaf name each child
 * type name is built from (`type + capitalize(leafName)`); `fullFieldName` (raw) is threaded down
 * unchanged so descendant calls can still match `extendedFields` by their real ES path.
 */
const mappingToObjectTypes = (type, mapping, parent, extendedFields, registry = identityGraphqlNameRegistry) => {
	if (!mapping) {
		throw `Invalid type mapping of ${mapping}`;
	}

	return Object.entries(mapping)
		.filter(([, metadata]) => !metadata.type && metadata.properties)
		.map(([field, metadata]) => {
			const fullFieldName = [parent, field].filter(Boolean).join('.');
			const nestedType = type + capitalize(registry.toGraphqlLeafName(fullFieldName));

			return `
        ${mappingToObjectTypes(nestedType, metadata.properties, fullFieldName, extendedFields, registry)},
        ${mappingToNestedTypes(nestedType, metadata.properties, fullFieldName, extendedFields, registry).join('\n')}
        type ${nestedType} {
          ${mappingToNestedFields(nestedType, metadata.properties, fullFieldName, extendedFields, registry)}
          ${mappingToScalarFields(metadata.properties, extendedFields, fullFieldName, registry)}}`;
		});
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
