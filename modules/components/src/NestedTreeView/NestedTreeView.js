import React from 'react';
import ReactTreeView from './ReactTreeView';
import './style.css';

const NestedTreeView = ({
  dataSource,
  depth = 0,
  onLeafSelect = () => {},
  selectedPath,
  isActivePath = true,
}) =>
  dataSource.map(({ title, id, children, isHeader }, i) => {
    const selectedPathArray = selectedPath.split('.');
    return children ? (
      <ReactTreeView
        key={id || `${title}-${i}`}
        nodeLabel={title}
        defaultCollapsed={true}
        itemClassName={depth == 0 && 'header'}
      >
        <NestedTreeView
          onLeafSelect={selectedPath => {
            onLeafSelect(`${id || title}.${selectedPath}`);
          }}
          selectedPath={selectedPathArray
            .slice(1, selectedPathArray.length)
            .join('.')}
          dataSource={children}
          depth={depth + 1}
        />
      </ReactTreeView>
    ) : (
      <div
        onClick={() => onLeafSelect(id || title)}
        key={id || `${title}-${i}`}
        className={`tree-view_children leaf
          ${depth == 0 ? 'header' : ''}
          ${selectedPath === (id || title) ? 'selected' : ''}
        `}
      >
        {title}
      </div>
    );
  });

export default NestedTreeView;
