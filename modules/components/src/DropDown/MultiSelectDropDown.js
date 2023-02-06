import { useCallback, useEffect, useRef, useState } from 'react';
import { css } from '@emotion/react';
import cx from 'classnames';
import { merge } from 'lodash';
import { v4 as uuid } from 'uuid';

import Button, { TransparentButton } from '@/Button';
import { ArrowIcon, CheckIcon, ResetIcon } from '@/Icons';
import { useThemeContext } from '@/ThemeContext';
import noopFn, { emptyObj } from '@/utils/noops';

const DropDownMenu = ({
	align = 'right',
	allowControls = false,
	allowSelection = false,
	buttonAriaLabelClosed = 'Open selection menu',
	buttonAriaLabelOpen = 'Close selection menu',
	children,
	className: customClassName = '',
	disabled = false,
	items = [],
	itemSelectionLegend = 'Select items',
	itemToString = (item, closeDropDown) => item.label,
	onChange = noopFn,
	resetToDefaultAriaLabel = 'Reset to default selection',
	selectAllAriaLabel = 'Select all items',
	selectionProperty = 'show',
	selectionValues = [true],
	theme: {
		arrowColor: customArrowColor,
		arrowDisabledColor: customArrowDisabledColor,
		arrowTransition: customArrowTransition,
		css: customDropDownButtonCSS,
		fontColor: customDropDownFontColor,

		// Child Components
		ListWrapper: {
			background: customListWrapperBackground,
			borderColor: customListWrapperBorderColor,
			borderRadius: customListWrapperBorderRadius,
			fontColor: customListWrapperFontColor = customDropDownFontColor,
			fontSize: customListWrapperFontSize,
			hoverBackground: customListWrapperHoverBackground,
			maxHeight: customListWrapperMaxHeight,
			width: customListWrapperWidth,
		} = emptyObj,
		SelectionControls: {
			fontColor: customSelectionControlFontColor = customListWrapperFontColor,
			fontSize: customSelectionControlFontSize = customListWrapperFontSize,
			hoverBackground: customSelectionControlHoverBackground = customListWrapperHoverBackground,
			...customSelectionControlProps
		} = emptyObj,
		...customDropDownButtonProps
	} = emptyObj,
}) => {
	const [instanceId] = useState(uuid()); // to prevent ID collisions between different dropdowns
	const [allSelected, setAllSelected] = useState(null);
	const [isDisabled, setIsDisabled] = useState(false);
	const [isOpen, setIsOpen] = useState(false);
	const buttonRef = useRef();
	const itemsRef = useRef([]);
	const panelRef = useRef();
	const renderRef = useRef();
	const {
		colors,
		components: {
			DropDown: {
				arrowColor: themeArrowColor,
				arrowDisabledColor: themeArrowDisabledColor,
				arrowTransition: themeArrowTransition,
				className: themeClassName,
				css: themeDropDownButtonCSS,
				fontColor: themeDropDownFontColor = colors?.grey?.[800],

				// Child Components
				ListWrapper: {
					background: themeListWrapperBackground = colors?.grey?.[100],
					borderColor: themeListWrapperBorderColor = colors?.grey?.[200],
					borderRadius: themeListWrapperBorderRadius = '0.3rem',
					fontColor: themeListWrapperFontColor = themeDropDownFontColor,
					fontSize: themeListWrapperFontSize = '0.8rem',
					hoverBackground: themeListWrapperHoverBackground = colors?.grey?.[200],
					maxHeight: themeListWrapperMaxHeight = '15rem',
					width: themeListWrapperWidth = '12rem',
				} = emptyObj,
				SelectionControls: {
					fontColor: themeSelectionControlFontColor = themeListWrapperFontColor,
					fontSize: themeSelectionControlFontSize = themeListWrapperFontSize,
					hoverBackground: themeSelectionControlHoverBackground = themeListWrapperHoverBackground,
					...themeSelectionControlProps
				} = emptyObj,
				...themeDropDownButtonProps
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'DropDownMenu' });

	const buttonTheme = merge(
		{
			fontColor: themeDropDownFontColor,
		},
		themeDropDownButtonProps,
		customDropDownButtonProps,
	);

	const checkSelected = useCallback(
		(item, values) => (values || selectionValues).includes(item[selectionProperty]),
		[selectionProperty, selectionValues],
	);

	const checkIfAllSelected = useCallback(
		(values) => items.length > 0 && items.every((item) => checkSelected(item, values)),
		[checkSelected, items],
	);

	const focusNext = (item) => {
		itemsRef.current?.[(item + 1) % items.length]?.focus?.();
	};

	const focusPrev = (item) => {
		itemsRef.current?.[(item - 1 + items.length) % items.length]?.focus?.();
	};

	const focusFirst = () => {
		itemsRef.current?.[0]?.focus?.();
	};

	const focusLast = () => {
		itemsRef.current?.[items.length - 1]?.focus?.();
	};

	const handleAction = useCallback((event) => {
		event?.preventDefault?.();
		setIsOpen((isOpen) => !isOpen);
	}, []);

	const handleBlur = useCallback(
		(event) => {
			const nextTarget = event.relatedTarget;

			panelRef.current && !panelRef.current?.contains?.(nextTarget) && handleAction();
		},
		[handleAction, panelRef],
	);

	const handleClickOutside = useCallback(
		(event) => {
			if (
				panelRef.current &&
				!panelRef.current?.contains?.(event.target) &&
				event.target !== buttonRef.current
			) {
				handleAction();
			}
		},
		[buttonRef, handleAction, panelRef],
	);

	const handleEsc = useCallback(
		(event) => {
			if (event.key === 'Escape') {
				handleAction();
				isOpen && buttonRef.current?.focus?.();
			}
		},
		[handleAction, isOpen],
	);

	const handleKeyPress = (item) => (event) => {
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				focusNext(item);
				break;

			case 'ArrowUp':
				event.preventDefault();
				focusPrev(item);
				break;

			case 'Home':
				event.preventDefault();
				focusFirst();
				break;

			case 'End':
				event.preventDefault();
				focusLast();
				break;

			default:
				break;
		}
	};

	const handleReset = (event) => {
		event.preventDefault();

		onChange?.(event, 'reset');
	};

	const handleSelectAll = useCallback(
		(event) => {
			event.preventDefault();

			const value =
				// if (allSelected === 'all') then it needs to turn to 'none' (make all items show:false)
				!allSelected === 'all' ||
				// or (allSelected === 'none') then it needs to turn to 'all' (make all items show:true)
				allSelected === 'none' ||
				// or (allSelected === false), then same as above (all items show:true)
				!allSelected;

			onChange?.(event, 'all', value);
		},
		[allSelected, onChange],
	);

	const handleSelectOne = (item) => (event) => {
		onChange?.(event, 'one', item);
	};

	const selectionButtonsTheme = merge(
		{
			fontColor: customSelectionControlFontColor || themeSelectionControlFontColor,
			fontSize: customSelectionControlFontSize || themeSelectionControlFontSize,
			hoverBackground:
				customSelectionControlHoverBackground || themeSelectionControlHoverBackground,
			whiteSpace: 'nowrap',
		},
		themeSelectionControlProps,
		customSelectionControlProps,
	);

	useEffect(() => {
		// check if all items are selected
		if (checkIfAllSelected([true])) {
			setAllSelected('all');
		}
		// or if all items are deselected
		else if (checkIfAllSelected([false])) {
			setAllSelected('none');
		}
	}, [allSelected, checkIfAllSelected]);

	useEffect(() => {
		if (renderRef && !renderRef.current) {
			itemsRef.current = new Array(items.length);
			renderRef.current = true;
		}
	}, [items, renderRef]);

	useEffect(() => {
		if (isOpen) {
			window.addEventListener('click', handleClickOutside);
			window.addEventListener('keydown', handleEsc);
			focusFirst();
		}

		return () => {
			window.removeEventListener('click', handleClickOutside);
			window.removeEventListener('keydown', handleEsc);
		};
	}, [handleClickOutside, handleEsc, isOpen]);

	useEffect(() => {
		setIsDisabled(disabled || items.length < 1);
	}, [disabled, items]);

	return (
		<article
			className={cx('DropdownContainer', customClassName, themeClassName)}
			css={css`
				position: relative;
			`}
		>
			<Button
				aria-label={isOpen ? buttonAriaLabelOpen : buttonAriaLabelClosed}
				aria-haspopup="true"
				aria-expanded={isOpen}
				className="DropDownButton"
				css={[themeDropDownButtonCSS, customDropDownButtonCSS]}
				disabled={isDisabled}
				onBlur={handleBlur}
				onClick={handleAction}
				ref={buttonRef}
				theme={buttonTheme}
			>
				{children}

				<ArrowIcon
					css={css`
						margin-left: 0.3rem;
						margin-top: 0.1rem;
					`}
					disabled={isDisabled}
					disabledFill={customArrowDisabledColor || themeArrowDisabledColor}
					fill={customArrowColor || themeArrowColor}
					pointUp={isOpen}
					transition={customArrowTransition || themeArrowTransition}
				/>
			</Button>

			{isOpen && (
				<fieldset
					className="ListWrapper"
					css={css`
						background: ${customListWrapperBackground || themeListWrapperBackground};
						border: solid 1px ${customListWrapperBorderColor || themeListWrapperBorderColor};
						border-radius: ${customListWrapperBorderRadius || themeListWrapperBorderRadius};
						box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.2);
						left: ${align === 'right' ? 'auto' : 0};
						max-height: unset !important;
						overflow-y: hidden !important;
						padding: 0;
						position: absolute;
						right: ${align === 'right' ? 0 : 'auto'};
						width: ${customListWrapperWidth || themeListWrapperWidth};
						z-index: 100;
					`}
					ref={panelRef}
				>
					<legend style={{ position: 'absolute', clip: 'rect(0 0 0 0)' }}>
						{itemSelectionLegend}
					</legend>

					{allowControls && allowSelection && (
						<section
							className="SelectionControls"
							css={css`
								border-bottom: 1px solid #d9d9df;
								box-sizing: border-box;
								display: flex;
								justify-content: space-between;
								left: 0;
								padding: 4px 8px;
								position: sticky;
								right: 0;
								top: 0;

								> button {
									&:not(:first-of-type) {
										margin-left: 0.5rem;
									}

									svg {
										margin-right: 0.3rem;
									}
								}
							`}
						>
							<TransparentButton
								aria-label={selectAllAriaLabel}
								className="SelectAllButton"
								onClick={handleSelectAll}
								theme={selectionButtonsTheme}
							>
								<CheckIcon />
								{allSelected === 'all' ? 'Deselect' : 'Select'} All
							</TransparentButton>

							<TransparentButton
								aria-label={resetToDefaultAriaLabel}
								className="ResetSelectionButton"
								onClick={handleReset}
								theme={selectionButtonsTheme}
							>
								<ResetIcon />
								Reset
							</TransparentButton>
						</section>
					)}

					{items.length > 0 ? (
						<ul
							className="List"
							css={css`
								list-style: none;
								padding: 0 0.2rem;
								overflow-y: scroll;
								max-height: ${customListWrapperMaxHeight || themeListWrapperMaxHeight};
								margin-bottom: 0;

								> li:first-of-type {
									margin-top: 0.2rem;
								}

								> li:last-of-type {
									margin-bottom: 0.2rem;
								}
							`}
						>
							{items.map((item, index) => {
								// TODO: find a better fallback than "index"
								const itemId = `${instanceId}--${item.accessor || index}`;

								return (
									<li
										className="ListItem"
										css={css`
											padding: 0.2rem 0.3rem;

											&:hover {
												background: ${customListWrapperHoverBackground ||
												themeListWrapperHoverBackground};
											}
										`}
										key={itemId}
									>
										<label
											className="ListItemLabel"
											css={css`
												align-items: flex-start;
												color: ${customListWrapperFontColor || themeListWrapperFontColor};
												cursor: ${allowSelection && 'pointer'};
												display: flex;
												font-size: ${customListWrapperFontSize || themeListWrapperFontSize};
												word-break: break-word;
											`}
										>
											{allowSelection && (
												<input
													checked={checkSelected(item)}
													className="ListItemCheckbox"
													css={css`
														margin: 0.1rem 0.4rem 0 0;
													`}
													id={itemId}
													name={itemId}
													onBlur={index === items.length - 1 ? handleBlur : undefined}
													onChange={handleSelectOne(item)}
													onKeyDown={handleKeyPress(index)}
													ref={(el) => (itemsRef.current[index] = el)}
													type="checkbox"
												/>
											)}

											{itemToString(item, handleAction)}
										</label>
									</li>
								);
							})}
						</ul>
					) : (
						'No items to display'
					)}
				</fieldset>
			)}
		</article>
	);
};

export default DropDownMenu;
