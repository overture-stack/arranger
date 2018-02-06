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
    <div id={path.split('.').join('__')} style={{ marginLeft: 20 }}>
      <div>
        <AggWrapper
          title={title}
          aggType={esTypeToAggType(esType)}
          aggProps={aggregations[path]}
          path={path}
          onValueChange={({ value }) =>
            onValueChange({ value: value, path: path })
          }
        />
      </div>
      {children ? (
        <div>
          <div>{title}</div>
          {children.map(childNode => (
            <FacetViewNode
              key={childNode.path}
              aggregations={aggregations}
              onValueChange={onValueChange}
              {...childNode}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default FacetViewNode;
