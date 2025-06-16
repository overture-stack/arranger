import { createChartColors } from '#colors';
import { cloneDeep, merge } from 'lodash';
import { ThemeResolver } from './arranger';

export const arrangerToNivoBarChart: ThemeResolver = ({ source, data, theme }) => {
	const colorHash = createChartColors({ colors: theme.colors });
	colorHash.createColorMap(data);

	return merge(cloneDeep(source), theme, {
		// use ArrangerCharts color resolution
		colors: (bar) => {
			const key = bar.data.key;
			const resolvedColor = colorHash.resolveColor({ key });
			// TODO: why 8 billion renders?
			//	console.log('color override', bar, resolvedColor);
			return resolvedColor;
		},
	});

	return merge(cloneDeep(source), theme);
};
