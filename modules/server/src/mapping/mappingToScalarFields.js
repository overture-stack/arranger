export let esToGraphqlTypeMap = {
	boolean: 'Boolean',
	byte: 'Int',
	date: 'String',
	double: 'Float',
	float: 'Float',
	half_float: 'Float',
	integer: 'Int',
	keyword: 'String',
	long: 'Int',
	object: 'JSON', // https://github.com/overture-stack/arranger/blob/master/modules/schema/src/index.js#L9
	scaled_float: 'Float',
	string: 'String',
	text: 'String',
	unsigned_long: 'Int',
};

const maybeArray = (fieldName, extendedFields, type, parent) => {
	const fullFieldName = [parent, fieldName].filter(Boolean).join('.');
	return extendedFields?.find((extendedField) => extendedField.fieldName === fullFieldName)?.isArray
		? `[${type}]`
		: type;
};

export default (mapping, extendedFields, parent) => {
	return Object.entries(mapping)
		.filter(([, metadata]) => Object.keys(esToGraphqlTypeMap).includes(metadata.type))
		.map(
			([fieldName, metadata]) =>
				`${fieldName}: ${maybeArray(
					fieldName,
					extendedFields,
					esToGraphqlTypeMap[metadata.type],
					parent,
				)}`,
		);
};
