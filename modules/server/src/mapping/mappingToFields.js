import { capitalize } from 'lodash';

import createConnectionTypeDefs from './createConnectionTypeDefs';
import mappingToNestedFields from './mappingToNestedFields';
import mappingToObjectTypes from './mappingToObjectTypes';
import mappingToScalarFields from './mappingToScalarFields';

const mappingToFields = ({ enableDocumentHits, type, parent }) => {
	const fieldsToExclude = enableDocumentHits ? ['hits'] : [];
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
