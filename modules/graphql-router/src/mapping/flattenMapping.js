import { flattenDeep } from 'lodash-es';

const joinWith =
	(s = '.') =>
		(x) =>
			x ? x + s : '';

const flattenMapping = (properties, parent = '') => {
	return flattenDeep(
		Object.entries(properties).map(([field, data]) =>
			!data.properties
				? {
					fieldName: joinWith()(parent) + field,
					type: data.type,
				}
				: [
					{
						fieldName: joinWith()(parent) + field,
						type: data.type || 'object',
					},
					...flattenMapping(data.properties, joinWith()(parent) + field),
				],
		),
	);
};

export default flattenMapping;
