import { esToAggTypesMap } from '@overture-stack/arranger-types/elastic/constants';
import { flattenDeep } from 'lodash-es';

// add two underscores after a value if it's truthy (not an empty string)
// used to create fields representing es paths
// why? because graphql fields cannot contain dots
// diagnoses.treatments 👎
// vs
// diagnoses__treatments 👍
// type AppendUnderscoresFn = (a: string) => string;
// const appendUnderscores: AppendUnderscoresFn = (x) => (x ? x + '__' : '');
const appendUnderscores = (x) => (x ? x + '__' : '');

const mappingToAggsType = (properties, parent = '') =>
	flattenDeep(
		Object.entries(properties)
			.filter(([fieldName, data]) => data?.properties || data?.type)
			.map(([fieldName, data]) =>
				data?.properties
					? mappingToAggsType(data.properties, appendUnderscores(parent) + fieldName)
					: `${appendUnderscores(parent) + fieldName}: ${esToAggTypesMap[data.type]}`,
			),
	);

export default mappingToAggsType;
