import React from 'react';
import Downshift from 'downshift';
import { css } from '@emotion/react';

import { ArrowIcon } from '@/Icons';
import noopFn, { emptyObj } from '@/utils/noops';
import { withTheme } from '@/ThemeContext';
import TextFilter from '@/TextFilter';
import TextHighlight from '@/TextHighlight';
import internalTranslateSQONValue from '@/utils/translateSQONValue';
import strToReg from '@/utils/strToReg';

import './DropDown.css';

class DropDown extends React.Component {
	state = { isOpen: false, searchText: '' };
	handleToggleMenu = (event) => {
		event.target?.attributes?.disabled || this.setState(({ isOpen }) => ({ isOpen: !isOpen }));
	};
	handleStateChange = (changes) => {
		const { isOpen, type } = changes;

		if (type === '__autocomplete_click_button__') {
			this.setState({ isOpen: !isOpen });
		}
	};

	render() {
		const { isOpen, searchText } = this.state;
		const {
			arrowColor: customArrowColor,
			arrowTransition: customArrowTransition,
			hasSelectedRows,
			items,
			onChange = noopFn,
			itemToString,
			children,
			align = 'right',
			singleSelect = false,
			enableSelectColumnDropdownTextFilter = false,
			searchPlaceholder = 'Search',
			theme: {
				components: {
					DropDown: {
						arrowColor: themeArrowColor,
						arrowTransition: themeArrowTransition,
						...themeArrowProps
					} = emptyObj,
				} = emptyObj,
			} = emptyObj,
		} = this.props;

		const disableDownloads =
			items.every((item) => item.exporterRequiresRowSelection) && !hasSelectedRows;

		const handleChangeSearchText = ({ value }) => this.setState({ searchText: value || '' });

		return (
			<Downshift
				itemToString={itemToString}
				onChange={onChange}
				selectedItem={items.filter((item) => item.show)}
				isOpen={isOpen}
				onStateChange={this.handleStateChange}
			>
				{({
					getInputProps,
					getButtonProps,
					getItemProps,
					isOpen,
					toggleMenu,
					clearSelection,
					selectedItem,
					inputValue,
					highlightedIndex,
				}) => (
					<div className="dropDownHeader">
						<button
							aria-label={`Show columns to select`}
							className="dropDownButton"
							{...getButtonProps({
								disabled: disableDownloads,
								onClick: this.handleToggleMenu,
							})}
						>
							<div className="dropDownButtonContent">{children}</div>
							<ArrowIcon
								css={css`
									margin-left: 0.3rem;
									margin-top: 0.1rem;
								`}
								fill={customArrowColor || themeArrowColor}
								pointUp={isOpen}
								transition={customArrowTransition || themeArrowTransition}
								{...themeArrowProps}
							/>
						</button>

						{isOpen && (
							<div
								className={`dropDownContent ${singleSelect ? 'single' : 'multiple'}`}
								style={{
									right: align === 'right' ? 0 : 'auto',
									left: align === 'right' ? 'auto' : 0,
								}}
								{...(singleSelect && { onClick: this.handleToggleMenu })}
							>
								{enableSelectColumnDropdownTextFilter && (
									<TextFilter
										aria-label={`Search data`}
										onChange={handleChangeSearchText}
										placeholder={searchPlaceholder}
										type="text"
										value={searchText}
									/>
								)}
								{items
									.filter(
										(item) =>
											// Filters out values that don't match the TextFilter's input
											!searchText ||
											internalTranslateSQONValue(itemToString(item)).match(strToReg(searchText)),
									)
									.map((item, index) => {
										const { id, ...itemProps } = getItemProps({
											item,
											index,
											disabled: item.exporterRequiresRowSelection && !hasSelectedRows,
										});
										const label = itemToString(item);
										const labelIsComponent = React.isValidElement(label);
										return (
											<div
												className={`dropDownContentElement${
													labelIsComponent ? ' custom' : ' clickable'
												}`}
												key={item.id || id}
												{...itemProps}
											>
												{enableSelectColumnDropdownTextFilter ? (
													<TextHighlight content={label} highlightText={searchText} />
												) : (
													label
												)}
												{!(singleSelect || labelIsComponent) && (
													<input
														readOnly
														type="checkbox"
														checked={selectedItem.indexOf(item) > -1}
														aria-label={`Select column ${
															item.id || (typeof label === 'string' ? label : id)
														}`}
													/>
												)}
											</div>
										);
									})}
							</div>
						)}
					</div>
				)}
			</Downshift>
		);
	}
}

export default withTheme(DropDown);
