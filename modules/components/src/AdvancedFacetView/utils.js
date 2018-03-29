import { keys, orderBy } from 'lodash';
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

const orderDisplayTreeData = displayTreeData => [
  ...orderBy(displayTreeData.filter(({ children }) => !children), 'title'),
  ...orderBy(
    displayTreeData
      .filter(({ children }) => children)
      .map(({ children, ...rest }) => ({
        ...rest,
        children: orderDisplayTreeData(children),
      })),
    'title',
  ),
];

const filterDisplayTreeDataBySearchTerm = ({
  displayTree,
  searchTerm,
  aggregations,
}) => {
  const shouldBeIncluded = node => {
    const inTitle = node.title.match(new RegExp(searchTerm, 'i'));
    const inBuckets = aggregations[node.path]?.buckets?.some(
      ({ key_as_string, key }) =>
        (key_as_string || key).match(new RegExp(searchTerm, 'i')),
    );
    const inChildren = node.children && node.children.some(shouldBeIncluded);
    return inTitle || inBuckets || inChildren;
  };

  return searchTerm && searchTerm.length
    ? displayTree?.filter(shouldBeIncluded).map(({ children, ...rest }) => ({
        ...rest,
        children: filterDisplayTreeDataBySearchTerm({
          displayTree: children,
          searchTerm,
          aggregations,
        }),
      }))
    : displayTree;
};

export {
  filterOutNonValue,
  injectExtensionToElasticMapping,
  elasticMappingToDisplayTreeData,
  orderDisplayTreeData,
  filterDisplayTreeDataBySearchTerm,
};
