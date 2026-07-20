import { TooltipContainer } from '#components/TooltipContainer';

interface Bar {
	data: { value: number; label: string; suppressed?: boolean };
}

interface SunburstSegment {
	percentage: number;
	data: { dataValue: number; label: string; suppressed: false }; // suppression logic is not applied for this visualization type
}

interface NormalizedTooltipProps {
	value: number;
	label: string;
	suppressed?: boolean;
}

const normalizeTooltipProps = (tooltipData: Bar | SunburstSegment): NormalizedTooltipProps => {
	const data = 'percentage' in tooltipData ? tooltipData.data.dataValue : tooltipData.data.value;
	return { value: data, label: tooltipData.data.label, suppressed: tooltipData.data.suppressed };
};

export const Tooltip = (tooltipData: Bar | SunburstSegment) => {
	const { value, label, suppressed } = normalizeTooltipProps(tooltipData);
	return (
		<TooltipContainer>
			<div className="tooltip-wrapper">
				<div
					className="tooltip-label"
					data-label={label} // CSS selector hook for per-label styling; if building the selector dynamically in JS, escape with CSS.escape() first

				>{`${label}`}</div>
				<div className="tooltip-data">
					{suppressed ? (
						<span className="tooltip-data-suppressed">Too few</span>
					) : (
						<>
							<span className="tooltip-data-value">{value}</span>
							<span className="tooltip-data-source-wrapper">
								<span className="tooltip-data-source">: Record</span>
							</span>
							{/* TODO: Fix custom tooltip content so we are able to use pluralize; currently does not work if a custom label is applied with CSS */}
							<span className="tooltip-data-plural">{value > 1 ? 's' : ''}</span>
						</>
					)}
				</div>
			</div>
		</TooltipContainer>
	);
};
