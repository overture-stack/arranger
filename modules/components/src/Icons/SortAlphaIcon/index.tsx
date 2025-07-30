import cx from 'classnames';
import Color from 'color';
import { FaSortAlphaDown, FaSortAlphaDownAlt } from 'react-icons/fa';

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

const SortAlphaIcon = ({
	className: customClassName,
	css: customCSS,
	descending: customDescending,
	disabled: customDisabled,
	theme: {
		activeFill: customActiveFill,
		disabledFill: customDisabledFill,
		fill: customFill,
		size: customSize,
	} = emptyObj,
}: Props) => {
	const {
		colors,
		components: {
			SortAlphaIcon: {
				activeFill: themeActiveFill,
				className: themeClassName,
				css: themeCSS,
				descending: themeDescending,
				disabled: themeDisabled,
				disabledFill: themeDisabledFill,
				fill: themeFill = colors?.grey?.[600],
				size: themeSize = 12,
				...themeArrowIconProps
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'SortAlphaIcon' });

	const className = cx('alphabetic-sorting', themeClassName, customClassName);
	const isActive = className.split(' ').includes('active');
	const isDisabled = customDisabled ?? themeDisabled;

	const defaultFill = customFill ?? themeFill;

	const color = isDisabled
		? (customDisabledFill ?? themeDisabledFill ?? Color(defaultFill).lighten(0.4))
		: isActive
			? (customActiveFill ?? themeActiveFill ?? Color(defaultFill).darken(0.5))
			: defaultFill;

	const isDescending = customDescending ?? themeDescending;
	const Icon = isDescending ? FaSortAlphaDownAlt : FaSortAlphaDown;

	return (
		<Icon
			className={className}
			color={color}
			css={[themeCSS, customCSS]}
			size={customSize || themeSize}
			{...themeArrowIconProps}
		/>
	);
};

export default SortAlphaIcon;
