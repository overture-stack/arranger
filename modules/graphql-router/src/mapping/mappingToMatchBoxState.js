const defaults = {
	isActive: false,
	keyFieldName: null,
	searchFields: [],
};

export default ({ name, extendedFields }) => [
	{
		displayName: name,
		fieldName: '',
		...defaults,
	},
	...extendedFields
		.filter((x) => x.type === 'nested')
		.map(({ fieldName, displayName }) => ({
			displayName,
			fieldName,
			...defaults,
		})),
];
