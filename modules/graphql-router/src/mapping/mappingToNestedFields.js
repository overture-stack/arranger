import { capitalize } from 'lodash-es';

import { identityGraphqlNameRegistry } from './utils/graphqlNameRegistry.js';

// export default (type, mapping) =>
//   Object.entries(mapping)
//     .filter(([, metadata]) => !metadata.type || metadata.type === 'nested')
//     .map(
//       ([fieldName, metadata]) => `
//           ${fieldName}: ${!metadata.type
//         ? type + capitalize(fieldName)
//         : `[${type + capitalize(fieldName)}]`}
//         `,
//     )
/**
 * Builds one SDL field entry per nested/object ES field at this nesting level, referencing the
 * child type built for it (e.g. `biomarker: DonorBiomarker`). `registry` supplies the GraphQL-safe
 * name used both as the field name and as the child type name's own leaf segment.
 */
export default (type, mapping, parent, extendedFields, registry = identityGraphqlNameRegistry) =>
	Object.entries(mapping)
		.filter(([, metadata]) => (!metadata.type && metadata.properties) || metadata.type === 'nested')
		.map(([fieldName]) => {
			const fullFieldName = [parent, fieldName].filter(Boolean).join('.');
			const graphqlName = registry.toGraphqlLeafName(fullFieldName);

			return `
				${graphqlName}: ${type + capitalize(graphqlName)}
			`;
		});
