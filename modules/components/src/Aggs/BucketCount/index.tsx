import { css } from '@emotion/react';
import cx from 'classnames';

import { useThemeContext } from '@/ThemeContext';

import Props from './types';

const BucketCount = ({
  className,
  children,
  css: customCSS,
  theme: {
    activeBackground: customActiveBackground,
    activeBorderColor: customActiveBorderColor,
    activeFontColor: customActiveFontColor,
    activeFontSize: customActiveFontSize,
    background,
    borderColor,
    borderRadius,
    className: customClassName,
    css: parentCSS,
    disabledBackground: customDisabledBackground,
    disabledBorderColor: customDisabledBorderColor,
    disabledFontColor: customDisabledFontColor,
    disabledFontSize: customDisabledFontSize,
    fontColor,
    fontSize,
  } = {},
  ...props
}: Props) => {
  const {
    colors,
    components: {
      Aggregations: {
        BucketCount: {
          activeBackground: themeActiveBackground = undefined,
          activeBorderColor: themeActiveBorderColor = undefined,
          activeFontColor: themeActiveFontColor = undefined,
          activeFontSize: themeActiveFontSize = undefined,
          background: themeBackground = colors?.grey?.[200],
          borderColor: themeBorderColor = undefined,
          borderRadius: themeBorderRadius = '0.2rem',
          className: themeClassName = undefined,
          css: themeCSS = {},
          disabledBackground: themeDisabledBackground = colors?.common?.white,
          disabledBorderColor: themeDisabledBorderColor = undefined,
          disabledFontColor: themeDisabledFontColor = colors?.grey?.[700],
          disabledFontSize: themeDisabledFontSize = undefined,
          fontColor: themeFontColor = colors?.grey?.[900],
          fontSize: themeFontSize = '0.7rem',
        } = {},
      } = {},
    } = {},
  } = useThemeContext({ callerName: 'BucketCount' });

  const hasBorder =
    borderColor ||
    themeBorderColor ||
    customActiveBorderColor ||
    themeActiveBorderColor ||
    customDisabledBorderColor ||
    themeDisabledBorderColor;

  return (
    <span
      className={cx(`bucket-count`, className, customClassName, themeClassName)}
      css={[
        css`
          background: ${background || themeBackground};
          border: ${hasBorder && '0.1rem solid transparent'};
          border-color: ${borderColor || themeBorderColor};
          border-radius: ${borderRadius || themeBorderRadius};
          color: ${fontColor || themeFontColor};
          display: inline-block;
          font-size: ${fontSize || themeFontSize};
          height: fit-content;
          padding: 0 0.2rem;

          &.active {
            background: ${customActiveBackground || themeActiveBackground};
            border-color: ${customActiveBorderColor || themeActiveBorderColor};
            color: ${customActiveFontColor || themeActiveFontColor};
            font-size: ${customActiveFontSize || themeActiveFontSize};
          }

          &.disabled {
            background: ${customDisabledBackground || themeDisabledBackground};
            border-color: ${customDisabledBorderColor || themeDisabledBorderColor};
            color: ${customDisabledFontColor || themeDisabledFontColor};
            font-size: ${customDisabledFontSize || themeDisabledFontSize};
          }
        `,
        themeCSS,
        parentCSS,
        customCSS,
      ]}
      {...props}
    >
      {children}
    </span>
  );
};

export default BucketCount;
