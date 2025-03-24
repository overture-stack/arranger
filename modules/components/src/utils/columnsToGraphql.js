export function toQuery(column) {
	return (
		column.query ||
		(column.accessor || '')
			.split('.')
			.reverse()
			.reduce((acc, segment, i) => {
				if (i === 0) {
					return segment;
				} else {
					return `${segment.indexOf('edges[') === 0 ? 'edges' : segment} {
						${acc}
					}`;
				}
			}, '')
	);
}

// TODO check for field vs fieldName

/**
 * @param {Object} props
 * @param {Object} [props.config]
 * @param {string} [props.documentType]
 * @param {string} [props.queryName]
 * @param {Object[]} [props.sort]
 * @param {number} [props.first]
 * @param {number} [props.offset]
 * @param {import("#DataContext/types.js").SQONType} [props.sqon] typescript validation placeholder
 *
*/
export default function columnsToGraphql({
	config = {},
	documentType = 'unknownField',
	first = 20,
	offset = 0,
	queryName = '',
	sort = [],
	sqon = null,
}) {
	const fields = config?.columns
		?.filter(
			(column) => !(column.accessor && column.accessor === config.rowIdFieldName) && (column.fetch || column.show),
		)
		.concat(config.rowIdFieldName ? { accessor: config.rowIdFieldName } : [])
		.map(toQuery)
		.join('\n');

	return {
		fields,
		query: `
			query ${queryName}($sort: [Sort], $first: Int, $offset: Int, $score: String, $sqon: JSON) {
				${documentType} {
					hits(first: $first, offset: $offset, sort: $sort, score: $score, filters: $sqon) {
						edges {
							node {
								${fields}
							}
						}
						total
					}
				}
			}
		`,
		variables: {
			sqon,
			// TODO we may have a graphql field vs arranger fieldname issue here. Must test and validate
			sort: sort.map((s) => {
				if (s?.fieldName?.indexOf?.('hits.total') >= 0) {
					return Object.assign({}, s, { fieldName: '_score' });
				} else {
					const nested = s?.fieldName?.match?.(/(.*)\.hits\.edges\[\d+\]\.node(.*)/);

					return Object.assign({}, s, nested ? { fieldName: `${nested[1]}${nested[2]}` } : {});
				}
			}),
			score:
				sort.length > 0
					? sort
						.filter((s) => s?.fieldName?.indexOf?.('hits.total') >= 0)
						.map((s) => {
							const match = s?.fieldName?.match?.(/((.*)s)\.hits\.total/);
							return `${match[1]}.${match[2]}_id`;
						})
						.join(',')
					: null,
			offset,
			first,
		},
	};
}
