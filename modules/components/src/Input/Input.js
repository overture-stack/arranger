import { createRef, forwardRef, RefObject, useState } from 'react';
import { css } from '@emotion/react';
import styled from '@emotion/styled';
import cx from 'classnames';

import Button from '@/Button';
import { useThemeContext } from '@/ThemeContext';
import { emptyObj } from '@/utils/noops';

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

// TODO: study custom vs theme handlers, figure out whether both or which.
// TODO: change component props to {...,theme} model

// const Input = React.forwardRef<HTMLInputElement, InputProps>({
const Input = (
	{
		className,
		clearAltText: customClearAltText,
		ClearButton: CustomClearButton,
		Component: CustomComponent,
		css: customCSS,
		leftIcon: { Icon: CustomLeftIcon, ...customLeftIconProps } = emptyObj,
		onBlur: customBlurHandler,
		onChange: customChangeHandler,
		onFocus: customFocusHandler,
		rightIcon: { Icon: CustomRightIcon, ...customRightIconProps } = emptyObj,
		showClear: customShowClear,
		...props
	},
	ref,
) => {
	const [internalValue, setInternalValue] = useState('');
	const [isFocused, setIsFocused] = useState(false);
	const {
		components: {
			Input: {
				clearAltText: themeClearAltText = 'Clear text',
				Component: ThemeComponent = 'input',
				ClearButton: ThemeClearButton = Button,
				css: themeCSS,
				LeftIcon: ThemeLeftIcon,
				onChange: themeChangeHandler,
				onBlur: themeBlurHandler,
				onFocus: themeFocusHandler,
				RightIcon: ThemeRightIcon,
				showClear: themeShowClear = false,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'Input' });

	const ClearButton = CustomClearButton || ThemeClearButton;
	const Component = CustomComponent || ThemeComponent;
	const LeftIcon = CustomLeftIcon || ThemeLeftIcon;
	const RightIcon = CustomRightIcon || ThemeRightIcon;

	const clearAltText = `${customClearAltText || themeClearAltText}${
		internalValue ? '' : ' (disabled)'
	}`;
	const showClear = customShowClear || themeShowClear;

	// const inputRef = (ref || React.createRef()) as React.RefObject<HTMLInputElement>;
	const inputRef = ref || createRef();
	// const clearButtonRef = createRef() as RefObject<HTMLButtonElement>;
	const clearButtonRef = createRef();

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

	const clearHandler = (e) => {
		e.preventDefault();
		e.stopPropagation();
		setInternalValue('');
		customChangeHandler?.('');
		themeChangeHandler?.('');
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
				align-items: center;
				flex: 1;
				${customCSS}
				${themeCSS}
			`}
			onClick={(e) => {
				if (inputRef.current && e.target !== clearButtonRef?.current) inputRef.current.focus();
			}}
			onFocus={(e) => {
				if (inputRef.current && e.target !== clearButtonRef?.current) inputRef.current.focus();
			}}
		>
			{LeftIcon && (
				<span className="inputIcon">
					<LeftIcon {...customLeftIconProps} />
				</span>
			)}

			<Component
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
				ref={inputRef}
				value={internalValue}
				{...props}
			/>

			{showClear && (
				<ClearButton
					aria-label={clearAltText}
					css={css`
						line-height: 1rem;
						margin-left: 5px;
						padding: 0 0.3rem;
					`}
					disabled={!internalValue}
					onClick={clearHandler}
					ref={clearButtonRef}
					title={clearAltText}
				>
					x
				</ClearButton>
			)}

			{RightIcon && (
				<span className="inputRightIcon">
					<RightIcon {...customRightIconProps} />
				</span>
			)}
		</InputWrapper>
	);
};

export default forwardRef(Input);
