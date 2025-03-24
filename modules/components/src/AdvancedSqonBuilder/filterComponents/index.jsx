import { default as defaultApiFetcher } from '#utils/api.js';
import ExtendedMappingProvider from '#utils/ExtendedMappingProvider.js';

import BooleanFilter from './BooleanFilter.js';
import { FilterContainer } from './common.js';
import RangeFilter from './RangeFilter.js';
import TermFilter from './TermFilter.js';

const FieldOpModifier = ({
	sqonPath,
	initialSqon,
	onSubmit,
	onCancel,
	fieldDisplayNameMap,
	opDisplayNameMap,
	ContainerComponent = FilterContainer,
	apiFetcher = defaultApiFetcher,
	field,
	arrangerIndex,
	getExecutableSqon = () => initialSqon,
}) => (
	<ExtendedMappingProvider apiFetcher={apiFetcher} documentType={arrangerIndex} field={field}>
		{({ loading, extendedMapping }) => {
			const fieldExtendedMapping = (extendedMapping || []).find(({ field: _field }) => field === _field);

			// temporary, needs to handle errors too
			const { type, unit } = fieldExtendedMapping || {};
			return ['keyword', 'id', 'string', 'text'].includes(type) ? (
				<TermFilter
					field={field}
					arrangerIndex={arrangerIndex}
					apiFetcher={apiFetcher}
					loading={loading}
					sqonPath={sqonPath}
					initialSqon={initialSqon}
					executableSqon={getExecutableSqon()}
					onSubmit={onSubmit}
					onCancel={onCancel}
					fieldDisplayNameMap={fieldDisplayNameMap}
					opDisplayNameMap={opDisplayNameMap}
					ContainerComponent={ContainerComponent}
				/>
			) : [
				'byte',
				'date',
				'double',
				'float',
				'half_float',
				'integer',
				'long',
				'scaled_float',
				'unsigned_long',
			].includes(type) ? (
				<RangeFilter
					field={field}
					loading={loading}
					sqonPath={sqonPath}
					initialSqon={initialSqon}
					executableSqon={getExecutableSqon()}
					onSubmit={onSubmit}
					onCancel={onCancel}
					fieldDisplayNameMap={fieldDisplayNameMap}
					opDisplayNameMap={opDisplayNameMap}
					ContainerComponent={ContainerComponent}
					unit={unit}
				/>
			) : ['boolean'].includes(type) ? (
				<BooleanFilter
					field={field}
					apiFetcher={apiFetcher}
					arrangerIndex={arrangerIndex}
					sqonPath={sqonPath}
					initialSqon={initialSqon}
					executableSqon={getExecutableSqon()}
					onSubmit={onSubmit}
					onCancel={onCancel}
					fieldDisplayNameMap={fieldDisplayNameMap}
					opDisplayNameMap={opDisplayNameMap}
					ContainerComponent={ContainerComponent}
				/>
			) : (
				<ContainerComponent onSubmit={onSubmit} onCancel={onCancel}>
					{/* Placeholder for unhandled types */}
					<div className="unhandledFieldType">Unhandled field type: {type}</div>
				</ContainerComponent>
			);
		}}
	</ExtendedMappingProvider>
);

// FieldOpModifier.prototype = {
// 	sqonPath: PropTypes.arrayOf(PropTypes.number),
// 	initialSqon: PropTypes.object,
// 	onSubmit: PropTypes.func,
// 	onCancel: PropTypes.func,
// 	fieldDisplayNameMap: PropTypes.objectOf(PropTypes.string),
// 	opDisplayNameMap: PropTypes.objectOf(PropTypes.string),
// 	ContainerComponent: PropTypes.any,
// 	apiFetcher: PropTypes.func,
// 	field: PropTypes.string,
// 	arrangerIndex: PropTypes.string.isRequired,
// 	getExecutableSqon: PropTypes.func,
// };

export default FieldOpModifier;

export { default as TermFilter } from './TermFilter.js';
export { default as RangeFilter } from './RangeFilter.js';
export { default as BooleanFilter } from './BooleanFilter.js';