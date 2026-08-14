import { capitalize } from 'lodash-es';

import createConnectionTypeDefs from './createConnectionTypeDefs.js';
import mappingToNestedFields from './mappingToNestedFields.js';
import mappingToObjectTypes from './mappingToObjectTypes.js';
import mappingToScalarFields from './mappingToScalarFields.js';
import { identityGraphqlNameRegistry } from './utils/graphqlNameRegistry.js';

/**
 * Recursively builds a Relay-style connection (`type`/`Aggregations`/`Connection`/`Edge`/`Node`)
 * for each ES `nested` field in `mapping`. `registry` supplies the GraphQL-safe leaf name each
 * child type name is built from, the same way `mappingToObjectTypes` does for plain object fields.
 */
const mappingToNestedTypes = (type, mapping, parent, extendedFields, registry = identityGraphqlNameRegistry) => {
	return Object.entries(mapping)
		.filter(([, metadata]) => metadata.type === 'nested')
		.map(([field, metadata]) => {
			const fullFieldName = [parent, field].filter(Boolean).join('.');
			const nestedType = type + capitalize(registry.toGraphqlLeafName(fullFieldName));

			return `
        ${mappingToObjectTypes(nestedType, metadata.properties, fullFieldName, extendedFields, registry)},
        ${mappingToNestedTypes(nestedType, metadata.properties, fullFieldName, extendedFields, registry).join('\n')}
        ${createConnectionTypeDefs({
				type: {
					...type,
					name: nestedType,
					mapping: metadata.properties,
				},
				fields: [
					mappingToScalarFields(metadata.properties, extendedFields, fullFieldName, registry),
					mappingToNestedFields(nestedType, metadata.properties, fullFieldName, extendedFields, registry),
				],
			})}`;
		});
};

export default mappingToNestedTypes;
