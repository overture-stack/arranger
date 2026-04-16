export function toQuery(fieldName = '') {
	return fieldName
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
		}, '');
}
