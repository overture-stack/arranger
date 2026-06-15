import { css } from '@emotion/react';
import { ResponsiveBar } from '@nivo/bar';
import { maxBy, omit } from 'lodash';
import { useMemo } from 'react';

import { useColorMap } from '#hooks/useColorMap';
import { BarChartProps, SupportedNivo } from './BarChart';
import { arrangerToNivoBarChart } from './nivo/config';

const SUPPRESSION_INCREMENT_VALUE = 0.2;

interface BarChartViewProps {
	data: any;
	handlers: BarChartProps['handlers'];
	theme: BarChartProps['theme'];
	maxBars: BarChartProps['maxBars'];
	colorMapRef: React.RefObject<Map<string, string>>;
	fieldName: string;
}

type BarData = {
	key: string;
	value: number;
	label: string;
};

/**
 * Creates a chart color map for consistent colors across charts
 **/
const colorMapResolver = ({ chartData, savedMap, colors }) => {
	// intialize to session stored color map if exists
	const colorMap = new Map<string, string>(savedMap);

	// used for "color wraparound" modulo
	// initialize to size of current items to avoid same colour hex collisions
	let colorIndex = colorMap.size;

	chartData.forEach(({ key }) => {
		const assignedColor = colors[colorIndex++ % colors.length];
		if (!colorMap.has(key)) {
			colorMap.set(key, assignedColor);
		}
	});

	return colorMap;
};

/**
 * Creates a numeric array of even multiples.
 *
 * @remarks The start value is expected to be higher than the stop value.
 *
 * @param start starting value of array
 * @param stop final value of the array
 * @param step value for the multiple of each element in the array
 * @returns an array of numbers
 */
const range = (start: number, stop: number, step: number): number[] => {
	if (start >= stop || stop - start < step) {
		return [start, stop];
	}
	return Array.from({ length: Math.ceil((stop - start) / step) }, (_, i) => start + i * step);
};

type CustomAxisBottomTheme = {
	axisBottom?: { tickValues?: number[] };
	maxValue?: number;
	legend?: string;
};
type AxisBottomTheme = SupportedNivo['axisBottom'] & { customTickValueSize?: number };

/**
 * Creates a custom array of tickValues for the bottom axis of a Bar Chart, if customTicks.size is provided. These values
 * will be multiples of the provided size. Includes a maxValue to pass to the Chart props to ensure a final x-axis value is provided,
 * if the highest value in the chart data does not match the highest value in the tickValues array.
 * Returns a CustomAxisBottomTheme object.
 *
 * If customTicks.size is not provided, returns the original object provided to the axisBottomTheme argument.
 *
 * @param data BarData
 * @param axisBottomTheme arguments provide to the theme.axisBottom prop of the Bar Chart
 * @returns CustomAxisBottomTheme
 */
const calculateCustomTickValues = (data: BarData[], axisBottomTheme: AxisBottomTheme): CustomAxisBottomTheme => {
	if (axisBottomTheme.customTickValueSize) {
		const { customTickValueSize } = axisBottomTheme;
		const maxValue = maxBy(data, 'value')?.value || customTickValueSize;
		const maxMultipleValue = Math.ceil(maxValue / customTickValueSize) * customTickValueSize;

		const tickValues: number[] = range(0, maxValue + customTickValueSize, customTickValueSize);

		return {
			maxValue: maxMultipleValue,
			axisBottom: {
				...omit(axisBottomTheme, 'customTickValueSize'),
				tickValues,
			},
		};
	}

	return {
		legend: axisBottomTheme.legend,
	};
};

/**
 * Renders a responsive Nivo bar chart with Arranger theme integration.
 * Handles click interactions and applies consistent styling.
 *
 * @param props - Bar chart view configuration
 * @param props.data - Transformed chart data in Nivo format
 * @param props.handlers -
 * @param props.theme - Arranger theme configuration
 * @param props.maxBars - Max number of bars to show
 * @returns JSX element with responsive bar chart
 */
export const BarChartView = ({ data, handlers, theme, maxBars, colorMapRef, fieldName }: BarChartViewProps) => {
	// persistent color map
	// ensure to create from full data available before slicing visible data
	const { colorMap } = useColorMap({ fieldName, colorMapRef, chartData: data, resolver: colorMapResolver });
	const customTickValues: CustomAxisBottomTheme | {} = calculateCustomTickValues(data, theme.axisBottom);

	/**
	 * TODO: improve "chart view" config/interface
	 * right now it's a bit of a catch all config function
	 * handlers currently only support onClick
	 */
	const resolvedTheme = useMemo(
		() =>
			arrangerToNivoBarChart({ theme: { ...theme, ...customTickValues }, colorMap, onClick: handlers?.onClick }),
		[theme, colorMap, handlers],
	);

	// Values that are 0 will be incremented by the SUPPRESSION_INCREMENT_VALUE, in order for the Bar Chart to render a bar
	// with a Tooltip, and will add custom text to the Tooltip.
	// Any non-zero values will be rendered normally.
	const dataWithSuppressedValues = data.map((d: BarData) => {
		const suppressed = d.value === 0;
		return { ...d, suppressed, value: suppressed ? d.value + SUPPRESSION_INCREMENT_VALUE : d.value };
	});

	// 1) custom sort order or ascending (from axis)
	// 2) limit by maxRows
	// 3) reverse order for display
	const barData: BarData[] = theme.sortByKey
		? theme.sortByKey
				.map((label) => dataWithSuppressedValues.find((bar: BarData) => bar.key === label))
				.filter(Boolean)
				.slice(0, maxBars)
		: dataWithSuppressedValues
				.toSorted((a: BarData, b: BarData) => b.value - a.value)
				.slice(0, maxBars)
				.reverse();

	return (
		<div css={css({ width: '100%', height: '100%' })}>
			<ResponsiveBar
				ariaLabel={`${fieldName}-bar-chart`}
				data={barData}
				{...resolvedTheme}
			/>
		</div>
	);
};
