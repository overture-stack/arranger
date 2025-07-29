export const defaultNivoConfig = {
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

		format: (tick) => {
			// happens post truncation
			return tick === '__missi...' ? 'No Data' : tick;
		},

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

	/**
	 * css transforms, not html props
	 * horizontal bar chart
	 * offset x axis
	 * align the axes label
	 * offset margins and paddings also because tick value is nested in chart
	 */

	margin: {
		top: 12,
		right: 24,
		left: 24 + 53, // + tick value
		bottom: 56,
	},

	/**
	 * match arranger schema
	 */
	indexBy: 'key',
	keys: ['doc_count'],

	// TODO: use as an example of Arranger.Chart to 3rdPartyLib.Config
	colors: (d) => {
		return '';
	},
	colorBy: 'id',

	onClick: (data) => {
		console.log('data', data);
	},
};
