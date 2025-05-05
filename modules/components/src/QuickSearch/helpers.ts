import { isEmpty, uniq } from 'lodash-es';

import { useDataContext } from '#DataContext/index.js';
import type { ExtendedMappingInterface } from '#DataContext/types.js';

import { decorateFieldWithColumnsState } from './QuickSearchQuery.js';
import type { SearchFieldNames, UseSearchFieldsProps } from './types.js';

/** Gathers the fieldnames relevant to the specific QuickSearch instance */
export const getQuickSearchFieldsById = ({
	instanceId = 'all',
	fieldNames,
	level = 0,
}: {
	instanceId?: string;
	fieldNames: SearchFieldNames;
	level?: number;
}): string[] => {
	const newLevel = level + 1;

	// fieldNames will either be in a simple array of strings (field names)
	// or we'll have dig deeper recursively, looking for it
	if (Array.isArray(fieldNames)) {
		const allStrings = fieldNames.every((field) => typeof field === 'string');

		return allStrings
			? fieldNames // assumes the fieldNames array was expected
			: fieldNames.reduce((acc, fieldName): string[] => {
					return [...acc, ...getQuickSearchFieldsById({ instanceId, fieldNames: fieldName, level: newLevel })];
				}, [] as string[]);
	}

	// fieldNames is an disctionary of shape {[instanceId | 'all']: string[] | string}
	// and so, we'll use its values only if they're relevant to this instance.
	if (typeof fieldNames === 'object') {
		return getQuickSearchFieldsById({
			instanceId,
			fieldNames: fieldNames[instanceId],
			level: newLevel,
		});
	}

	// and finally, fieldNames could just be a single field name
	return [
		// the "fieldNames" should be a "fieldName" string at this point
		typeof fieldNames === 'string' &&
			fieldNames.length > 0 &&
			// and either it's supposed to apply to all QuickSearch components
			((instanceId === 'all' && level === 0) ||
				// or it was meant to only apply to this one
				(instanceId !== 'all' && level > 0)) &&
			// if so, we can use the "fieldNames"
			fieldNames,
	].filter(Boolean) as string[]; // Issue since 2017
	// https://github.com/microsoft/TypeScript/issues/16655
	// .filter returns a new array, but doesn't update its type
};

// export const generateFieldjsonPath = ({ extendedMapping, fieldName }) => {
// TODO: le do it
// };

const nestedField = ({
	field,
	nestedFields,
}: {
	field: ExtendedMappingInterface;
	nestedFields: ExtendedMappingInterface[];
}) => nestedFields?.find((x) => x.fieldName === field.fieldName?.split('.').slice(0, -1).join('.'));

export const useSearchFields = ({
	allowlist, // TODO: unused, but may come in handy
	disabled,
	displayFieldName,
	fieldNames,
	instanceId,
}: UseSearchFieldsProps) => {
	const { extendedMapping, documentType, tableConfigs } = useDataContext();
	// TODO: improve this and validate the given fieldNames exist in the mapping
	const searchableFieldNames = fieldNames || displayFieldName;

	if (searchableFieldNames) {
		const displayField = decorateFieldWithColumnsState({
			tableConfigs,
			fieldName:
				displayFieldName || (Array.isArray(searchableFieldNames) ? searchableFieldNames[0] : searchableFieldNames),
		});

		const fieldName = displayField?.displayName || displayField?.fieldName;
		const headerTitle = fieldName && `Search by ${fieldName}`;

		const instanceFieldNames = getQuickSearchFieldsById({
			instanceId,
			fieldNames: searchableFieldNames,
		});

		const nestedFields = extendedMapping.filter((field) => field.type === 'nested');

		const searchFields =
			Array.isArray(instanceFieldNames) && instanceFieldNames.length
				? instanceFieldNames
						.map((fieldName) => {
							const field = extendedMapping.find((field) => field.fieldName === fieldName);

							return field
								? decorateFieldWithColumnsState({
										fieldName: field.fieldName,
										tableConfigs,
									})
								: null;
						})
						.filter(Boolean)
				: extendedMapping
						?.filter((x) => x.quickSearchEnabled)
						?.filter((x) => {
							const {
								fieldName: parentField = '',
							} = //defaults to "" because a root field's parent would evaluate to such
								nestedField({
									nestedFields,
									field: x,
								}) || {};
							return allowlist ? allowlist.includes?.(parentField) : true;
						})
						?.map((field) =>
							decorateFieldWithColumnsState({
								fieldName: field.fieldName,
								tableConfigs,
							}),
						)
						?.map((x) => ({
							...x,
							entityName: nestedField({ field: x, nestedFields })?.fieldName || documentType,
						})) || [];

		const quickSearchEntities = uniq(searchFields);

		const lookup = // entityIndexLookup ||
			quickSearchEntities?.reduce(
				(acc, field, index) => ({
					...acc,
					[field.entityName]: index,
				}),
				{},
			);

		return {
			searchDisabled: disabled || isEmpty(displayField) || searchFields?.length === 0,
			displayField,
			lookup,
			headerTitle,
			nestedFields,
			searchFields,
		};
	}

	return { headerTitle: 'Search disabled' };
};
