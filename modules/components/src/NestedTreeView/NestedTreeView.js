import React from 'react';
import ReactTreeView from './ReactTreeView';
import './style.css';

const NestedTreeView = ({ dataSource, depth = 0 }) =>
  dataSource.map(
    ({ title, id, children, isHeader }, i) =>
      children ? (
        <ReactTreeView
          key={id || `${title}-${i}`}
          nodeLabel={title}
          defaultCollapsed={true}
          itemClassName={depth == 0 && 'header'}
        >
          <NestedTreeView dataSource={children} depth={depth + 1} />
        </ReactTreeView>
      ) : (
        <div
          key={id || `${title}-${i}`}
          className={`tree-view_children leaf ${depth == 0 && 'header'}`}
        >
          {title}
        </div>
      ),
  );

export default NestedTreeView;
