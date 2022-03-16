import { css, SerializedStyles } from '@emotion/react';
import cx from 'classnames';

import { useThemeContext } from '@/ThemeProvider';

/** Displays a chevron, commonly used for dropdown functionalities (buttons and trees)
 * @param {string} color override the default hue
 * @param {boolean} isTreeJoint makes the arrow point right when not pointing down
 * @param {number|string} line defines how thick the stroke should be (default: 4)
 * @param {boolean} pointUp tells the arrow to point up rather than down/right
 * @param {number|size} size specifies the magnitude of the arrow (default: 12)
 **/

const ArrowIcon = ({
  className,
  css: customCSS,
  fill,
  isTreeJoint,
  line,
  pointUp,
  size,
  transition,
}: {
  className?: string;
  css?: SerializedStyles;
  fill?: string;
  isTreeJoint?: boolean;
  line?: string | number;
  pointUp?: boolean;
  size?: string | number;
  transition?: string;
}) => {
  const {
    colors,
    components: {
      ArrowIcon: {
        className: themeClassName = '',
        css: themeCSS = '',
        fill: themeFill = colors?.grey?.[600],
        line: themeLine = 4,
        size: themeSize = 12,
        transition: themeTransition = 'all 0.2s',
        ...themeArrowIconProps
      } = {},
    } = {},
  } = useThemeContext();

  return (
    <svg
      className={cx('arrow', className, themeClassName)}
      css={css`
        flex: 0 auto;
        transform: ${isTreeJoint
          ? pointUp
            ? undefined
            : 'rotate(-90deg)'
          : pointUp
          ? 'scale(-1)'
          : undefined};
        transition: ${transition || themeTransition};
        ${themeCSS}
        ${customCSS}
      `}
      height={size || themeSize}
      fill="transparent"
      preserveAspectRatio="xMidYMin "
      stroke={fill || themeFill}
      strokeLinecap="round"
      strokeWidth={line || themeLine}
      viewBox="0 0 20 20"
      width={size || themeSize}
      {...themeArrowIconProps}
    >
      <path d="M1,6 L10,15 L19,6" />
    </svg>
  );
};

export default ArrowIcon;
