import { css } from '@emotion/react';
import cx from 'classnames';
import { useState } from 'react';

import { TransparentButton } from '@/Button';
import { ArrowIcon } from '@/Icons';
import { useThemeContext } from '@/ThemeContext';
import noopFn, { emptyObj } from '@/utils/noops';

const AggsWrapper = ({
	actionIcon: { Icon: CustomActionIcon, onClick: customActionIconHandler } = emptyObj,
	children,
	className: aggTypeCustomClassName,
	collapsible: customCollapsible,
	componentRef,
	dataFields = emptyObj,
	displayName,
	filters,
	headerRef,
	stickyHeader,
	theme: { css: customAggsWrapperCSS } = emptyObj,
	WrapperComponent,
}) => {
	const [isCollapsed, setIsCollapsed] = useState(false);
	const {
		colors,
		components: {
			Aggregations: {
				AggsGroup: {
					className: themeAggsGroupClassName,
					css: themeAggsGroupCSS,
					collapsedBackground: themeAggsGroupCollapsedBackground = colors?.grey?.[200],
					collapsible: themeAggsGroupCollapsible = true,
					groupDividerColor: ThemeAggsGroupDividerColor = colors?.grey?.[300],
					headerBackground: themeAggsHeaderBackground = colors?.common?.white,
					headerDividerColor: themeAggsHeaderDividerColor = colors?.grey?.[200],
					headerFontColor: themeAggsHeaderFontColor = colors?.grey?.[900],
					headerSticky: themeAggsHeaderSticky = false,
					...aggsGroupTheme
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
	} = useThemeContext({ callerName: 'AggsWrapper' });

	const ActionIcon = CustomActionIcon || ThemeActionIcon;
	const TreeJointIcon = ThemeTreeJointIcon;
	const collapsible = customCollapsible || themeAggsGroupCollapsible;

	return WrapperComponent ? (
		<WrapperComponent {...{ collapsible, displayName, componentRef, headerRef }} {...dataFields}>
			{children}
		</WrapperComponent>
	) : (
		<article
			className={cx('aggregation-group', themeAggsGroupClassName || aggTypeCustomClassName)}
			css={[
				themeAggsGroupCSS,
				css`
					border-bottom: 0.05rem solid transparent;
					border-color: ${ThemeAggsGroupDividerColor};
					box-sizing: border-box;
					padding-bottom: ${isCollapsed ? 0 : '0.3rem'};
				`,
				customAggsWrapperCSS,
			]}
			ref={componentRef}
			{...aggsGroupTheme}
			{...dataFields}
		>
			<header
				className={cx('header', { collapsed: isCollapsed })}
				css={css`
					background: ${themeAggsHeaderBackground};
					box-sizing: border-box;
					padding: 0 6px;
					position: ${stickyHeader || themeAggsHeaderSticky ? `sticky` : `relative`};
					top: 0px;

					&.collapsed {
						background: ${themeAggsGroupCollapsedBackground};
					}
				`}
				ref={headerRef}
			>
				<div
					className={cx('title-wrapper', { collapsed: isCollapsed })}
					css={css`
						align-items: center;
						border-bottom: 0.1rem solid ${themeAggsHeaderDividerColor};
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
								color: ${themeAggsHeaderFontColor || 'inherit'};
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
					className={cx('bucket', { collapsed: isCollapsed })}
					css={css`
						align-items: flex-end;
						display: flex;
						flex-direction: column;
						padding: 0.1rem 0.3rem;
					`}
				>
					{children}
				</section>
			)}
		</article>
	);
};

export default AggsWrapper;
