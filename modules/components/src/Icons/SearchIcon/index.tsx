import cx from 'classnames';
import Color from 'color';
import { FaSearch } from 'react-icons/fa';

import { useThemeContext } from '#ThemeContext/index.js';
import { emptyObj } from '#utils/noops.js';

import type Props from './types.js';

/** Displays a chevron, commonly used for dropdown functionalities (buttons and trees)
 * The following props (passed by the parent components) will be prioritised over theme customisations
 * @param {string} fill override the default hue
 * @param {boolean} isTreeJoint makes the Search point right when not pointing down
 * @param {boolean} pointUp tells the Search to point up rather than down/right
 * @param {number|size} size specifies the magnitude of the Search
 * @param {string} transition css animation speed
 **/

const SearchIcon = ({
	className: customClassName,
	css: customCSS,
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
			SearchIcon: {
				activeFill: themeActiveFill,
				className: themeClassName,
				css: themeCSS,
				disabled: themeDisabled,
				disabledFill: themeDisabledFill,
				fill: themeFill = colors?.grey?.[600],
				size: themeSize = 12,
				...themeSearchIconProps
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'SearchIcon' });

	const className = cx('search-icon', themeClassName, customClassName);
	const isActive = className.split(' ').includes('active');
	const isDisabled = customDisabled ?? themeDisabled;

	const defaultFill = customFill ?? themeFill;

	const color = isDisabled
		? (customDisabledFill ?? themeDisabledFill ?? Color(defaultFill).lighten(0.4))
		: isActive
			? (customActiveFill ?? themeActiveFill ?? Color(defaultFill).darken(0.5))
			: defaultFill;

	return (
		<FaSearch
			className={className}
			color={color}
			css={[themeCSS, customCSS]}
			size={customSize || themeSize}
			{...themeSearchIconProps}
		/>
	);
};

export default SearchIcon;
