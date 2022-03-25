import { useState } from 'react';
import { css } from '@emotion/react';
import styled from '@emotion/styled';
import cx from 'classnames';

import { useThemeContext } from '@/ThemeContext';

const InputWrapper = styled.div`
  align-items: center;
  border: solid 2px lightgrey;
  display: flex;
  justify-content: center;
  overflow: hidden;
  padding: 5px;

  &.focused {
    box-shadow: 0px 0px 10px skyblue;
  }

  input:focus {
    outline: none;
  }

  .inputIcon {
    color: lightgrey;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .inputRightIcon {
    color: lightgrey;
    display: flex;
    justify-content: center;
    align-items: center;
  }
`;

const Input = ({
  className,
  Component: CustomComponent,
  componentRef,
  css: customCSS,
  leftIcon: { Icon: CustomLeftIcon, ...customLeftIconProps } = {},
  onBlur: customBlurHandler,
  onChange: customChangeHandler,
  onFocus: customFocusHandler,
  rightIcon: { Icon: CustomRightIcon, ...customRightIconProps } = {},
  shouldAutoFocus = false, // autoFocus is problematic for accessibility reasons, let alone if true by default
  ...props
}) => {
  const [internalValue, setInternalValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const {
    components: {
      Input: {
        Component: ThemeComponent,
        css: themeCSS,
        LeftIcon: ThemeLeftIcon,
        onChange: themeChangeHandler,
        onBlur: themeBlurHandler,
        onFocus: themeFocusHandler,
        RightIcon: ThemeRightIcon,
      } = {},
    } = {},
  } = useThemeContext();

  const Component = CustomComponent || ThemeComponent || 'input';
  const LeftIcon = CustomLeftIcon || ThemeLeftIcon;
  const RightIcon = CustomRightIcon || ThemeRightIcon;

  const blurHandler = (event) => {
    setIsFocused(false);
    customBlurHandler?.(event);
    themeBlurHandler?.(event);
  };

  const changeHandler = (event) => {
    setInternalValue(event.target.value);
    customChangeHandler?.(event);
    themeChangeHandler?.(event);
  };

  const focusHandler = (event) => {
    setIsFocused(true);
    customFocusHandler?.(event);
    themeFocusHandler?.(event);
  };

  return (
    <InputWrapper
      className={cx('inputWrapper', { focused: isFocused }, className)}
      css={css`
        flex: 1;
        ${customCSS}
        ${themeCSS}
      `}
      ref={componentRef}
    >
      {LeftIcon && (
        <span className="inputIcon">
          <LeftIcon {...customLeftIconProps} />
        </span>
      )}

      <Component
        autoFocus={shouldAutoFocus}
        css={css`
          border: none;
          flex: 1;

          &:focus {
            outline: none;
          }
        `}
        onBlur={blurHandler}
        onChange={changeHandler}
        onFocus={focusHandler}
        value={internalValue}
        {...props}
      />

      {RightIcon && (
        <span className="inputRightIcon">
          <RightIcon {...customRightIconProps} />
        </span>
      )}
    </InputWrapper>
  );
};

export default Input;
