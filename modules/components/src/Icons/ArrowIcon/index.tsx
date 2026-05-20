import { css } from '@emotion/react';
import cx from 'classnames';
import Color from 'color';

import { useThemeContext } from '#ThemeContext/index.js';
import { emptyObj } from '#utils/noops.js';

import type Props from './types.js';

/** Displays a chevron, commonly used for dropdown functionalities (buttons and trees)
 * The following props (passed by the parent components) will be prioritised over theme customisations
 * @param {string} fill override the default hue
 * @param {boolean} isTreeJoint makes the arrow point right when not pointing down
 * @param {boolean} pointUp tells the arrow to point up rather than down/right
 * @param {number|size} size specifies the magnitude of the arrow
 * @param {string} transition css animation speed
 **/

const ArrowIcon = ({
	className: customClassName,
	css: customCSS,
	disabled: customDisabled,
	isTreeJoint,
	pointUp,
	theme: {
		activeFill: customActiveFill,
		disabledFill: customDisabledFill,
		fill: customFill,
		size: customSize,
		transition: customTransition,
	} = emptyObj,
}: Props) => {
	const {
		colors,
		components: {
			ArrowIcon: {
				activeFill: themeActiveFill,
				className: themeClassName,
				css: themeCSS,
				disabled: themeDisabled,
				disabledFill: themeDisabledFill,
				fill: themeFill = colors?.grey?.[600],
				size: themeSize = 12,
				transition: themeTransition = 'all 0.2s',
				...themeArrowIconProps
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'ArrowIcon' });

	const className = cx('arrow-icon', themeClassName, customClassName);
	const isActive = className.split(' ').includes('active');
	const isDisabled = customDisabled ?? themeDisabled;

	const defaultFill = customFill ?? themeFill;

	const color = isDisabled
		? (customDisabledFill ?? themeDisabledFill ?? Color(defaultFill).lighten(0.4))
		: isActive
			? (customActiveFill ?? themeActiveFill ?? Color(defaultFill).darken(0.5))
			: defaultFill;

	return (
		<svg
			className={className}
			css={[
				themeCSS,
				css`
					flex: 0 0 auto;
					transform: ${isTreeJoint
						? pointUp
							? undefined
							: 'rotate(-90deg)'
						: pointUp
							? 'scale(-1)'
							: undefined};
					transition: ${customTransition || themeTransition};
				`,
				customCSS,
			]}
			height={customSize || themeSize}
			preserveAspectRatio="xMidYMin "
			viewBox="0 0 12 12"
			width={customSize || themeSize}
			{...themeArrowIconProps}
		>
			<path
				fill={color}
				d="M9.952 3.342c.468-.456 1.228-.456 1.697 0 .234.228.351.526.351.825 0
      .298-.117.597-.351.825l-4.8 4.666c-.469.456-1.23.456-1.697 0l-4.8-4.666c-.47-.456-.47-1.194
      0-1.65.468-.456 1.228-.456 1.696 0L6 7.184l3.952-3.842z"
			/>
		</svg>
	);
};

export default ArrowIcon;
