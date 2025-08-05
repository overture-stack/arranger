import { startCase } from 'lodash-es';

import { configProperties } from '#config/types.js';
import type { ColumnConfigs, ExtendedConfigs, FacetsConfigs, FieldFromMapping, TableConfigs } from '#config/types.js';

import flattenMapping from './flattenMapping.js';
import { toQuery } from './utils/columnsToGraphql.js';

export const extendColumns = (tableConfig: TableConfigs, extendedFields: ExtendedConfigs[]): TableConfigs => {
	const columnsFromConfig = tableConfig?.[configProperties.COLUMNS];
	const hasColumnsConfig = columnsFromConfig?.length > 0;

	hasColumnsConfig || console.log('  - No Columns config present. Defaulting to first 5 extended fields.');

	// TODO: D.R.Y. this thing

	const columns = (
		hasColumnsConfig
			? columnsFromConfig
					.map((column) => {
						const extendedObj = extendedFields?.find((obj) => obj.fieldName === column?.fieldName);

						return column.fieldName
							? {
									...column,
									// This field is how React-Table finds the data
									[configProperties.ACCESSOR]:
										column[configProperties.ACCESSOR] ?? column[configProperties.FIELD_NAME],
									// is this column selectable in the table Columns dropdown
									[configProperties.CAN_CHANGE_SHOW]:
										column[configProperties.CAN_CHANGE_SHOW] ?? true,
									// to be used as the column's "Header"
									[configProperties.DISPLAY_NAME]:
										column[configProperties.DISPLAY_NAME] ??
										extendedObj?.[configProperties.DISPLAY_NAME] ??
										'* ' + column[configProperties.FIELD_NAME],
									// used to format the values in the cell differently from their type set in the mapping
									[configProperties.DISPLAY_TYPE]:
										column[configProperties.DISPLAY_TYPE] ??
										extendedObj?.[configProperties.DISPLAY_TYPE],
									// these likely are human readable values e.g. false means "no", true means "yes", etc.
									[configProperties.DISPLAY_VALUES]:
										column[configProperties.DISPLAY_VALUES] ??
										extendedObj?.[configProperties.DISPLAY_VALUES] ??
										{},
									// should the cell be understood as a list of items, or a mere string
									[configProperties.IS_ARRAY]: extendedObj?.[configProperties.IS_ARRAY] ?? false,
									////////// TODO!!!!!!!!!!
									[configProperties.JSON_PATH]:
										column[configProperties.JSON_PATH] ??
										`$.${column[configProperties.FIELD_NAME].replace(/\[\d*\]/g, '[*]')}`,
									////////// TODO!!!!!!!!!!
									[configProperties.QUERY]:
										column[configProperties.QUERY] ?? toQuery(column[configProperties.FIELD_NAME]),
									// should the column be shown by default
									[configProperties.SHOW]: column[configProperties.SHOW] ?? false,
									// self-descriptive, hopefully
									[configProperties.SORTABLE]: column[configProperties.SORTABLE],
								}
							: null;
					})
					.filter(Boolean)
			: // Provides baseline configs in case none are given from file/props
				extendedFields
					?.map((column) => {
						return ['nested', 'object'].includes(column[configProperties.DISPLAY_TYPE])
							? null
							: {
									[configProperties.FIELD_NAME]: column[configProperties.FIELD_NAME],
									// This field is how React-Table finds the data
									[configProperties.ACCESSOR]: column[configProperties.FIELD_NAME],
									[configProperties.CAN_CHANGE_SHOW]: true,
									// to be used as the column's "Header"
									[configProperties.DISPLAY_NAME]:
										column[configProperties.DISPLAY_NAME] ??
										'* ' + column[configProperties.FIELD_NAME],
									// used to format the values in the cell differently from their type set in the mapping
									[configProperties.DISPLAY_TYPE]: column[configProperties.DISPLAY_TYPE],
									// these likely are human readable values e.g. false means "no", true means "yes", etc.
									[configProperties.DISPLAY_VALUES]: column[configProperties.DISPLAY_VALUES] ?? {},
									// should the cell be understood as a list of items, or a mere string
									[configProperties.IS_ARRAY]: column[configProperties.IS_ARRAY],
									////////// TODO!!!!!!!!!!
									[configProperties.JSON_PATH]: `$.${column[configProperties.FIELD_NAME].replace(/\[\d*\]/g, '[*]')}`,
									////////// TODO!!!!!!!!!!
									[configProperties.QUERY]: toQuery(column[configProperties.FIELD_NAME]),
									// should the column be shown by default
									[configProperties.SHOW]: true,
									// self-descriptive, hopefully
									[configProperties.SORTABLE]: false,
								};
					})
					.filter(Boolean)
					.slice(0, 10)
	) as ColumnConfigs[]; // TODO: make this better

	return {
		...tableConfig,
		[configProperties.COLUMNS]: columns,
	};
};

export const extendFacets = (facetsConfig: FacetsConfigs, extendedFields: ExtendedConfigs[]) => {
	const aggsFromConfig = facetsConfig?.[configProperties.AGGS];
	const hasAggsConfig = aggsFromConfig?.length > 0;

	hasAggsConfig || console.log('  - No Aggregations config present. Defaulting to first 5 extended fields.');

	// TODO: D.R.Y. this thing

	const aggs = hasAggsConfig
		? aggsFromConfig
				.map((agg) => {
					const extendedObj = extendedFields?.find(
						(obj) => obj.fieldName === agg.fieldName.replace(/__/g, '.'),
					);

					return agg.fieldName
						? {
								...agg,
								[configProperties.DISPLAY_NAME]:
									agg[configProperties.DISPLAY_NAME] ?? extendedObj?.[configProperties.DISPLAY_NAME],
								// defines aggregation type (component used in facets)
								[configProperties.DISPLAY_TYPE]:
									agg[configProperties.DISPLAY_TYPE] ?? extendedObj?.[configProperties.DISPLAY_TYPE],
								// TODO: determine what "isActive" does, vs "show"
								[configProperties.IS_ACTIVE]: agg[configProperties.IS_ACTIVE] || false,
								// should it be shown in the facets panel
								[configProperties.SHOW]: agg[configProperties.SHOW] || false,
							}
						: null;
				})
				.filter(Boolean)
		: extendedFields
				?.map((agg) => {
					return agg[configProperties.FIELD_NAME].includes('_id') ||
						['nested', 'object'].includes(agg[configProperties.DISPLAY_TYPE])
						? null
						: {
								[configProperties.FIELD_NAME]: agg[configProperties.FIELD_NAME].replaceAll('.', '__'),
								// defines aggregation type (component used in facets)
								[configProperties.DISPLAY_TYPE]: agg[configProperties.DISPLAY_TYPE],
								// TODO: determine what "isActive" does, vs "show"
								[configProperties.IS_ACTIVE]: true,
								// should it be shown in the facets panel
								[configProperties.SHOW]: true,
							};
				})
				.filter(Boolean)
				.slice(0, 10);

	return {
		...facetsConfig,
		[configProperties.AGGS]: aggs,
	};
};

export const extendFields = (mappingFields: FieldFromMapping[], extendedFromFile: ExtendedConfigs[]) => {
	return mappingFields.map(({ fieldName, type, ...rest }) => {
		const {
			displayName = startCase(fieldName.replace(/\./g, ' ')),
			displayType = type,
			displayValues = {},
			isActive = false, // TODO: what does "active" do in general?
			isArray = false,
			primaryKey = false,
			quickSearchEnabled = false,
			rangeStep = 0,
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
			type,
			unit,
			...rest,
		};
	});
};

export const flattenMappingToFields = async (mapping: Record<string, unknown> = {}): Promise<FieldFromMapping[]> =>
	flattenMapping(mapping).map(({ field: fieldName = '', type = 'keyword', ...rest }) => ({
		fieldName,
		type,
		...rest,
	}));

// TODO: disabled because its purpose is unclear
// export default (mapping) => extendFields(flattenMapping(mapping));
