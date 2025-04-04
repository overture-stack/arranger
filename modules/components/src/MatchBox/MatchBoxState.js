import { debounce } from 'lodash-es';
import { Component } from 'react';

import { decorateFieldWithColumnsState } from '#QuickSearch/QuickSearchQuery.js';
import api from '#utils/api.js';

let matchBoxFields = `
  state {
    displayName
    fieldName
    isActive
    keyFieldName
    searchFields
  }
`;

class MatchBoxState extends Component {
	state = {
		extended: [],
		columnsState: {},
		matchBoxState: [],
		temp: [],
		err: null,
	};

	async componentDidMount() {
		const { onInitialLoaded = () => {} } = this.props;
		this.fetchMatchBoxState(this.props, onInitialLoaded);
	}

	UNSAFE_componentWillReceiveProps(next) {
		if (this.props.documentType !== next.documentType) {
			this.fetchMatchBoxState(next);
		}
	}

	fetchMatchBoxState = debounce(async ({ documentType }, onComplete = () => {}) => {
		try {
			let {
				data: {
					[documentType]: {
						extended,
						matchBoxState: { state: matchBoxState },
						columnsState: { state: columnsState },
					},
				},
			} = await api({
				endpoint: `/graphql`,
				body: {
					query: `{
						${documentType} {
							extended
								matchBoxState {
									${matchBoxFields}
								}
								columnsState {
									state {
										columns {
											fieldName
											query
											jsonPath
										}
									}
								}
							}
						}
					}`,
				},
			});

			this.setState(
				{
					matchBoxState,
					temp: matchBoxState,
					extended,
					columnsState,
					err: null,
				},
				() =>
					onComplete({
						activeFields: this.getActiveFields(),
					}),
			);
		} catch (err) {
			this.setState({ err });
		}
	}, 300);

	save = debounce(async (state) => {
		let { data } = await api({
			endpoint: `/graphql`,
			body: {
				variables: { state },
				query: `mutation($state: JSON!) {
					saveMatchBoxState(
						state: $state
						documentType: "${this.props.documentType}"
					) {
						${matchBoxFields}
					}
				}`,
			},
		});

		this.setState({
			matchBoxState: data.saveMatchBoxState.state,
			temp: data.saveMatchBoxState.state,
		});
	}, 300);

	update = ({ field, key, value }) => {
		let matchBoxField = this.state.temp.find((x) => x.field === field);
		let index = this.state.temp.findIndex((x) => x.field === field);
		let temp = Object.assign([], this.state.temp, {
			[index]: { ...matchBoxField, [key]: value },
		});
		this.setState({ temp }, () => this.save(temp));
	};

	getActiveFields = () =>
		this.state.temp
			?.filter((x) => x.isActive)
			?.map((x) => {
				return {
					...x,
					keyFieldName: {
						fieldName: x.keyFieldName,
						...decorateFieldWithColumnsState({
							columnsState: this.state.columnsState,
							field: x.keyFieldName,
						}),
					},
					searchFields: x.searchFields.map((y) => ({
						field: y,
						entityName: x.displayName,
						...decorateFieldWithColumnsState({
							columnsState: this.state.columnsState,
							field: y,
						}),
					})),
				};
			});

	render() {
		return this.props.render({
			update: this.update,
			matchBoxState: this.state.temp,
			primaryKeyField: this.state.extended?.find((x) => x.primaryKey),
			activeFields: this.getActiveFields(),
			extended: this.state.extended,
		});
	}
}

export default MatchBoxState;
