import { keys } from 'lodash';
import { mappingToDisplayTreeData } from '@arranger/mapping-utils';

const { elasticMappingToDisplayTreeData } = mappingToDisplayTreeData;

const injectExtensionToElasticMapping = (elasticMapping, extendedMapping) => {
  const rawDisplayData = elasticMappingToDisplayTreeData(elasticMapping);
  const extend = node => {
    const extension = extendedMapping.find(
      extension => extension.field === node.path,
    );
    return {
      ...node,
      ...(extension
        ? {
            title: extension.displayName || node.title,
            type: extension.type || node.title,
          }
        : {}),
      ...(node.children ? { children: node.children.map(extend) } : {}),
    };
  };
  return rawDisplayData.map(extend);
};

const filterOutNonValue = ({
  aggregations,
  displayTreeData,
  extendedMapping,
}) => {
  const aggregationsWithValue = keys(aggregations).reduce((a, key) => {
    const keyHasValue =
      aggregations[key]?.buckets?.length > 0 ||
      aggregations[key]?.stats?.min ||
      aggregations[key]?.stats?.max;
    return {
      ...a,
      ...(keyHasValue ? { [key]: aggregations[key] } : {}),
    };
  }, {});
  const keysWithValue = keys(aggregationsWithValue);
  const doesDisplayNodeHaveValue = node => {
    return node.children
      ? node.children.filter(doesDisplayNodeHaveValue).length
      : keysWithValue.indexOf(node.path) > -1;
  };
  const applyFilterToDisplayNodeCollection = collection =>
    collection.filter(doesDisplayNodeHaveValue).map(
      node =>
        node.children
          ? {
              ...node,
              children: applyFilterToDisplayNodeCollection(node.children),
            }
          : node,
    );
  if (displayTreeData) {
    const displayTreeDataWithValue = applyFilterToDisplayNodeCollection(
      displayTreeData,
    );
    return {
      displayTreeDataWithValue,
      aggregationsWithValue,
      ...(extendedMapping
        ? {
            extendedMappingWithValue: extendedMapping?.filter?.(
              ({ field }) => aggregationsWithValue[field],
            ),
          }
        : {}),
    };
  } else {
    return {
      aggregationsWithValue,
      ...(extendedMapping
        ? {
            extendedMappingWithValue: extendedMapping?.filter?.(
              ({ field }) => aggregationsWithValue[field],
            ),
          }
        : {}),
    };
  }
};

export {
  filterOutNonValue,
  injectExtensionToElasticMapping,
  elasticMappingToDisplayTreeData,
};
