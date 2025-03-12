import { Component } from '@reach/component-component';
// import PropTypes from 'prop-types';

import defaultApiFetcher, { fetchExtendedMapping } from './api.js';

const memoHash = {};
const memoizedExtendedMapping = ({ documentType, apiFetcher }) => {
	if (!memoHash[documentType]) {
		memoHash[documentType] = fetchExtendedMapping({ documentType, apiFetcher });
	}
	return memoHash[documentType];
};

const memoizedExtendedMappingField = ({ contentField, documentType, apiFetcher }) => {
	const key = `${documentType}/${contentField}`;
	if (!memoHash[key]) {
		memoHash[key] = memoizedExtendedMapping({
			documentType,
			apiFetcher,
		}).then(({ extendedMapping }) => extendedMapping.filter(({ field }) => field === contentField));
	}
	return memoHash[key];
};

const ExtendedMappingProvider = ({
	documentType,
	apiFetcher = defaultApiFetcher,
	useCache = true,
	field: contentField,
	children,
}) => {
	const initialState = { loading: true, extendedMapping: undefined };
	const didMount = async (s) => {
		if (contentField) {
			const extendedMapping = !useCache
				? await fetchExtendedMapping({
					documentType,
					apiFetcher,
				}).then(({ extendedMapping }) =>
					extendedMapping.filter(({ field }) => {
						return field === contentField;
					}),
				)
				: await memoizedExtendedMappingField({
					documentType,
					apiFetcher,
					contentField,
				});
			s.setState({ loading: false, extendedMapping: extendedMapping });
		} else {
			const { extendedMapping } = !useCache
				? await fetchExtendedMapping({
					documentType,
					apiFetcher,
				})
				: await memoizedExtendedMapping({
					documentType,
					apiFetcher,
				});
			s.setState({ loading: false, extendedMapping: extendedMapping });
		}
	};
	return (
		<Component initialState={initialState} didMount={didMount}>
			{(s) => children({ ...s.state })}
		</Component>
	);
};

// ExtendedMappingProvider.prototype = {
// 	apiFetcher: PropTypes.func,
// 	useCache: PropTypes.bool,
// 	field: PropTypes.string,
// 	documentType: PropTypes.string.isRequired,
// 	children: PropTypes.func.isRequired,
// };

export default ExtendedMappingProvider;
