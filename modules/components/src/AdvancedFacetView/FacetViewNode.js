import React from 'react';
import { esToAggTypeMap } from '@arranger/mapping-utils';
import FacetWrapper from './Facets';

const esTypeToAggType = esType => esToAggTypeMap[esType];

const FacetViewNode = ({
  title,
  id,
  children,
  path,
  type: esType,
  aggregations,
  onValueChange,
  sqon = {},
}) => {
  return (
    <div
      className="facetViewNode"
      id={path.split('.').join('__')}
      style={{ marginLeft: 20 }}
    >
      {!children && (
        <div className="aggWrapper">
          {!esType && <div className="facetTitle">{title}</div>}
          <FacetWrapper
            sqon={sqon}
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
              sqon={sqon}
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
