// @ts-nocheck
// graphql types have readonly modifiers all the way down

/**
 *
 * @param typeDefs - Array of DefinitionNodes representing the schema type definitions
 * @param typeName - ObjectTypeDefinition
 * @returns true if type is defined
 */
export const isTypeDefined = (typeDefs, typeName) => {
	return typeDefs.some(
		(definition) =>
			definition.kind === 'ObjectTypeDefinition' && definition.name.value === typeName,
	);
};

/**
 *
 * @param typeDefs - Array of DefinitionNodes representing the schema type definitions
 * @param parent - ObjectTypeDefinition name
 * @param child - FieldDefinition name
 * @returns true if field is defined
 */
export const isFieldDefined = (typeDefs, parent, child) => {
	const parentTypeDefFields = typeDefs.find(
		(definition) => definition.kind === 'ObjectTypeDefinition' && definition.name.value === parent,
	).fields;
	return parentTypeDefFields.some(
		(definitions) => (definitions.kind = 'FieldDefinition' && definitions.name.value === child),
	);
};
