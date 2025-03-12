import { debounce, isEqual } from 'lodash-es';
import { Component } from 'react';

import { withData } from '#DataContext/index.js';
import esToAggTypeMap from '#utils/esToAggTypeMap.js';

import type { AggsStateProps } from './types.js';

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

class AggsState extends Component<AggsStateProps> {
	state: { aggs: any[]; temp: any[] } = { aggs: [], temp: [] };

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

	fetchAggsState = debounce(async ({ facetsConfigs }) => {
		try {
			const aggregations = facetsConfigs.aggregations || [];

			this.setState({
				aggs: aggregations,
				temp: aggregations,
			});
		} catch (error) {
			console.warn(error);
		}
	}, 300);

	// TODO: this function is broken as we removed Server configs from ES
	// however, leaving this here for documentation and follow-up on what to remove server-side
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
	//               isActive
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
		const agg = this.state.temp.find((x) => x.fieldName === fieldName);
		const index = this.state.temp.findIndex((x) => x.fieldName === fieldName);
		const temp = Object.assign([], this.state.temp, {
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
		const { temp } = this.state;

		return this.props.render({
			update: this.update,
			aggs: temp.map((agg) => {
				const type = esToAggTypeMap[agg.displayType];

				return {
					...agg,
					type,
					query: queryFromAgg({
						...agg,
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
