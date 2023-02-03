import mappingToColumnsType from './mappingToColumnsType';
import { toQuery } from './utils/columnsToGraphql';

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
						query: toQuery({ accessor: fieldName }),
						jsonPath: `$.${fieldName.replace(/\[\d*\]/g, '[*]')}`,
				  }
				: { accessor: fieldName }),
		};
	});
};

export default mappingToColumnsState;
