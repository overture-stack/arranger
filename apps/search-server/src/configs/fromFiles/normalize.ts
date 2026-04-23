import type { SortingConfigs } from '@overture-stack/arranger-types/configs';
import { configRootProperties, tableProperties } from '@overture-stack/arranger-types/configs/constants';
import { merge } from 'lodash-es';

// TODO write JSDOCs to explain the purpose here is provide initial defaults when only given partial configs, e.g. table sorting missing the order desc
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
