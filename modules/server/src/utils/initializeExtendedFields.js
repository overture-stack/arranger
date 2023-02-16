import { flattenDeep } from 'lodash';

import replaceBy from './replaceBy';

//TODO: this file may be unused

const initializeExtendedFields = async ({ indexPrefix, fields, config, esClient }) => {
	const mergedFields = fields?.length
		? replaceBy(fields, config.extended, (x, y) => x.fieldName === y.fieldName)
		: config.extended;

	let body = flattenDeep(
		mergedFields.map((f) => [
			{
				index: {
					_index: indexPrefix,
					_type: indexPrefix,
					_id: f.fieldName,
				},
			},
			JSON.stringify(f),
		]),
	);

	await esClient.bulk({ body });

	return mergedFields;
};

export default initializeExtendedFields;
