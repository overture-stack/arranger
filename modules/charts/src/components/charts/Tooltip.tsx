import { TooltipContainer } from '#components/TooltipContainer';

interface Bar {
	data: { value: number; label: string };
}

interface SunburstSegment {
	percentage: number;
	data: { dataValue: number; label: string };
}

interface NormalizedTooltipProps {
	value: number;
	label: string;
}

const normalizeTooltipProps = (tooltipData: Bar | SunburstSegment): NormalizedTooltipProps => {
	const data = 'percentage' in tooltipData ? tooltipData.data.dataValue : tooltipData.data.value;
	return { value: data, label: tooltipData.data.label };
};

export const Tooltip = (tooltipData: Bar | SunburstSegment) => {
	const { value, label } = normalizeTooltipProps(tooltipData);

	return (
		<TooltipContainer>
			<div>
				<div>{`${label}`}</div>
				<div>{`${value}: Donor${value > 1 ? 's' : ''}`}</div>
			</div>
		</TooltipContainer>
	);
};
