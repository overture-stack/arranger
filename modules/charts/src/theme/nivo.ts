import { cloneDeep, merge } from 'lodash';
import { ThemeResolver } from './arranger';

export const arrangerToNivo: ThemeResolver = ({ theme, source }) => {
	return merge(cloneDeep(source), theme, {
		// use ArrangerCharts color resolution
		colors: (bar) => {
			const key = bar.data.key;
			const resolvedColor = theme.resolveColor({ bucketKey: key });
			console.log('color override', bar, resolvedColor);
			return resolvedColor;
		},
	});
};
