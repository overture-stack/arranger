import React from 'react';
import { esToAggTypeMap } from '@arranger/mapping-utils';
import FacetWrapper from './Facets';
import State from '../State';

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
  depth,
}) => {
  return (
    <div
      className={`facetViewNode depth_${depth}`}
      id={path.split('.').join('__')}
    >
      {!children && (
        <div className={`aggWrapper depth_${depth}`}>
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
        <div className={`aggWrapper depth_${depth}`}>
          <div className="facetTitle">{title}</div>
          {children.map(childNode => (
            <FacetViewNode
              depth={depth + 1}
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
// '\203A'
export default FacetViewNode;
