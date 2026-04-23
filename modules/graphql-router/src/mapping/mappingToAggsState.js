import mappingToAggsType from './mappingToAggsType.js';

// TODO: unused function? do we still need it? can it be used for new implementation?
export default (mapping) =>
	mappingToAggsType(mapping)
		.map((field) => field.split(':').map(String.trim))
		.map(([fieldName, displayType]) => ({
			displayType,
			fieldName,
			isActive: true,
			show: false,
		}));
