import { useState } from 'react';
import cx from 'classnames';
import { css } from '@emotion/react';

import { TransparentButton } from '@/Button';
import { ArrowIcon } from '@/Icons';
import { useThemeContext } from '@/ThemeContext';
import noopFn, { emptyObj } from '@/utils/noops';

const BaseWrapper = ({ className, ...props }) => (
	<section {...props} className={cx('quicksearch', className)} />
);

const QuickSearchWrapper = ({
	actionIcon: { Icon: CustomActionIcon, onClick: customActionIconHandler } = emptyObj,
	children,
	className: quickSearchCustomClassName,
	collapsible: customCollapsible,
	componentRef,
	dataFields = emptyObj,
	displayName,
	filters,
	headerRef,
	stickyHeader,
	style,
}) => {
	const [isCollapsed, setIsCollapsed] = useState(false);
	const {
		colors,
		components: {
			QuickSearch: {
				QuickSearchWrapper: {
					className: themeQuickSearchWrapperClassName,
					css: themeQuickSearchWrapperCSS,
					collapsedBackground: themeQuickSearchWrapperCollapsedBackground = colors?.grey?.[200],
					collapsible: themeQuickSearchWrapperCollapsible = true,
					dividerColor: themeQuickSearchWrapperDividerColor = colors?.grey?.[300],
					headerBackground: themeQuickSearchWrapperHeaderBackground = colors?.common?.white,
					headerDividerColor: themeQuickSearchWrapperHeaderDividerColor = colors?.grey?.[200],
					headerFontColor: themeQuickSearchWrapperHeaderFontColor = colors?.grey?.[900],
					headerSticky: themeQuickSearchWrapperHeaderSticky = false,
					...quickSearchWrapperTheme
				} = emptyObj,
				ActionIcon: {
					Icon: ThemeActionIcon,
					onClick: themeActionIconHandler = noopFn,
					size: themeActionIconSize = '14',
					...actionIconTheme
				} = emptyObj,
				TreeJointIcon: {
					className: themeTreeJointIconClassName,
					size: themeTreeJointIconSize = 9,
					Icon: ThemeTreeJointIcon = ArrowIcon,
					...treeJointIconTheme
				} = emptyObj,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'QuickSearch' });

	const ActionIcon = CustomActionIcon || ThemeActionIcon;
	const TreeJointIcon = ThemeTreeJointIcon;
	const collapsible = customCollapsible || themeQuickSearchWrapperCollapsible;

	return (
		<BaseWrapper className={quickSearchCustomClassName} style={style}>
			<article
				className={cx(
					'quicksearch-wrapper',
					themeQuickSearchWrapperClassName || quickSearchCustomClassName,
				)}
				css={[
					css`
						border-bottom: 0.05rem solid transparent;
						border-color: ${themeQuickSearchWrapperDividerColor};
						box-sizing: border-box;
						padding-bottom: ${isCollapsed ? 0 : '0.3rem'};
					`,
					themeQuickSearchWrapperCSS,
				]}
				ref={componentRef}
				{...quickSearchWrapperTheme}
				{...dataFields}
			>
				<header
					className={cx('header', { collapsed: isCollapsed })}
					css={css`
						background: ${themeQuickSearchWrapperHeaderBackground};
						box-sizing: border-box;
						padding: 0 6px;
						position: ${stickyHeader || themeQuickSearchWrapperHeaderSticky
							? `sticky`
							: `relative`};
						top: 0px;

						&.collapsed {
							background: ${themeQuickSearchWrapperCollapsedBackground};
						}
					`}
					ref={headerRef}
				>
					<div
						className={cx('title-wrapper', { collapsed: isCollapsed })}
						css={css`
							align-items: center;
							border-bottom: 0.1rem solid ${themeQuickSearchWrapperHeaderDividerColor};
							box-sizing: border-box;
							display: flex;
							padding: 6px 0 4px;
						`}
					>
						<TransparentButton
							className="title-control"
							css={css`
								padding: 2px 0;
								width: 100%;
							`}
							onClick={collapsible ? () => setIsCollapsed(!isCollapsed) : undefined}
						>
							{collapsible && (
								<TreeJointIcon
									className={cx('treejoint', themeTreeJointIconClassName)}
									height={themeTreeJointIconSize}
									isTreeJoint
									pointUp={!isCollapsed}
									size={themeTreeJointIconSize}
									width={themeTreeJointIconSize}
									{...treeJointIconTheme}
								/>
							)}

							<span
								className="title"
								css={css`
									color: ${themeQuickSearchWrapperHeaderFontColor || 'inherit'};
									font-size: 1rem;
									margin-left: 0.5rem;
									${ActionIcon && `padding-right: calc(${themeActionIconSize}* 1.3px);`}
								`}
							>
								{displayName}
							</span>
						</TransparentButton>

						{ActionIcon && (
							<TransparentButton
								className="action-icon"
								css={css`
									cursor: pointer;
									margin-left: 0.4rem;
									margin-top: 0.1rem;
									padding: 0.2rem;
									position: absolute;
									right: 6px;
								`}
								hidden={isCollapsed}
							>
								<ActionIcon
									height={themeActionIconSize}
									onClick={customActionIconHandler || themeActionIconHandler}
									size={themeActionIconSize}
									width={themeActionIconSize}
									{...actionIconTheme}
								/>
							</TransparentButton>
						)}
					</div>

					{!isCollapsed &&
						filters?.map(
							(
								filter,
								index, // expected to be consistent throughout the runtime lifetime of the app
							) => (
								<div key={index} className="filter">
									{filter}
								</div>
							),
						)}
				</header>

				{!isCollapsed && (
					<section
						className={cx('filter', { collapsed: isCollapsed })}
						css={css`
							box-sizing: border-box;
							padding: 0 6px;
							top: 0px;
						`}
					>
						{children}
					</section>
				)}
			</article>
		</BaseWrapper>
	);
};

export default QuickSearchWrapper;
