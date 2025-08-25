import { NumericAggregationsOptions } from '#components/charts/Bar/BarChart';

const queryTemplateBuckets = `
    bucket_count
    buckets {
      doc_count
      key
    }
  `;

/**
 * Aggregations GQL type
 *
 * @param param0
 * @param
 * @returns
 */
export const queryTemplateAggregations = ({ fieldName }: { fieldName: string }) => {
	return `
  ${fieldName}
	{
		__typename
  	${queryTemplateBuckets}
	}
`;
};

// gql doesn't like stringifed keys
// supports single level of properties
const gqlStringifyObject = (obj: Object) => {
	const properties = Object.entries(obj).reduce((acc, [key, value], index, entries) => {
		const addSeperator = index === entries.length - 1 ? '' : ',';
		return `${acc}${[key]}: ${JSON.stringify(value)}${addSeperator}`;
	}, '');
	return `{${properties}}`;
};

/**
 * NumericAggregations GQL type requires a parameterized field
 *
 * @param param0
 * @param
 * @param
 * @returns
 */
export const queryTemplateNumericAggregations = ({
	fieldName,
	variables,
}: {
	fieldName: string;
	variables: NumericAggregationsOptions;
}) => {
	// TODO: investigate move into variables, could use GQL client
	const ranges = `[${(variables.ranges || []).reduce((acc, range, index, entries) => {
		const addSeperator = index === entries.length - 1 ? '' : ',';
		return `${acc}${gqlStringifyObject(range)}${addSeperator}`;
	}, '')}]`;

	return `
  ${fieldName} {
	__typename
  range(ranges: ${ranges})
		{
			__typename
			${queryTemplateBuckets}
		}
  }
`;
};
