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

		renderTick: () => null, // tick labels eg. labels for bars
		legendOffset: -12,
	},

	margin: {
		top: 12,
		right: 24,
		left: 24,
		bottom: 56,
	},

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
