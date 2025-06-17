import { cloneDeep, merge } from 'lodash';

import { ThemeResolver } from '#theme/arranger';
import { defaultNivoConfig } from './config';

/**
 *
 * @param param0
 * @returns
 */
// this point should just be ArrangerTheme => NivoConfig object merging, no additional state etc
export const arrangerToNivoBarChart: ThemeResolver = ({ data, theme }) => {
	const colors = (bar) => {
		return theme.colorMap.get(bar.data.key);
	};

	const nivoConfig = merge(cloneDeep(defaultNivoConfig), { ...theme, colors });

	return nivoConfig;
};
