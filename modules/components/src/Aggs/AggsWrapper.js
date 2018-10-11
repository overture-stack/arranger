import React from 'react';
import Component from 'react-component-component';
import { css } from 'emotion';

import './AggregationCard.css';

export default ({
  children,
  collapsible = true,
  stickyHeader = false,
  displayName,
  filters,
  WrapperComponent,
  ActionIcon = null,
  componentRef,
  headerRef,
}) => {
  return WrapperComponent ? (
    <WrapperComponent
      {...{ collapsible, displayName, componentRef, headerRef }}
    >
      {children}
    </WrapperComponent>
  ) : (
    <Component initialState={{ isCollapsed: false }}>
      {({ setState, state: { isCollapsed } }) => (
        <div className="aggregation-card" ref={componentRef}>
          <div
            ref={headerRef}
            className={`header ${css`
              position: ${stickyHeader ? `sticky` : `relative`};
              top: 0px;
            `}`}
          >
            <div className={`title-wrapper ${isCollapsed ? 'collapsed' : ''}`}>
              <div
                className="title-control"
                onClick={
                  collapsible
                    ? () => setState({ isCollapsed: !isCollapsed })
                    : () => {}
                }
              >
                {collapsible && (
                  <span className={`arrow ${isCollapsed ? 'collapsed' : ''}`} />
                )}
                <span className="title">{displayName}</span>
              </div>
              {ActionIcon && <div className="action-icon">{ActionIcon}</div>}
            </div>
            {!isCollapsed &&
              filters &&
              filters.map((x, i) => (
                <div key={i} className="filter">
                  {x}
                </div>
              ))}
          </div>
          {!isCollapsed && (
            <div className={`bucket ${isCollapsed ? 'collapsed' : ''}`}>
              {children}
            </div>
          )}
        </div>
      )}
    </Component>
  );
};
