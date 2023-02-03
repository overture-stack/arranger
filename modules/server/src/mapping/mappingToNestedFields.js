import { capitalize } from 'lodash';

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
export default (type, mapping) =>
	Object.entries(mapping)
		.filter(([, metadata]) => (!metadata.type && metadata.properties) || metadata.type === 'nested')
		.map(
			([fieldName, metadata]) => `
				${fieldName}: ${type + capitalize(fieldName)}
			`,
		);
