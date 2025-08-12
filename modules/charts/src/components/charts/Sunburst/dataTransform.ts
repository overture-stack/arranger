import { GQLDataMap } from '#components/Provider/Provider';
import { ARRANGER_MISSING_DATA_KEY } from '#constants';
import { aggregationsTypenames, ArrangerAggregations } from '#shared';
import { ChartConfig } from './useValidateInput';

type SunburstNode = {
	id: string;
	parent?: string;
	value?: number;
	children?: SunburstNode[];
};

type SunburstChartConfig = ChartConfig & {
	mapping: Record<string, string>;
};

/**
 * Resolves GraphQL aggregation buckets based on the aggregation type.
 * Handles different GraphQL response structures for categorical vs numeric data.
 */
const resolveBuckets = ({ aggregations }: { aggregations: ArrangerAggregations }) => {
	switch (aggregations.__typename) {
		case aggregationsTypenames.Aggregations:
			return aggregations.buckets;
		case aggregationsTypenames.NumericAggregations:
			return aggregations.range?.buckets || [];
		default:
			return [];
	}
};

/**
 * Creates internal bidirectional mapping from simple user mapping.
 * Transforms { childValue: 'parentCategory' } into structured parent-child relationships.
 */
const createInternalMapping = (userMapping: Record<string, string>) => {
	const parents = new Map<string, { id: string; children: string[] }>();
	const children = new Map<string, { id: string; parent: string }>();

	// Build parent-child relationships from user mapping
	Object.entries(userMapping).forEach(([childValue, parentCategory]) => {
		// Handle missing data mapping
		const parentId = parentCategory === ARRANGER_MISSING_DATA_KEY ? 'No Data' : parentCategory;
		const childId = childValue === ARRANGER_MISSING_DATA_KEY ? 'No Data' : childValue;

		// Add to children mapping
		children.set(childId, { id: childId, parent: parentId });

		// Add to parents mapping
		if (!parents.has(parentId)) {
			parents.set(parentId, { id: parentId, children: [] });
		}
		parents.get(parentId)!.children.push(childId);
	});

	return { parents, children };
};

/**
 * Groups child data under their mapped parent categories.
 * Handles unmapped data by creating "Other" category.
 */
const groupChildrenByParent = (
	childBuckets: any[],
	internalMapping: ReturnType<typeof createInternalMapping>
) => {
	const grouped = new Map<string, { parent: string; children: any[] }>();
	const unmappedChildren: any[] = [];

	childBuckets.forEach(bucket => {
		const childMapping = internalMapping.children.get(bucket.key);
		
		if (childMapping) {
			const parentId = childMapping.parent;
			
			if (!grouped.has(parentId)) {
				grouped.set(parentId, { parent: parentId, children: [] });
			}
			
			grouped.get(parentId)!.children.push({
				...bucket,
				parentId
			});
		} else {
			unmappedChildren.push(bucket);
		}
	});

	// Add unmapped children to "Other" category
	if (unmappedChildren.length > 0) {
		grouped.set('Other', { 
			parent: 'Other', 
			children: unmappedChildren.map(bucket => ({
				...bucket,
				parentId: 'Other'
			}))
		});
	}

	return grouped;
};

/**
 * Creates a data transformation function for converting GraphQL responses to sunburst format.
 * Handles hierarchical data creation from multiple fields using user-provided mapping.
 *
 * @param config - Chart configuration including fieldNames and mapping
 * @returns Function that transforms GraphQL data to hierarchical sunburst format
 */
export const createSunburstTransform =
	({ fieldNames, mapping, query }: SunburstChartConfig) =>
	({ gqlData }: { gqlData: GQLDataMap }): SunburstNode | null => {
		if (!gqlData || fieldNames.length < 2) {
			return null;
		}

		const [parentFieldName, childFieldName] = fieldNames;
		
		// Get buckets from both fields
		const parentAggregations = gqlData[parentFieldName];
		const childAggregations = gqlData[childFieldName];
		
		const parentBuckets = resolveBuckets({ aggregations: parentAggregations });
		const childBuckets = resolveBuckets({ aggregations: childAggregations });

		// Create internal mapping structure
		const internalMapping = createInternalMapping(mapping);

		// Group children under their mapped parents
		const groupedChildren = groupChildrenByParent(childBuckets, internalMapping);

		// Create parent nodes with their children
		const parentNodes: SunburstNode[] = [];

		// Process parent buckets to get actual values from parent field
		parentBuckets.forEach(parentBucket => {
			const parentKey = parentBucket.key === ARRANGER_MISSING_DATA_KEY ? 'No Data' : parentBucket.key;
			const groupedData = groupedChildren.get(parentKey);

			if (groupedData) {
				const children: SunburstNode[] = groupedData.children.map(child => ({
					id: child.key === ARRANGER_MISSING_DATA_KEY ? 'No Data' : child.key,
					parent: parentKey,
					value: child.doc_count
				}));

				parentNodes.push({
					id: parentKey,
					value: parentBucket.doc_count, // Use parent field's own doc_count
					children
				});
			}
		});

		// Add "Other" category if it exists (unmapped children)
		const otherGroup = groupedChildren.get('Other');
		if (otherGroup) {
			const otherChildren: SunburstNode[] = otherGroup.children.map(child => ({
				id: child.key === ARRANGER_MISSING_DATA_KEY ? 'No Data' : child.key,
				parent: 'Other',
				value: child.doc_count
			}));

			const otherValue = otherChildren.reduce((sum, child) => sum + (child.value || 0), 0);
			
			parentNodes.push({
				id: 'Other',
				value: otherValue,
				children: otherChildren
			});
		}

		// Create root node
		const rootValue = parentNodes.reduce((sum, parent) => sum + (parent.value || 0), 0);
		
		const rootNode: SunburstNode = {
			id: 'root',
			value: rootValue,
			children: parentNodes
		};

		// Apply custom transform if provided
		return (query?.transformData && query.transformData(rootNode)) || rootNode;
	};