import React from 'react';
import { esToAggTypeMap } from '@arranger/mapping-utils';
import AggWrapper from './Facets';

const esTypeToAggType = esType => esToAggTypeMap[esType];

const FacetViewNode = ({
  title,
  id,
  children,
  path,
  type: esType,
  aggregations,
}) => {
  return (
    <div id={path} style={{ marginLeft: 20 }}>
      <div>
        <AggWrapper
          title={title}
          aggType={esTypeToAggType(esType)}
          aggProps={aggregations[path]}
        />
      </div>
      {children ? (
        <div>
          <div>{title}</div>
          {children.map(childNode => (
            <FacetViewNode
              key={childNode.path}
              aggregations={aggregations}
              {...childNode}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default FacetViewNode;
