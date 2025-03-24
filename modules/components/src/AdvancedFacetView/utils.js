import { keys, orderBy, partition } from 'lodash-es';

import strToReg from '../utils/strToReg.js';

const elasticMappingToDisplayTreeData = (elasticMapping, parentPath) => {
	const mappingKeys = Object.keys(elasticMapping);
	return mappingKeys.map((key) => {
		const fieldProps = elasticMapping[key];
		const currentPath = parentPath ? `${parentPath}.${key}` : `${key}`;
		return {
			title: key,
			path: currentPath,
			id: `${key}`,
			...(fieldProps.properties
				? {
						children: elasticMappingToDisplayTreeData(fieldProps.properties, currentPath),
					}
				: {}),
		};
	});
};

const injectExtensionToElasticMapping = ({ elasticMapping, extendedMapping, rootTypeName }) => {
	const rawDisplayData = elasticMappingToDisplayTreeData(elasticMapping);
	const extend = (node) => {
		const extension = extendedMapping.find((x) => x.field === node.path);
		return {
			...node,
			...(extension && {
				title: extension.displayName || node.title,
				type: extension.type || node.title,
			}),
			...(node.children && { children: node.children.map(extend) }),
		};
	};
	const [rootFields, nestedFields] = partition(rawDisplayData.map(extend), (x) => !x.children);
	return [...[{ title: rootTypeName || 'Root', children: rootFields, isRoot: true }], ...nestedFields];
};

const gatherAllNodes = (keysWithValue) => {
	const doesDisplayNodeHaveValue = (node) => {
		return node.children ? node.children.filter(doesDisplayNodeHaveValue).length : keysWithValue.includes(node.path);
	};

	return doesDisplayNodeHaveValue;
};

const applyFilterToDisplayNodeCollection = (collection, keysWithValue) => {
	const doesDisplayNodeHaveValue = gatherAllNodes(keysWithValue);
	return collection.filter(doesDisplayNodeHaveValue).map((node) => ({
		...node,
		...(node.children && {
			children: applyFilterToDisplayNodeCollection(node.children),
		}),
	}));
};

const filterOutNonValue = ({ aggregations, displayTreeData = {}, extendedMapping = {} }) => {
	const aggregationsWithValue = keys(aggregations).reduce((a, key) => {
		const keyHasValue =
			aggregations[key]?.buckets?.filter((x) => (x.key_as_string || x.key) !== '__missing__')?.length > 0 ||
			aggregations[key]?.stats?.min ||
			aggregations[key]?.stats?.max;

		return {
			...a,
			...(keyHasValue ? { [key]: aggregations[key] } : {}),
		};
	}, {});

	const keysWithValue = keys(aggregationsWithValue);

	return {
		aggregationsWithValue,
		...(displayTreeData && {
			displayTreeDataWithValue: applyFilterToDisplayNodeCollection(displayTreeData, keysWithValue),
		}),
		...(extendedMapping && {
			extendedMappingWithValue: extendedMapping?.filter?.((x) => aggregationsWithValue[x.field]),
		}),
	};
};

const orderDisplayTreeData = (displayTreeData) => [
	...orderBy(
		displayTreeData.filter((x) => !x.children || x.isRoot),
		'title',
	),
	...orderBy(
		displayTreeData
			.filter((x) => !!x.children && !x.isRoot)
			.map(({ children, ...rest }) => ({
				...rest,
				children: orderDisplayTreeData(children),
			})),
		'title',
	),
];

const filterDisplayTreeDataBySearchTerm = ({ displayTree, searchTerm, aggregations }) => {
	const shouldBeIncluded = ({ title, path, children }) => {
		const inTitle = title.match(strToReg(searchTerm));
		const inBuckets = aggregations[path]?.buckets?.some((x) => (x.key_as_string || x.key).match(strToReg(searchTerm)));
		const inChildren = children && children.some(shouldBeIncluded);
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
