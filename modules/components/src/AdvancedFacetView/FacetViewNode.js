import React from 'react';
import { esToAggTypeMap } from '@arranger/mapping-utils';
import FacetWrapper from './Facets';
import State from '../State';

const esTypeToAggType = esType => esToAggTypeMap[esType];

class FacetViewNode extends React.Component {
  render() {
    const {
      title,
      id,
      children,
      path,
      type: esType,
      aggregations,
      onValueChange,
      sqon = {},
      constructEntryId = ({ field, value }) =>
        value ? `${field}---${value}` : field,
      depth,
      searchboxSelectionObservable,
    } = this.props;
    return (
      <div
        className={`facetViewNode depth_${depth}`}
        id={constructEntryId({ field: path.split('.').join('__') })}
      >
        {!children && ( // if there is no children FacetWrapper is brought in to render an agg corresponding to the type
          <div className={`aggWrapper depth_${depth}`}>
            {!esType && <div className="facetTitle">{title}</div>}
            <FacetWrapper
              sqon={sqon}
              title={title}
              aggType={esTypeToAggType(esType)}
              aggProps={aggregations[path]}
              path={path}
              constructEntryId={({ value }) =>
                constructEntryId({ field: path.split('.').join('__'), value })
              }
              searchboxSelectionObservable={searchboxSelectionObservable}
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
        {children && ( // if there are children, another nested layer is recursively rendered
          <div className={`aggWrapper depth_${depth}`}>
            <div className="facetTitle">{title}</div>
            {children.map(childNode => (
              <FacetViewNode
                depth={depth + 1}
                sqon={sqon}
                key={childNode.path}
                aggregations={aggregations}
                onValueChange={onValueChange}
                searchboxSelectionObservable={searchboxSelectionObservable}
                {...childNode}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
}
// '\203A'
export default FacetViewNode;
