import React from 'react';
import Component from 'react-component-component';
import './AggregationCard.css';

export default ({
  children,
  collapsible = true,
  displayName,
  filters,
  WrapperComponent,
}) => {
  return WrapperComponent ? (
    <WrapperComponent {...{ collapsible, displayName }}>
      {children}
    </WrapperComponent>
  ) : (
    <Component initialState={{ isCollapsed: false }}>
      {({ setState, state: { isCollapsed } }) => (
        <div className="aggregation-card">
          <div
            className={`title-wrapper ${isCollapsed ? 'collapsed' : ''}`}
            onClick={
              collapsible
                ? () => setState({ isCollapsed: !isCollapsed })
                : () => {}
            }
          >
            <span className="title">{displayName}</span>
            {collapsible && (
              <span className={`arrow ${isCollapsed ? 'collapsed' : ''}`} />
            )}
          </div>
          {!isCollapsed &&
            filters &&
            filters.map((x, i) => (
              <div key={i} className="filter">
                {x}
              </div>
            ))}
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
