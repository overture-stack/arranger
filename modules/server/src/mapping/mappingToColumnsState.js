import mappingToColumnsType from './mappingToColumnsType';
import { toQuery } from './utils/columnsToGraphql';

// TODO: unused function? do we still need it? can it be used for new implementation?
const mappingToColumnsState = (mapping) => {
	return mappingToColumnsType(mapping).map(({ fieldName, type }) => {
		const id = fieldName.replace(/hits\.edges\[\d*\].node\./g, '');

		return {
			show: false,
			type,
			sortable: type !== 'list',
			canChangeShow: type !== 'list',
			fieldName: id,
			...(type === 'list'
				? {
						query: toQuery(fieldName),
						jsonPath: `$.${fieldName.replace(/\[\d*\]/g, '[*]')}`,
				  }
				: { accessor: fieldName }),
		};
	});
};

export default mappingToColumnsState;
