import { startCase } from 'lodash';

import {
	ConfigProperties,
	ExtendedConfigsInterface,
	FacetsConfigsInterface,
	TableConfigsInterface,
} from '@/config/types';

import flattenMapping from './flattenMapping';

export const extendColumns = (
	tableConfig: TableConfigsInterface,
	extendedFields: ExtendedConfigsInterface[],
) => ({
	...tableConfig,
	[ConfigProperties.COLUMNS]: tableConfig?.[ConfigProperties.COLUMNS]
		?.map((column) => {
			const extendedObj = extendedFields?.find((obj) => obj.fieldName === column?.fieldName);

			return column.fieldName
				? {
						...column,
						// This field is how React-Table finds the data
						[ConfigProperties.ACCESSOR]:
							column[ConfigProperties.ACCESSOR] ?? column[ConfigProperties.FIELD_NAME],
						// TODO: carried over from "@/mapping/mappingToColumnState"
						// probably useful to abstract the array cell type from the ui
						// accessor: ...(type === 'list'
						// 	? {
						// 			query: toQuery({ accessor: fieldName }),
						// 			jsonPath: `$.${fieldName.replace(/\[\d*\]/g, '[*]')}`,
						// 	  }
						// 	: { accessor: fieldName }),
						// is this column selectable in the table Columns dropdown
						[ConfigProperties.CAN_CHANGE_SHOW]: column[ConfigProperties.CAN_CHANGE_SHOW],
						// to be used as the column's "Header"
						[ConfigProperties.DISPLAY_NAME]:
							column[ConfigProperties.DISPLAY_NAME] ??
							extendedObj?.[ConfigProperties.DISPLAY_NAME] ??
							'* ' + column[ConfigProperties.FIELD_NAME],
						// used to format the values in the cell differently from their type set in the mapping
						[ConfigProperties.DISPLAY_TYPE]:
							column[ConfigProperties.DISPLAY_TYPE] ?? extendedObj?.[ConfigProperties.DISPLAY_TYPE],
						// these likely are human readable values e.g. false means "no", true means "yes", etc.
						[ConfigProperties.DISPLAY_VALUES]:
							column[ConfigProperties.DISPLAY_VALUES] ??
							extendedObj?.[ConfigProperties.DISPLAY_VALUES] ??
							{},
						// should the cell be understood as a list of items, or a mere string
						[ConfigProperties.IS_ARRAY]: extendedObj?.[ConfigProperties.IS_ARRAY],
						// should the column be shown by default
						[ConfigProperties.SHOW]: column[ConfigProperties.SHOW],
						// self-descriptive, hopefully
						[ConfigProperties.SORTABLE]: column[ConfigProperties.SORTABLE],
				  }
				: null;
		})
		.filter(Boolean),
});

export const extendFacets = (
	facetsConfig: FacetsConfigsInterface,
	extendedFields: ExtendedConfigsInterface[],
) => ({
	...facetsConfig,
	[ConfigProperties.AGGS]: facetsConfig?.[ConfigProperties.AGGS]
		?.map((agg) => {
			const extendedObj = extendedFields?.find(
				(obj) => obj.fieldName === agg?.fieldName.replace(/__/g, '.'),
			);

			return agg.fieldName
				? {
						...agg,
						// defines aggregation type (component used in facets)
						[ConfigProperties.DISPLAY_TYPE]:
							agg[ConfigProperties.DISPLAY_TYPE] ?? extendedObj?.[ConfigProperties.DISPLAY_TYPE],
						// TODO: determine what "isActive" does, vs "show"
						[ConfigProperties.IS_ACTIVE]: agg[ConfigProperties.IS_ACTIVE],
						// should it be shown in the facets panel
						[ConfigProperties.SHOW]: agg[ConfigProperties.SHOW],
				  }
				: null;
		})
		.filter(Boolean),
});

export const extendFields = (
	mappingFields: Record<string, unknown>,
	extendedFromFile: ExtendedConfigsInterface[],
) => {
	return flattenMapping(mappingFields)?.map(
		({ field: fieldName = '', type: typeFromMapping = 'keyword', ...rest }) => {
			const {
				displayName = startCase(fieldName.replace(/\./g, ' ')),
				displayType = typeFromMapping,
				displayValues = {},
				isActive = false, // TODO: what does "active" do in general?
				isArray = false,
				primaryKey = false,
				quickSearchEnabled = false,
				rangeStep = typeFromMapping === 'float' || typeFromMapping === 'double' ? 0.01 : 1,
				unit = null,
			} = extendedFromFile.find((customData) => customData.fieldName === fieldName) || {};

			return {
				displayName,
				displayType,
				displayValues,
				fieldName,
				isActive,
				isArray,
				primaryKey,
				quickSearchEnabled,
				rangeStep,
				type: typeFromMapping,
				unit,
				...rest,
			};
		},
	);
};

// TODO: disabled because its purpose is unclear
// export default (mapping) => extendFields(flattenMapping(mapping));
