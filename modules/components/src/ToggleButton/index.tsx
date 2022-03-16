import { css } from '@emotion/react';
import cx from 'classnames';

import Button from '@/Button';
import { useThemeContext } from '@/ThemeProvider';
import noopFn from '@/utils/noopFns';

import Props from './types';

const ToggleButton = ({ onChange = noopFn, options = [], value: selectedValue = '' }: Props) => {
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
          disabledBackground: themeDisabledBackground = colors?.grey?.[300],
          disabledBorderColor: themeDisabledBorderColor = undefined,
          disabledFontColor: themeDisabledFontColor = colors?.grey?.[800],
          disabledFontSize: themeDisabledFontSize = undefined,
          fontColor: themeFontColor = undefined,
          fontSize: themeFontSize = '0.9rem',
          OptionCSS: themeOptionCSS = undefined,
          ...toggleButtonTheme
        } = {},
      } = {},
    } = {},
  } = useThemeContext();

  return (
    <div
      className={cx('toggle-button', themeClassName)}
      css={[
        css`
          display: flex;
          flex-direction: row;
          justify-content: center;
          height: calc(${themeFontSize} * 2);
        `,
        themeCSS,
      ]}
      {...toggleButtonTheme}
    >
      {options.map(({ disabled = false, title = '', value = '' }, index) => {
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
                background: ${(disabled && themeDisabledBackground) ||
                (active && themeActiveBackground) ||
                themeBackground};
                border: 0.1rem solid;
                border-color: ${(disabled && themeDisabledBorderColor) ||
                (active && themeActiveBorderColor) ||
                themeBorderColor};
                color: ${(disabled && themeDisabledFontColor) ||
                (active && themeActiveFontColor) ||
                themeFontColor};
                font-size: ${(disabled && themeDisabledFontSize) ||
                (active && themeActiveFontSize) ||
                themeFontSize};
                flex: 1;
                padding: 5px;

                &:first-of-type {
                  border-top-left-radius: ${themeBorderRadius};
                  border-bottom-left-radius: ${themeBorderRadius};
                }

                &:not(:first-of-type) {
                  border-left: none;
                }

                &:last-of-type {
                  border-top-right-radius: ${themeBorderRadius};
                  border-bottom-right-radius: ${themeBorderRadius};
                }

                // TODO: this carryover from css files needs to be validated
                // I could not find what this was added for
                &.disabled > .button-count {
                  background-color: #cacbcf;
                }
              `,
              themeOptionCSS,
            ]}
            disabled={disabled}
            key={value || `undefined-${index}`}
            onClick={clickHandler}
          >
            {title}
          </Button>
        );
      })}
    </div>
  );
};
export default ToggleButton;
