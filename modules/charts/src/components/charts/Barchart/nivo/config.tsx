import { Tooltip } from '#components/Provider/Tooltip';
import { merge } from 'lodash';

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
export const arrangerToNivoBarChart = ({ theme, colorMap, onClick }) => {
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

	const axes = {
		// axes
		axisTop: null,
		axisRight: null,
		axisBottom: {
			legend: 'Axis-Bottom-Legend',
			legendPosition: 'middle',
			tickValues: 4,
			legendOffset: 34,
		},

		axisLeft: {
			legend: 'Axis-Left-Legend',
			legendPosition: 'middle',
			legendOffset: -66,

			// tick
			tickSize: 11,
			tickPadding: -8,
			truncateTickAt: 7,

			// TODO: custom render, keep as example for now
			// custom render because legend offset keeps initial space before offsetting
			// renderTick: (tick) => {
			// 	const value = tick.value;
			// 	const content = value === '__missing__' ? 'No Data' : value;
			// 	return (
			// 		<g
			// 			className="tickValue"
			// 			transform={`translate(${tick.x - 2},${tick.y + 4})`}
			// 		>
			// 			<text
			// 				textAnchor="end"
			// 				css={css`
			// 					font-family: 'Work Sans';
			// 					font-size: 11px;
			// 					font-style: normal;
			// 					font-weight: 400;
			// 				`}
			// 			>
			// 				{truncateString(content, 7)}
			// 			</text>
			// 		</g>
			// 	);
			// }, // tick labels eg. labels for bars
		},
	};

	const nivoConfig = merge(
		{
			onClick,
			theme: {
				text: {
					fontFamily: 'Work Sans,sans-serif',
				},
				axis: {
					legend: {
						text: { fontSize: 10, color: '#525767' },
					},
					ticks: {
						text: {
							fontSize: 11,
							color: 'black',
						},
						line: {
							strokeWidth: 0,
						},
					},
					domain: {
						line: {
							stroke: '#dcdde1',
							strokeWidth: 1,
						},
					},
				},
			},

			layout: 'horizontal',
			padding: 0.3,
			valueScale: { type: 'linear' },
			borderColor: { from: 'color', modifiers: [['darker', 1.6]] },

			animate: false,

			enableGridX: false,
			enableGridY: false,
			enableLabel: false,

			...axes,

			margin: {
				top: 12,
				right: 24,
				left: 24 + 53, // + tick value
				bottom: 56,
			},

			/**
			 * match arranger schema
			 */
			indexBy: 'displayKey',
			keys: ['docCount'],
			tooltip,
			colors,
			onMouseEnter: (_, e) => {
				e.target.style.cursor = 'pointer';
			},
		},
		theme,
	);

	return nivoConfig;
};
