import { Component } from '@reach/component-component';
import { get } from 'lodash-es';
import PropTypes from 'prop-types';

import BooleanAgg from '#aggregations/Booleans/index.js';
import Query from '#Query.js';
import defaultApiFetcher from '#utils/api.js';

import { getOperationAtPath, setSqonAtPath, IN_OP } from '../utils.js';

import { FilterContainer } from './common.js';
import './FilterContainerStyle.css';

const getFieldDisplayName = (fieldDisplayNameMap, initialFieldSqon) => {
	return fieldDisplayNameMap[initialFieldSqon.content.fieldName] || initialFieldSqon.content.fieldName;
};

const AggsWrapper = ({ children }) => <div className="aggregation-group">{children}</div>;

export const BooleanFilterUI = (props) => {
	const {
		onSubmit = (sqon) => { },
		onCancel = () => { },
		ContainerComponent = FilterContainer,
		sqonPath = [],
		initialSqon = {},
		fieldName,
		fieldDisplayNameMap = {},
		buckets = [],
	} = props;

	const initialState = {
		localSqon: initialSqon,
	};

	const initialFieldSqon = getOperationAtPath(sqonPath)(initialSqon) || {
		op: IN_OP,
		content: { fieldName, value: [] },
	};

	const onSqonSubmit = (s) => () => onSubmit(s.state.localSqon);

	const onSelectionChange =
		(s) =>
			({ value }) => {
				setTimeout(() => {
					const newOp = {
						op: IN_OP,
						content: {
							fieldName,
							value: [value.key_as_string],
						},
					};

					s.setState({
						localSqon: setSqonAtPath(sqonPath, newOp)(s.state.localSqon),
					});
				}, 0);
			};

	const isActive =
		(s) =>
			({ value }) => {
				const op = getOperationAtPath(sqonPath)(s.state.localSqon);
				return value === (op && op.content.value[0]);
			};

	const fieldDisplayName = getFieldDisplayName(fieldDisplayNameMap, initialFieldSqon);

	return (
		<Component initialState={initialState}>
			{(s) => (
				<ContainerComponent onSubmit={onSqonSubmit(s)} onCancel={onCancel}>
					<>
						<div key="header" className="contentSection headerContainer">
							<span>{`${fieldDisplayName}?`}</span>
						</div>
						<div key="body" className="contentSection bodyContainer">
							<BooleanAgg
								WrapperComponent={AggsWrapper}
								fieldName={initialFieldSqon.content.fieldName}
								displayName={fieldDisplayName}
								buckets={buckets}
								defaultDisplayKeys={{
									true: 'Yes',
									false: 'No',
								}}
								handleValueClick={onSelectionChange(s)}
								isActive={isActive(s)}
							/>
						</div>
					</>
				</ContainerComponent>
			)}
		</Component>
	);
};

BooleanFilterUI.propTypes = {
	onSubmit: PropTypes.func,
	onCancel: PropTypes.func,
	ContainerComponent: PropTypes.func,
	sqonPath: PropTypes.array,
	initialSqon: PropTypes.object,
	fieldName: PropTypes.string.isRequired,
	fieldDisplayNameMap: PropTypes.object,
	buckets: PropTypes.array,
};

const BooleanFilter = (props) => {
	const {
		apiFetcher = defaultApiFetcher,
		arrangerIndex,
		initialSqon,
		executableSqon,
		sqonPath,
		fieldName,
		onSubmit,
		onCancel,
		fieldDisplayNameMap,
		opDisplayNameMap,
		ContainerComponent,
	} = props;

	const gqlField = fieldName.split('.').join('__');
	const query = `
		query($sqon: JSON){
			${arrangerIndex} {
				aggregations(filters: $sqon) {
					${gqlField} {
						buckets {
							key
							key_as_string
							doc_count
						}
					}
				}
			}
		}`;
	return (
		<Query
			apiFetcher={apiFetcher}
			query={query}
			variables={{ sqon: executableSqon }}
			render={({ data, loading, error }) => (
				<BooleanFilterUI
					ContainerComponent={({ children, ...props }) => (
						<ContainerComponent {...props} loading={loading}>
							{children}
						</ContainerComponent>
					)}
					fieldName={fieldName}
					initialSqon={initialSqon}
					onSubmit={onSubmit}
					onCancel={onCancel}
					sqonPath={sqonPath}
					fieldDisplayNameMap={fieldDisplayNameMap}
					opDisplayNameMap={opDisplayNameMap}
					buckets={data ? get(data, `${arrangerIndex}.aggregations.${gqlField}.buckets`) : []}
				/>
			)}
		/>
	);
};

export default BooleanFilter;
