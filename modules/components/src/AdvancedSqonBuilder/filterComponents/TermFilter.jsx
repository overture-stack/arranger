import { Component } from '@reach/component-component';
import { sortBy, get } from 'lodash-es';

import TermAgg from '#aggregations/TermAgg.js';
import Query from '#Query.js';
import { inCurrentSQON } from '#SQONViewer/utils.js';
import TextFilter from '#TextFilter/index.js';
import defaultApiFetcher from '#utils/api.js';
import noopFn from '#utils/noops.js';

import { getOperationAtPath, setSqonAtPath, FIELD_OP_DISPLAY_NAME, TERM_OPS, IN_OP, AND_OP } from '../utils.js';

import { FilterContainer } from './common.js';
import './FilterContainerStyle.css';

const AggsWrapper = ({ children }) => <div className="aggregation-group">{children}</div>;

const filterStringsCaseInsensitive = (values, searchString, path = null) =>
	values.filter((val) => {
		const valText = path ? get(val, path) : val;
		return -1 !== valText.search(new RegExp(searchString, 'i'));
	});

export const TermFilterUI = (props) => {
	const {
		initialSqon = null,
		onSubmit = (sqon) => { },
		onCancel = noopFn,
		ContainerComponent = FilterContainer,
		InputComponent = TextFilter,
		sqonPath = [],
		buckets,
		fieldDisplayNameMap = {},
		opDisplayNameMap = FIELD_OP_DISPLAY_NAME,
		fieldName,
	} = props;

	const initialFieldSqon = getOperationAtPath(sqonPath)(initialSqon) || {
		op: IN_OP,
		content: { value: [], fieldName },
	};
	const initialState = { searchString: '', localSqon: initialSqon };
	const onSearchChange = (s) => (e) => {
		s.setState({ searchString: e.value });
	};
	const isFilterActive = (s) => (field) =>
		inCurrentSQON({
			value: field.value,
			dotFieldName: field.fieldName,
			currentSQON: getOperationAtPath(sqonPath)(s.state.localSqon),
		});
	const getCurrentFieldOp = (s) => getOperationAtPath(sqonPath)(s.state.localSqon);
	const onSqonSubmit = (s) => () => onSubmit(s.state.localSqon);
	const computeBuckets = (s, buckets) =>
		sortBy(
			filterStringsCaseInsensitive(buckets, s.state.searchString, 'key'),
			(bucket) =>
				!inCurrentSQON({
					value: bucket.key,
					dotFieldName: initialFieldSqon.content.fieldName,
					currentSQON: getOperationAtPath(sqonPath)(initialSqon),
				}),
		);
	const onOptionTypeChange = (s) => (e) => {
		const currentFieldSqon = getCurrentFieldOp(s);
		s.setState({
			localSqon: setSqonAtPath(sqonPath, {
				...currentFieldSqon,
				op: e.target.value,
			})(s.state.localSqon),
		});
	};
	const onSelectAllClick = (s) => () => {
		const currentFieldSqon = getCurrentFieldOp(s);
		s.setState({
			localSqon: setSqonAtPath(sqonPath, {
				...currentFieldSqon,
				content: {
					...currentFieldSqon.content,
					value: filterStringsCaseInsensitive(
						buckets.map(({ key }) => key),
						s.state.searchString,
					),
				},
			})(s.state.localSqon),
		});
	};
	const onClearClick = (s) => () => {
		const currentFieldSqon = getCurrentFieldOp(s);
		s.setState({
			localSqon: setSqonAtPath(sqonPath, {
				...currentFieldSqon,
				content: {
					...currentFieldSqon.content,
					value: [],
				},
			})(s.state.localSqon),
		});
	};
	const onFilterClick =
		(s) =>
			({ generateNextSQON }) => {
				setTimeout(() => {
					// state change in the same tick somehow results in this component dismounting (probably  something to do with TermAgg's click event, needs investigation)
					const deltaSqon = generateNextSQON();
					const deltaFiterObjContentValue = deltaSqon.content[0].content.value;
					// we're only interested in the new field operation's content value
					const currentFieldSqon = getCurrentFieldOp(s);
					const existingValue = (currentFieldSqon.content.value || []).find((v) => deltaFiterObjContentValue.includes(v));
					const newFieldSqon = {
						...currentFieldSqon,
						content: {
							...currentFieldSqon.content,
							value: [
								...(currentFieldSqon.content.value || []).filter((v) => v !== existingValue),
								...(existingValue ? [] : deltaFiterObjContentValue),
							],
						},
					};
					s.setState({
						localSqon: setSqonAtPath(sqonPath, newFieldSqon)(s.state.localSqon),
					});
				}, 0);
			};
	return (
		<Component initialState={initialState}>
			{(s) => (
				<ContainerComponent onSubmit={onSqonSubmit(s)} onCancel={onCancel}>
					<div className="contentSection">
						<span>{fieldDisplayNameMap[initialFieldSqon.content.fieldName] || initialFieldSqon.content.fieldName}</span>{' '}
						is{' '}
						<span className="select">
							<select onChange={onOptionTypeChange(s)} value={getCurrentFieldOp(s).op}>
								{TERM_OPS.map((option) => (
									<option key={option} value={option}>
										{opDisplayNameMap[option]}
									</option>
								))}
							</select>
						</span>
					</div>
					<div className="contentSection searchInputContainer">
						<InputComponent value={s.state.searchString} onChange={onSearchChange(s)} />
					</div>
					<div className="contentSection termFilterActionContainer">
						<span className={`aggsFilterAction selectAll`} onClick={onSelectAllClick(s)}>
							Select All
						</span>
						<span className={`aggsFilterAction clear`} onClick={onClearClick(s)}>
							Clear
						</span>
					</div>
					<div className="contentSection termAggContainer">
						<TermAgg
							WrapperComponent={AggsWrapper}
							field={initialFieldSqon.content.field}
							displayName="Disease Type"
							buckets={computeBuckets(s, buckets)}
							handleValueClick={onFilterClick(s)}
							isActive={isFilterActive(s)}
							maxTerms={5}
						/>
					</div>
				</ContainerComponent>
			)}
		</Component>
	);
};

const TermFilter = (props) => {
	const {
		fieldName,
		arrangerIndex,
		apiFetcher = defaultApiFetcher,
		executableSqon = {
			op: AND_OP,
			content: [],
		},

		initialSqon = null,
		onSubmit = (sqon) => { },
		onCancel = () => { },
		ContainerComponent = FilterContainer,
		InputComponent = TextFilter,
		sqonPath = [],
		fieldDisplayNameMap = {},
		opDisplayNameMap = FIELD_OP_DISPLAY_NAME,
	} = props;

	const gqlField = fieldName.split('.').join('__');
	const query = `
		query($sqon: JSON){
			${arrangerIndex} {
				aggregations(filters: $sqon) {
					${gqlField} {
						buckets {
							key
							doc_count
						}
					}
				}
			}
		}`;

	return (
		<Query
			variables={{ sqon: executableSqon }}
			apiFetcher={apiFetcher}
			query={query}
			render={({ data, loading, error }) => (
				<TermFilterUI
					ContainerComponent={({ children, ...props }) => (
						<ContainerComponent {...props} loading={loading}>
							{children}
						</ContainerComponent>
					)}
					fieldName={fieldName}
					initialSqon={initialSqon}
					onSubmit={onSubmit}
					onCancel={onCancel}
					InputComponent={InputComponent}
					sqonPath={sqonPath}
					fieldDisplayNameMap={fieldDisplayNameMap}
					opDisplayNameMap={opDisplayNameMap}
					buckets={data ? get(data, `${arrangerIndex}.aggregations.${gqlField}.buckets`) : []}
				/>
			)}
		/>
	);
};

export default TermFilter;
