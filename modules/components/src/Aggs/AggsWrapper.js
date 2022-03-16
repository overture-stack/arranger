import { useState } from 'react';
import { css } from '@emotion/react';
import cx from 'classnames';

import { TransparentButton } from '@/Button';
import { ArrowIcon } from '@/Icons';
import { useThemeContext } from '@/ThemeProvider';
import noopFn from '@/utils/noopFns';

import './AggregationCard.css';

const AggsWrapper = ({
  actionIcon: { Icon: AggTypeActionIcon, onClick: aggTypeActionIconHandler = noopFn } = {},
  children,
  className: aggTypeCustomClassName,
  collapsible = true,
  componentRef,
  dataFields = {},
  displayName,
  filters,
  headerRef,
  stickyHeader = false,
  WrapperComponent,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const {
    colors,
    components: {
      Aggregations: {
        AggsGroup: {
          className: themeAggsGroupClassName,
          collapsedBackground: themeAggsGroupCollapsedBackground = colors?.grey?.[200],
          groupDividerColor: ThemeAggsGroupDividerColor = colors?.grey?.[300],
          headerBackground: themeAggsHeaderBackground = colors?.common?.white,
          headerDividerColor: themeAggsHeaderDividerColor = colors?.grey?.[300],
          headerFontColor: themeAggsHeaderFontColor = colors?.grey?.[900],
          ...aggsGroupTheme
        } = {},
        ActionIcon: {
          ActionIcon: ThemeActionIcon,
          onClick: themeActionIconHandler,
          size: themeActionIconSize = '14',
          ...actionIconTheme
        } = {},
        TreeJointIcon: {
          className: themeTreeJointIconClassName,
          line: themeTreeJointIconLine = 3,
          size: themeTreeJointIconSize = 9,
          TreeJointIcon: ThemeTreeJointIcon = ArrowIcon,
          ...treeJointIconTheme
        } = {},
      } = {},
    } = {},
  } = useThemeContext();

  const ActionIcon = ThemeActionIcon || AggTypeActionIcon;
  const TreeJointIcon = ThemeTreeJointIcon;

  return WrapperComponent ? (
    <WrapperComponent {...{ collapsible, displayName, componentRef, headerRef }} {...dataFields}>
      {children}
    </WrapperComponent>
  ) : (
    <article
      className={cx('aggregation-group', themeAggsGroupClassName || aggTypeCustomClassName)}
      css={css`
        border-bottom: 0.1rem solid ${ThemeAggsGroupDividerColor};
        box-sizing: border-box;
      `}
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
          position: ${stickyHeader ? `sticky` : `relative`};
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
            border-bottom: 0.1rem solid ${themeAggsHeaderDividerColor};
            box-sizing: border-box;
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
                isTreeJoint={true}
                line={themeTreeJointIconLine}
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
                margin-left: 0.4rem;
                margin-top: 0.1rem;
                position: absolute;
                right: 6px;
              `}
              hidden={isCollapsed}
            >
              <ActionIcon
                height={themeActionIconSize}
                onClick={themeActionIconHandler || aggTypeActionIconHandler}
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
          className={`bucket${isCollapsed ? ' collapsed' : ''}`}
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
