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
  onValueChange,
}) => {
  return (
    <div
      className="facetViewNode"
      id={path.split('.').join('__')}
      style={{ marginLeft: 20 }}
    >
      {!children && (
        <div className="aggWrapper">
          <AggWrapper
            title={title}
            aggType={esTypeToAggType(esType)}
            aggProps={aggregations[path]}
            path={path}
            onValueChange={({ value }) =>
              onValueChange({
                value,
                path: path,
                esType: esType,
                aggType: esTypeToAggType(esType),
              })
            }
          />
        </div>
      )}
      {children && (
        <div className="aggWrapper">
          <div className="facetTitle">{title}</div>
          {children.map(childNode => (
            <FacetViewNode
              key={childNode.path}
              aggregations={aggregations}
              onValueChange={onValueChange}
              {...childNode}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FacetViewNode;
