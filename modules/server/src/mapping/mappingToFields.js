import { capitalize } from 'lodash-es';

import createConnectionTypeDefs from './createConnectionTypeDefs.js';
import mappingToNestedFields from './mappingToNestedFields.js';
import mappingToObjectTypes from './mappingToObjectTypes.js';
import mappingToScalarFields from './mappingToScalarFields.js';

const mappingToFields = ({ enableDocumentHits, type, parent }) => {
	const fieldsToExclude = enableDocumentHits ? [] : ['hits'];
	return [
		mappingToObjectTypes(type.name, type.mapping, parent, type.extendedFields),
		Object.entries(type.mapping)
			.filter(([, metadata]) => metadata.type === 'nested')
			.map(([fieldName, metadata]) =>
				mappingToFields({
					parent: [parent, fieldName].filter(Boolean).join('.'),
					type: {
						...type,
						name: type.name + capitalize(fieldName),
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
			fieldsToExclude,
		}),
	].join();
};

export default mappingToFields;
