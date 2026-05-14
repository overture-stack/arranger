import type { SortingConfigs } from '@overture-stack/arranger-types/configs';
import { configRootProperties, tableProperties } from '@overture-stack/arranger-types/configs/constants';
import { merge } from 'lodash-es';

/**
 * Normalizes raw config file JSON for use by the search server.
 *
 * - Ensures every entry in `table.defaultSorting` has `desc` explicitly set,
 *   defaulting to `false` when the field is absent.
 */
const normalize = (fileDataJSON: any) => {
	if (fileDataJSON?.[configRootProperties.TABLE]?.[tableProperties.DEFAULT_SORTING]) {
		return merge(fileDataJSON, {
			[configRootProperties.TABLE]: {
				...fileDataJSON[configRootProperties.TABLE],
				[tableProperties.DEFAULT_SORTING]: fileDataJSON[configRootProperties.TABLE][
					tableProperties.DEFAULT_SORTING
				].map((sorting: SortingConfigs) => ({
					...sorting,
					desc: sorting.desc || false,
				})),
			},
		});
	}

	return fileDataJSON;
};

export default normalize;
