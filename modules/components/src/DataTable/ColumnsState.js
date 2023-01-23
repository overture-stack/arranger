import { Component } from 'react';
import { debounce, sortBy } from 'lodash';

import { withData } from '@/DataContext';
import { columnStateFields } from '@/DataContext/dataQueries';

class ColumnsState extends Component {
	constructor(props) {
		super(props);
		this.state = {
			toggled: {},
		};
	}

	getStorageKey() {
		return `arranger-columnstate-toggled-${this.props.storageKey || ''}`;
	}

	getStoredToggled() {
		if (this.props.sessionStorage) {
			const storedColumnSelections = window.sessionStorage.getItem(this.getStorageKey()) || '{}';
			return JSON.parse(storedColumnSelections);
		} else {
			return {};
		}
	}

	async componentDidMount() {
		this.fetchColumnsState(this.props);
	}

	UNSAFE_componentWillReceiveProps(next) {
		if (this.props.documentType !== next.documentType) {
			this.fetchColumnsState(next);
		}
	}

	fetchColumnsState = debounce(async () => {
		try {
			const toggled = this.getStoredToggled();

			this.setState({ toggled });
		} catch (e) {
			console.warn(e);
			// this.setState({ })
		}
	}, 300);

	save = debounce(async (state) => {
		const { apiFetcher, documentType } = this.props;
		let { data } = await apiFetcher({
			endpoint: `/graphql`,
			body: {
				variables: { state },
				query: `
        mutation($state: JSON!) {
          saveColumnsState(
            state: $state
            documentType: "${documentType}"
          ) {
            ${columnStateFields}
          }
        }
      `,
			},
		});
		this.setState({
			config: data.saveColumnsState.state,
		});
	}, 300);

	update = ({ fieldName, key, value }) => {
		let index = this.state.config.columns.findIndex((x) => x.fieldName === fieldName);
		let column = this.state.config.columns[index];
		let temp = {
			...this.state.config,
			columns: Object.assign([], this.state.config.columns, {
				[index]: { ...column, [key]: value },
			}),
		};

		this.setState({ temp }, () => this.save(temp));
	};

	add = (column) => {
		const { id } = column;
		let existing = this.state.config.columns.find((x) => x.id === id);
		if (existing) return;
		let temp = {
			...this.state.config,
			columns: [...this.state.config.columns, column],
		};

		this.setState({ temp }, () => this.save(temp));
	};

	setColumnSelections(toggled) {
		this.setState({ toggled });
		if (this.props.sessionStorage) {
			window.sessionStorage.setItem(this.getStorageKey(), JSON.stringify(toggled));
		}
	}

	toggle = ({ fieldName, show }) => {
		const toggled = { ...this.state.toggled, [fieldName]: show };
		this.setColumnSelections(toggled);
	};

	toggleMultiple = (changes) => {
		const toggled = { ...this.state.toggled, ...changes };
		this.setColumnSelections(toggled);
	};

	saveOrder = (orderedFields) => {
		let { tableConfigs = { columns: [] } } = this.props;
		const { columns } = tableConfigs;
		if (
			orderedFields.every((field) => columns.find((column) => column.field === field)) &&
			columns.every((column) => orderedFields.find((field) => field === column.field))
		) {
			this.save({
				...tableConfigs,
				columns: sortBy(columns, ({ fieldName }) => orderedFields.indexOf(fieldName)),
			});
		} else {
			console.warn('provided orderedFields are not clean: ', orderedFields);
		}
	};

	render() {
		let { tableConfigs = { columns: [] }, isLoadingConfigs } = this.props;
		let { toggled } = this.state;

		return this.props.render(
			isLoadingConfigs
				? { loading: true, state: {} }
				: {
						loading: false,
						update: this.update,
						add: this.add,
						toggle: this.toggle,
						toggleMultiple: this.toggleMultiple,
						saveOrder: this.saveOrder,
						state: {
							...tableConfigs,
							columns: tableConfigs?.columns?.map((column) => {
								return {
									...column,
									Header: column.displayName,
									show:
										column.field in toggled
											? toggled[column.field]
											: column.acessor in toggled
											? toggled[column.accessor]
											: column.show,
								};
							}),
							defaultColumns: tableConfigs?.columns?.filter((column) => column.show),
						},
				  },
		);
	}
}

export default withData(ColumnsState);
