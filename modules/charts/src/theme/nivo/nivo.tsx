import { cloneDeep, merge } from 'lodash';

import { ThemeResolver } from '#theme/arranger';
import { defaultNivoConfig } from './config';

/**
 * Transforms Arranger data and theme configuration into a Nivo bar chart configuration.
 * ArrangerTheme => NivoConfig
 *
 * @param params - Configuration object containing data and theme
 * @param params.data - Chart data
 * @param params.theme - Arranger theme
 *
 * @returns A complete Nivo bar chart configuration object resolved with Arranger Charts theme
 */
export const arrangerToNivoBarChart: ThemeResolver = ({ data, theme }) => {
	// setup colors to use color map
	const colors = (bar) => {
		return theme.colorMap.get(bar.data.key);
	};

	// use default tooltip
	const Tooltip = theme.components.Tooltip;
	const tooltip = ({ data }) => {
		const { doc_count, key } = data;
		// TODO: configurable
		const displayValue = key === '__missing__' ? 'No Data' : key;
		return (
			<Tooltip>
				<div>
					<div>{`${displayValue}`}</div>
					<div>{`${doc_count}: Donors`}</div>
				</div>
			</Tooltip>
		);
	};

	const nivoConfig = merge(cloneDeep(defaultNivoConfig), { ...theme, tooltip, colors });

	return nivoConfig;
};
