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
				<div>
					<span>{value}</span>
					<span className="tooltip-data-source-wrapper">
						<span className="tooltip-data-source">: Donor</span>
					</span>
					<span>{value > 1 ? 's' : ''}</span>
				</div>
			</div>
		</TooltipContainer>
	);
};
