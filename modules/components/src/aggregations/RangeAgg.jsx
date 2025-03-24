import { css } from '@emotion/react';
import cx from 'classnames';
import convert from 'convert-units';
import { debounce, isEqual, isNil } from 'lodash';
import { Component } from 'react';
import InputRange from 'react-input-range'; // TODO: abandoned. use rc-slider instead
import 'react-input-range/lib/css/index.css';

import { replaceFieldSQON } from '#SQONViewer/utils.js';
import { withTheme } from '#ThemeContext/index.js';
import formatNumber from '#utils/formatNumber.js';
import { emptyObj } from '#utils/noops.js';

import AggsWrapper from './AggsWrapper.js';

const SUPPORTED_CONVERSIONS = {
	time: ['d', 'year'],
	digital: ['GB'],
};

const supportedConversionFromUnit = (unit) => (unit ? SUPPORTED_CONVERSIONS[convert().describe(unit).measure] : []);

const RangeLabel = ({
	background = 'none',
	children,
	className,
	borderRadius = 0,
	css: customCSS,
	fontWeight = 'inherit',
	isRight,
	isTop,
	margin,
	padding,
	...props
}) => (
	<div
		className={cx('RangeLabel', { bottom: !isTop, left: !isRight, right: isRight, top: isTop }, className)}
		css={[
			css`
				background: ${background};
				border-radius: ${borderRadius};
				color: ${isTop ? 'inherit' : '#666'};
				font-size: ${isTop ? 0.9 : 0.7}rem;
				font-weight: ${fontWeight};
				margin: ${margin};
				padding: ${padding};
				position: absolute;
				${isRight && `right: 0;`}
				top: ${isTop ? `-` : ``}1.2rem;
			`,
			customCSS,
		]}
		{...props}
	>
		{children}
	</div>
);

const getLabelId = (displayName) => {
	return `${displayName.split('(')[0].trim().toLowerCase().replace(/\s/g, '-')}__range-label`;
};

const calculateRangeStep = (min, max) => {
	const fractionRemainderFromMax = Number(formatNumber(max)) % 1;
	const fractionRemainderFromMin = Number(formatNumber(min)) % 1;
	const decimalPointsFromMax = fractionRemainderFromMax
		? `${fractionRemainderFromMax}`.replace('0.', '').length - 1
		: 0;
	const decimalPointsFromMin = fractionRemainderFromMin
		? `${fractionRemainderFromMin}`.replace('0.', '').length - 1
		: 0;

	return Math.max(decimalPointsFromMax, decimalPointsFromMin);
};

class RangeAgg extends Component {
	constructor(props) {
		super(props);
		const { sqonValues, stats: { max = 0, min = 0 } = emptyObj, unit } = props;

		const supportedConversions = supportedConversionFromUnit(unit);

		this.state = {
			currentValues: {
				max: sqonValues?.max || max,
				min: sqonValues?.min || min,
			},
			displayUnit: supportedConversions?.includes(unit)
				? unit // use unit selected in Admin UI as default, if available here
				: supportedConversions?.[0],
			supportedConversions,
		};
	}

	UNSAFE_componentWillReceiveProps(nextProps) {
		const { sqonValues: { max: sqonMax, min: sqonMin } = emptyObj, stats: { max: newMax, min: newMin } = emptyObj } =
			nextProps;
		const { stats: { max: oldMax, min: oldMin } = emptyObj } = this.props;
		const { currentValues: { max: selectedMax, min: selectedMin } = emptyObj } = this.state;

		const resetMax = isNil(sqonMax)
			? isNil(oldMax) || (newMax > oldMax && oldMax === selectedMax) || newMax !== selectedMax
			: newMax < selectedMax || newMin > selectedMax;
		const resetMin = isNil(sqonMin)
			? isNil(oldMin) || (newMin < oldMin && oldMin === selectedMin) || newMin !== selectedMin
			: newMin > selectedMin || newMax < selectedMin;

		const newState = {
			currentValues: {
				max: resetMax ? newMax : Math.min(sqonMax || selectedMax, newMax),
				min: resetMin ? newMin : Math.max(sqonMin || selectedMin, newMin),
			},
		};

		isEqual(this.state.currentValues, newState.currentValues) || this.setState(newState);
	}

	onChangeComplete = debounce(() => {
		const {
			displayName,
			fieldName,
			handleChange,
			stats: { max, min },
		} = this.props;
		let { currentValues, displayUnit } = this.state;

		return handleChange?.({
			field: {
				displayName,
				displayUnit,
				fieldName,
			},
			generateNextSQON: (sqon) =>
				replaceFieldSQON(
					fieldName,
					{
						op: 'and',
						content: [
							...(currentValues.min > min ? [{ op: '>=', content: { fieldName, value: currentValues.min } }] : []),
							...(currentValues.max < max ? [{ op: '<=', content: { fieldName, value: currentValues.max } }] : []),
						],
					},
					sqon,
				),
			max: currentValues.max,
			min: currentValues.min,
			value: currentValues,
		});
	}, 300);

	setNewUnit = (event) => this.setState({ displayUnit: event.target.value });

	setNewValue = ({ max: newMax, min: newMin }) => {
		const {
			stats: { max, min },
		} = this.props;

		console.log('min', min);
		console.log('newMin', newMin);

		// if (!(newMax === max && newMin === min)) {
		this.setState({
			currentValues: {
				max: newMax <= max ? newMax : max,
				min: newMin >= min ? newMin : min,
			},
		});
		// }
	};

	formatRangeLabel = (value, type) => {
		const { formatLabel, unit } = this.props;
		const { displayUnit } = this.state;

		return (
			formatLabel?.(value, type) ||
			formatNumber(unit && displayUnit && unit !== displayUnit ? convert(value).from(unit).to(displayUnit) : value)
		);
	};

	render() {
		const {
			collapsible = true,
			disabled,
			displayName = 'Unnamed Field',
			fieldName,
			rangeStep: rangeStepFromProps,
			stats: { max, min } = emptyObj,
			theme: {
				colors,
				components: {
					Aggregations: {
						RangeAgg: {
							// disableUnitSelection: themeDisableUnitSelection,
							InputRange: { css: themeInputRangeCSS } = emptyObj,
							NoDataContainer: {
								fontColor: themeNoDataFontColor = colors?.grey?.[600],
								fontSize: themeNoDataFontSize = '0.8em',
							} = emptyObj,
							RangeLabel: themeRangeLabelProps = emptyObj,
							RangeSlider: {
								background: themeRangeSliderBackground = colors?.common?.white,
								borderColor: themeRangeSliderBorderColor = colors?.grey?.[500],
								css: themeRangeSliderCSS,
								disabledBackground: themeRangeSliderDisabledBackground = colors?.grey?.[200],
								disabledBorderColor: themeRangeSliderDisabledBorderColor = colors?.grey?.[500],
							} = emptyObj,
							RangeTrack: {
								background: themeRangeTrackBackground = 'none',
								disabledBackground: themeRangeTrackDisabledBackground = colors?.grey?.[200],
								disabledInBackground: themeRangeTrackDisabledInBackground = colors?.grey?.[400],
								disabledOutBackground: themeRangeTrackDisabledOutBackground = colors?.grey?.[200],
								inBackground: themeRangeTrackInBackground = colors?.grey?.[600],
								outBackground: themeRangeTrackOutBackground = colors?.grey?.[200],
							} = emptyObj,
							RangeWrapper: { css: themeRangeWrapperCSS, ...RangeWrapperProps } = emptyObj,
							...themeRangeAggProps
						} = emptyObj,
					} = emptyObj,
				} = emptyObj,
			} = emptyObj,
			type,
			WrapperComponent,
		} = this.props;
		const { currentValues, displayUnit, supportedConversions } = this.state;

		const hasData = [!isNil(min), !isNil(max)].every(Boolean);

		const dataFields = {
			'data-available': hasData,
			...(fieldName && { 'data-fieldname': fieldName }),
			...(type && { 'data-type': type }),
		};

		const decimals = calculateRangeStep(min, max);
		const calculatedStep = decimals ? parseFloat(`0.${String(1).padStart(decimals, '0')}`) : 1;

		const rangeStep = rangeStepFromProps || calculatedStep;
		// console.log('rangeStep', rangeStep);

		const minIsMax = min === max;
		const unusable = disabled || min + rangeStep === max || minIsMax;

		// TODO: implement unit selection disabling per fieldname.
		// const enableUnitSelection = !themeDisableUnitSelection;

		return (
			<AggsWrapper
				dataFields={dataFields}
				displayName={`${displayName}${displayUnit ? ` (${convert().describe(displayUnit).plural})` : ``}`}
				{...{ WrapperComponent, collapsible }}
				theme={themeRangeAggProps}
			>
				{hasData ? (
					<div
						className="range-wrapper"
						css={[
							themeRangeWrapperCSS,
							css`
								align-items: center;
								display: flex;
								flex-direction: column;
								width: 100%;
							`,
						]}
						{...RangeWrapperProps}
					>
						{supportedConversions.length > 1 && (
							<div
								className="unit-wrapper"
								css={css`
									text-align: center;
									margin-top: 4px;
								`}
							>
								{supportedConversions
									.map((x) => convert().describe(x))
									.map((x) => ({ ...x, isActive: x.abbr === displayUnit }))
									.map(({ abbr, plural, isActive }) => (
										<label
											css={css`
												margin: 0 5px;
												font-family: inherit;
												color: inherit;
												border-bottom: none;
											`}
											htmlFor={abbr}
											key={abbr}
										>
											<input checked={isActive} id={abbr} onChange={this.setNewUnit} type="radio" value={abbr} />
											{plural}
										</label>
									))}
							</div>
						)}

						<div
							className={cx('input-range-wrapper', { disabled: unusable })}
							css={css`
								margin: 1.5rem 0;
								position: relative;
								font-size: 0.8rem;
								width: 90%;

								/** InputRange doesn't allow customisation through props
									* The following classes, and theme overrides are the
									* only way available for now. May implement our own slider.
									*/
								.input-range {
									background: ${unusable ? themeRangeTrackDisabledBackground : themeRangeTrackBackground};

									.input-range__label {
										display: none;
									}

									.input-range__slider {
										background: ${unusable ? themeRangeSliderDisabledBackground : themeRangeSliderBackground};
										border-color: ${unusable ? themeRangeSliderDisabledBorderColor : themeRangeSliderBorderColor};
										padding: 0;

										${themeRangeSliderCSS}
									}

									.input-range__track--background {
										background: ${unusable ? themeRangeTrackDisabledOutBackground : themeRangeTrackOutBackground};

										.input-range__track--active {
											background: ${unusable ? themeRangeTrackDisabledInBackground : themeRangeTrackInBackground};
										}
									}

									&.input-range--disabled {
										.input-range__slider,
										.input-range__track {
											cursor: default;
										}
									}

									${themeInputRangeCSS}
								}
							`}
						>
							<RangeLabel isTop {...themeRangeLabelProps}>
								{this.formatRangeLabel(currentValues.min)}
							</RangeLabel>

							{!minIsMax && (
								<RangeLabel isTop isRight {...themeRangeLabelProps}>
									{this.formatRangeLabel(currentValues.max)}
								</RangeLabel>
							)}

							<InputRange
								allowSameValues={true}
								ariaLabelledby={getLabelId(displayName)}
								className={cx({ disabled: unusable })}
								disabled={unusable}
								draggableTrack
								formatLabel={this.formatRangeLabel}
								minValue={min}
								maxValue={max}
								onChange={this.setNewValue}
								onChangeComplete={this.onChangeComplete}
								step={rangeStep}
								value={currentValues}
							/>

							<RangeLabel {...themeRangeLabelProps}>{this.formatRangeLabel(min)}</RangeLabel>

							{!minIsMax && (
								<RangeLabel isRight {...themeRangeLabelProps}>
									{this.formatRangeLabel(max)}
								</RangeLabel>
							)}

							<span
								id={getLabelId(displayName)}
								css={css`
									position: absolute;
									height: 0;
									width: 0;
									top: -9999px;
									left: -9999px;
								`}
							>
								{`Set ${displayName}`}
							</span>
						</div>
					</div>
				) : (
					<span
						className="no-data"
						css={css`
							color: ${themeNoDataFontColor};
							display: block;
							font-size: ${themeNoDataFontSize};
						`}
					>
						No data available
					</span>
				)}
			</AggsWrapper>
		);
	}
}

export default withTheme(RangeAgg);
