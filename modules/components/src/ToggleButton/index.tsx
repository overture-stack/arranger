import { css } from '@emotion/react';
import cx from 'classnames';

import Button from '@/Button';
import { useThemeContext } from '@/ThemeContext';
import noopFn from '@/utils/noopFns';

import Props, { ToggleButtonThemeProps } from './types';

const ToggleButton = ({
  className,
  onChange = noopFn,
  options = [],
  value: selectedValue = '',
  theme: {
    activeBackground: customActiveBackground,
    activeBorderColor: customActiveBorderColor,
    activeFontColor: customActiveFontColor,
    activeFontSize: customActiveFontSize,
    background: customBackground,
    borderRadius: customBorderRadius,
    borderColor: customBorderColor,
    className: customClassName,
    css: customCSS,
    disabledBackground: customDisabledBackground,
    disabledBorderColor: customDisabledBorderColor,
    disabledFontColor: customDisabledFontColor,
    disabledFontSize: customDisabledFontSize,
    fontColor: customFontColor,
    fontSize: customFontSize,
    OptionCSS: customOptionCSS,
  } = {} as ToggleButtonThemeProps,
}: Props) => {
  const {
    colors,
    components: {
      Aggregations: {
        ToggleButton: {
          activeBackground: themeActiveBackground = colors?.grey?.[200],
          activeBorderColor: themeActiveBorderColor = undefined,
          activeFontColor: themeActiveFontColor = undefined,
          activeFontSize: themeActiveFontSize = undefined,
          background: themeBackground = colors?.grey?.[50],
          borderRadius: themeBorderRadius = '0.9rem 50%',
          borderColor: themeBorderColor = colors?.grey?.[600],
          className: themeClassName = '',
          css: themeCSS = undefined,
          disabledBackground: themeDisabledBackground = colors?.grey?.[200],
          disabledBorderColor: themeDisabledBorderColor = undefined,
          disabledFontColor: themeDisabledFontColor = colors?.grey?.[700],
          disabledFontSize: themeDisabledFontSize = undefined,
          fontColor: themeFontColor = undefined,
          fontSize: themeFontSize = '0.9rem',
          OptionCSS: themeOptionCSS = undefined,
        } = {},
      } = {},
    } = {},
  } = useThemeContext({ callerName: 'ToggleButton' });

  return (
    <div
      className={cx('toggle-button', className, customClassName, themeClassName)}
      css={[
        css`
          display: flex;
          flex-direction: row;
          justify-content: center;
          height: calc(${themeFontSize} * 2);
        `,
        themeCSS,
        customCSS,
      ]}
    >
      {options.map(({ disabled = false, title, value = '' }, index) => {
        const active = selectedValue === value;
        const clickHandler = () => (disabled ? null : onChange({ value }));

        return (
          <Button
            className={cx('toggle-button-option', {
              active,
              disabled,
            })}
            css={[
              css`
                background: ${customBackground || themeBackground};
                border: 0.1rem solid;
                border-color: ${customBorderColor || themeBorderColor};
                color: ${customFontColor || themeFontColor};
                flex: 1;
                font-size: ${customFontSize || themeFontSize};
                padding: 5px;

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

                  .button-count {
                    background: red;
                    /* background-color: #cacbcf; */
                  }
                }

                &:first-of-type {
                  border-top-left-radius: ${customBorderRadius || themeBorderRadius};
                  border-bottom-left-radius: ${customBorderRadius || themeBorderRadius};
                }

                &:not(:first-of-type) {
                  &.active {
                    margin-left: -0.1rem;
                  }

                  &:not(.active) {
                    border-left: none;
                  }
                }

                &:last-of-type {
                  border-top-right-radius: ${customBorderRadius || themeBorderRadius};
                  border-bottom-right-radius: ${customBorderRadius || themeBorderRadius};
                }
              `,
              themeOptionCSS,
              customOptionCSS,
            ]}
            disabled={disabled}
            key={value || `undefined-${index}`}
            onClick={clickHandler}
          >
            {typeof title === 'function'
              ? title({ toggleStatus: cx({ active, disabled }) })
              : title}
          </Button>
        );
      })}
    </div>
  );
};
export default ToggleButton;
