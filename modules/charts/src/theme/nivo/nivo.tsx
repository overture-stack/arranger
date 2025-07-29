import { cloneDeep, merge } from 'lodash';

import { Tooltip } from '#components/Provider/Tooltip';
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
export const arrangerToNivoBarChart = ({ theme, colorMap }) => {
	// setup colors to use color map
	const colors = (bar) => {
		const color = colorMap.get(bar.data.key);
		return color || 'black';
	};

	/* ================= *
	 * Tooltip						*
	 * ================= */
	const tooltip = ({ data }) => {
		const { doc_count, key } = data;
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

	const nivoConfig = merge(cloneDeep(defaultNivoConfig), {
		...theme,
		tooltip,
		colors,
		animate: false,
		onMouseEnter: (_, e) => {
			e.target.style.cursor = 'pointer';
		},
	});

	return nivoConfig;
};
