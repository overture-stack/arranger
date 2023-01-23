import { Component } from 'react';
import { debounce, get, isEqual, sortBy } from 'lodash';

import { withData } from '@/DataContext';

import defaultApiFetcher from '../utils/api';
import esToAggTypeMap from '../utils/esToAggTypeMap';

export const queryFromAgg = ({ fieldName, type }) =>
	type === 'Aggregations'
		? `
			${fieldName} {
				buckets {
					doc_count
					key_as_string
					key
				}
			}
		`
		: `
			${fieldName} {
				stats {
					max
					min
					count
					avg
					sum
				}
			}
		`;

const getMappingTypeOfField = ({ mapping = {}, fieldName = '' }) => {
	const mappingPath = fieldName?.split?.('__')?.join?.('.properties.');
	const fieldType = get(mapping, mappingPath)?.type;

	return esToAggTypeMap[fieldType];
};

class AggsState extends Component {
	state = { aggs: [], temp: [] };

	componentDidUpdate(prev) {
		if (
			!(
				isEqual(this.props.documentType, prev.documentType) &&
				isEqual(this.props.facetsConfigs, prev.facetsConfigs) &&
				this.props.facetsConfigs?.aggregations?.length === this.state.aggs.length
			)
		) {
			this.fetchAggsState(this.props);
		}
	}

	fetchAggsState = debounce(async ({ facetsConfigs, documentMapping }) => {
		try {
			const aggregations = facetsConfigs.aggregations || [];

			this.setState({
				aggs: aggregations,
				temp: aggregations,
				mapping: documentMapping,
			});
		} catch (error) {
			console.warn(error);
		}
	}, 300);

	// TODO: this function is likely broken as we remove mutation from Server
	// however, leaving this here for documentation and follow-up
	// save = debounce(async (state) => {
	//   const { apiFetcher = defaultApiFetcher } = this.props;
	//   let { data } = await apiFetcher({
	//     endpoint: `/graphql`,
	//     body: {
	//       variables: { state },
	//       query: `
	//         mutation($state: JSON!) {
	//           saveAggsState(
	//             state: $state
	//             documentType: "${this.props.documentType}"
	//           ) {
	//             state {
	//               field
	//               show
	//               active
	//             }
	//           }
	//         }
	//       `,
	//     },
	//   });

	//   this.setState({
	//     aggs: data.saveAggsState.state,
	//     temp: data.saveAggsState.state,
	//   });
	// }, 300);

	update = ({ fieldName, key, value }) => {
		let agg = this.state.temp.find((x) => x.fieldName === fieldName);
		let index = this.state.temp.findIndex((x) => x.fieldName === fieldName);
		let temp = Object.assign([], this.state.temp, {
			[index]: { ...agg, [key]: value },
		});
		// commented out to study later
		// this.setState({ temp }, () => this.save(temp));
		this.setState({ temp });
	};

	// saveOrder = (orderedFields) => {
	//   const aggs = this.state.temp;
	//   if (
	//     orderedFields.every((field) => aggs.find((agg) => agg.field === field)) &&
	//     aggs.every((agg) => orderedFields.find((field) => field === agg.field))
	//   ) {
	//     this.save(sortBy(aggs, (agg) => orderedFields.indexOf(agg.field)));
	//   } else {
	//     console.warn('provided orderedFields are not clean: ', orderedFields);
	//   }
	// };

	render() {
		const { mapping, temp } = this.state;

		return this.props.render({
			update: this.update,
			aggs: temp.map((x) => {
				const type = getMappingTypeOfField({ fieldName: x.fieldName, mapping }) || x.type;

				return {
					...x,
					type,
					query: queryFromAgg({
						...x,
						type,
					}),
					isTerms: type === 'Aggregations',
				};
			}),
			// saveOrder: this.saveOrder,
		});
	}
}

export default withData(AggsState);
