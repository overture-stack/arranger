import type {
	ColumnConfigs,
	ExtendedConfigs,
	FacetsConfigs,
	TableConfigs,
} from '@overture-stack/arranger-types/configs';
import {
	dataFieldProperties,
	facetsProperties,
	tableProperties,
} from '@overture-stack/arranger-types/configs/constants';
import { startCase } from 'lodash-es';

import flattenMapping from './flattenMapping.js';
import type { FieldFromMapping } from './types.js';
import { toQuery } from './utils/columnsToGraphql.js';

export const extendColumns = (tableConfig: TableConfigs, extendedFields: ExtendedConfigs[]): TableConfigs => {
	const columnsFromConfig = tableConfig?.[tableProperties.COLUMNS];
	const hasColumnsConfig = columnsFromConfig?.length > 0;

	hasColumnsConfig || console.log('  - No Columns config present. Defaulting to first 5 extended fields.');

	// TODO: D.R.Y. this thing -> invert by going through the mapping, then reaching into the configs' "extended"

	const columns = (
		hasColumnsConfig
			? columnsFromConfig
					.map((column) => {
						const extendedObj = extendedFields?.find((obj) => obj.fieldName === column?.fieldName);

						return column.fieldName
							? {
									...column,
									// This property is how React-Table finds the data
									[dataFieldProperties.ACCESSOR]:
										column[dataFieldProperties.ACCESSOR] ?? column[dataFieldProperties.FIELD_NAME],
									// is this column selectable in the table Columns dropdown
									[dataFieldProperties.CAN_CHANGE_SHOW]:
										column[dataFieldProperties.CAN_CHANGE_SHOW] ?? true,
									// to be used as the column's "Header"
									[dataFieldProperties.DISPLAY_NAME]:
										column[dataFieldProperties.DISPLAY_NAME] ??
										extendedObj?.[dataFieldProperties.DISPLAY_NAME] ??
										'* ' + column[dataFieldProperties.FIELD_NAME],
									// used to format the values in the cell differently from their type set in the mapping
									[dataFieldProperties.DISPLAY_TYPE]:
										column[dataFieldProperties.DISPLAY_TYPE] ??
										extendedObj?.[dataFieldProperties.DISPLAY_TYPE],
									// these likely are human readable values e.g. false means "no", true means "yes", etc.
									[dataFieldProperties.DISPLAY_VALUES]:
										column[dataFieldProperties.DISPLAY_VALUES] ??
										extendedObj?.[dataFieldProperties.DISPLAY_VALUES] ??
										{},
									// should the cell be understood as a list of items, or a mere string
									[dataFieldProperties.IS_ARRAY]:
										extendedObj?.[dataFieldProperties.IS_ARRAY] ?? false,
									////////// TODO!!!!!!!!!! (field) JSON_PATH configs
									[dataFieldProperties.JSON_PATH]:
										column[dataFieldProperties.JSON_PATH] ??
										`$.${column[dataFieldProperties.FIELD_NAME].replace(/\[\d*\]/g, '[*]')}`,
									////////// TODO!!!!!!!!!! (field) QUERY configs
									[dataFieldProperties.QUERY]:
										column[dataFieldProperties.QUERY] ??
										toQuery(column[dataFieldProperties.FIELD_NAME]),
									// should the column be shown by default
									[dataFieldProperties.SHOW]: column[dataFieldProperties.SHOW] ?? false,
									// self-descriptive, hopefully
									[dataFieldProperties.SORTABLE]: column[dataFieldProperties.SORTABLE],
								}
							: null;
					})
					.filter(Boolean)
			: // Provides baseline configs in case none are given from file/props
				extendedFields
					?.map((column) => {
						return ['nested', 'object'].includes(column[dataFieldProperties.DISPLAY_TYPE])
							? null
							: {
									[dataFieldProperties.FIELD_NAME]: column[dataFieldProperties.FIELD_NAME],
									// This field is how React-Table finds the data
									[dataFieldProperties.ACCESSOR]: column[dataFieldProperties.FIELD_NAME],
									[dataFieldProperties.CAN_CHANGE_SHOW]: true,
									// to be used as the column's "Header"
									[dataFieldProperties.DISPLAY_NAME]:
										column[dataFieldProperties.DISPLAY_NAME] ??
										'* ' + column[dataFieldProperties.FIELD_NAME],
									// used to format the values in the cell differently from their type set in the mapping
									[dataFieldProperties.DISPLAY_TYPE]: column[dataFieldProperties.DISPLAY_TYPE],
									// these likely are human readable values e.g. false means "no", true means "yes", etc.
									[dataFieldProperties.DISPLAY_VALUES]:
										column[dataFieldProperties.DISPLAY_VALUES] ?? {},
									// should the cell be understood as a list of items, or a mere string
									[dataFieldProperties.IS_ARRAY]: column[dataFieldProperties.IS_ARRAY],
									////////// TODO!!!!!!!!!! (field) JSON_PATH configs
									[dataFieldProperties.JSON_PATH]: `$.${column[dataFieldProperties.FIELD_NAME].replace(/\[\d*\]/g, '[*]')}`,
									////////// TODO!!!!!!!!!! (field) QUERY configs
									[dataFieldProperties.QUERY]: toQuery(column[dataFieldProperties.FIELD_NAME]),
									// should the column be shown by default
									[dataFieldProperties.SHOW]: true,
									// self-descriptive, hopefully
									[dataFieldProperties.SORTABLE]: false,
								};
					})
					.filter(Boolean)
					.slice(0, 10)
	) as ColumnConfigs[]; // TODO: make this "{} as Type" better

	return {
		...tableConfig,
		[tableProperties.COLUMNS]: columns,
	};
};

export const extendFacets = (facetsConfig: FacetsConfigs, extendedFields: ExtendedConfigs[]) => {
	const aggsFromConfig = facetsConfig?.[facetsProperties.AGGS];
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
								[dataFieldProperties.DISPLAY_NAME]:
									agg[dataFieldProperties.DISPLAY_NAME] ??
									extendedObj?.[dataFieldProperties.DISPLAY_NAME],
								// defines aggregation type (component used in facets)
								[dataFieldProperties.DISPLAY_TYPE]:
									agg[dataFieldProperties.DISPLAY_TYPE] ??
									extendedObj?.[dataFieldProperties.DISPLAY_TYPE],
								// TODO: determine what "isActive" does, vs "show"
								[dataFieldProperties.IS_ACTIVE]: agg[dataFieldProperties.IS_ACTIVE] || false,
								// should it be shown in the facets panel
								[dataFieldProperties.SHOW]: agg[dataFieldProperties.SHOW] || false,
							}
						: null;
				})
				.filter(Boolean)
		: extendedFields
				?.map((agg) => {
					return agg[dataFieldProperties.FIELD_NAME].includes('_id') ||
						['nested', 'object'].includes(agg[dataFieldProperties.DISPLAY_TYPE])
						? null
						: {
								[dataFieldProperties.FIELD_NAME]: agg[dataFieldProperties.FIELD_NAME].replaceAll(
									'.',
									'__',
								),
								// defines aggregation type (component used in facets)
								[dataFieldProperties.DISPLAY_TYPE]: agg[dataFieldProperties.DISPLAY_TYPE],
								// TODO: determine what "isActive" does, vs "show"
								[dataFieldProperties.IS_ACTIVE]: true,
								// should it be shown in the facets panel
								[dataFieldProperties.SHOW]: true,
							};
				})
				.filter(Boolean)
				.slice(0, 10);

	return {
		...facetsConfig,
		[facetsProperties.AGGS]: aggs,
	};
};

export const extendFields = (
	mappingFields: FieldFromMapping[],
	extendedFromFile: ExtendedConfigs[],
): ExtendedConfigs[] => {
	// TODO: `type` from ExtendedConfigs and FieldFromMapping do not match, they need to be mapped. Issue with `byte`.
	return mappingFields.map<ExtendedConfigs>(({ fieldName, type, ...rest }) => {
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

export const flattenMappingToFields = (mapping: Record<string, unknown> = {}): FieldFromMapping[] =>
	flattenMapping(mapping).map(({ field: fieldName = '', type = 'keyword', ...rest }) => ({
		fieldName,
		type,
		...rest,
	}));

// TODO: disabled because its purpose is unclear
// export default (mapping) => extendFields(flattenMapping(mapping));
