import { TooltipContainer } from '#components/TooltipContainer';

interface Bar {
	data: { value: number; label: string };
}

interface SunburstSegment {
	datum: { data: { value: number; label: string } };
}

interface NormalizedTooltipProps {
	value: number;
	label: string;
}

const normalizeTooltipProps = (tooltipData: Bar | SunburstSegment): NormalizedTooltipProps => {
	const data = 'data' in tooltipData ? tooltipData.data : tooltipData.datum.data;
	return { value: data.value, label: data.label };
};

export const Tooltip = (tooltipData: Bar | SunburstSegment) => {
	const { value, label } = normalizeTooltipProps(tooltipData);

	return (
		<TooltipContainer>
			<div>
				<div>{`${label}`}</div>
				<div>{`${value}: Donors`}</div>
			</div>
		</TooltipContainer>
	);
};
