import { capitalize } from 'lodash-es';

import createConnectionTypeDefs from './createConnectionTypeDefs.js';
import mappingToNestedFields from './mappingToNestedFields.js';
import mappingToObjectTypes from './mappingToObjectTypes.js';
import mappingToScalarFields from './mappingToScalarFields.js';
import { identityGraphqlNameRegistry } from './utils/graphqlNameRegistry.js';

/**
 * Top-level entry point building every SDL type/field definition for one catalogue's document
 * type, recursing once per ES `nested` field. `type.graphqlNameRegistry` (attached by
 * `addMappingsToTypes`) supplies the GraphQL-safe name for the document type itself and for each
 * nested field's own child type name; types built without one (e.g. the fixed "Sets" type) fall
 * back to sanitizing on the fly, since they're never built from user-supplied field names.
 */
const mappingToFields = ({ type, parent }) => {
	const registry = type.graphqlNameRegistry ?? identityGraphqlNameRegistry;

	return [
		mappingToObjectTypes(type.name, type.mapping, parent, type.extendedFields, registry),
		Object.entries(type.mapping)
			.filter(([, metadata]) => metadata.type === 'nested')
			.map(([fieldName, metadata]) => {
				const fullFieldName = [parent, fieldName].filter(Boolean).join('.');

				return mappingToFields({
					parent: fullFieldName,
					type: {
						...type,
						name: type.name + capitalize(registry.toGraphqlLeafName(fullFieldName)),
						mapping: metadata.properties,
					},
				});
			}),
		createConnectionTypeDefs({
			type,
			fields: [
				mappingToScalarFields(type.mapping, type.extendedFields, parent, registry),
				mappingToNestedFields(type.name, type.mapping, parent, type.extendedFields, registry),
				type.customFields,
			],
			createStateTypeDefs: 'createState' in type ? type.createState : true,
		}),
	].join();
};

export default mappingToFields;
