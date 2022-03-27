import { Component } from 'react';
import { debounce, sortBy } from 'lodash';

import { withData } from '@/DataContext';

let columnFields = `
  state {
    type
    keyField
    defaultSorted {
      id
      desc
    }
    columns {
      field
      accessor
      show
      type
      sortable
      canChangeShow
      query
      jsonPath
    }
  }
`;

class ColumnsState extends Component {
  constructor(props) {
    super(props);
    this.state = {
      config: null,
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
    if (this.props.graphqlField !== next.graphqlField) {
      this.fetchColumnsState(next);
    }
  }

  fetchColumnsState = debounce(async ({ graphqlField }) => {
    const { apiFetcher } = this.props;
    try {
      let { data } = await apiFetcher({
        endpoint: `/graphql/columnsStateQuery`,
        body: {
          query: `query columnsStateQuery
            {
              ${graphqlField} {
                columnsState {
                  ${columnFields}
                }
              }
            }
          `,
        },
      });

      const config = data[graphqlField].columnsState.state;
      const toggled = this.getStoredToggled();

      this.setState({
        config,
        toggled,
      });
    } catch (e) {
      console.warn(e);
      // this.setState({ })
    }
  }, 300);

  save = debounce(async (state) => {
    const { apiFetcher } = this.props;
    let { data } = await apiFetcher({
      endpoint: `/graphql`,
      body: {
        variables: { state },
        query: `
        mutation($state: JSON!) {
          saveColumnsState(
            state: $state
            graphqlField: "${this.props.graphqlField}"
          ) {
            ${columnFields}
          }
        }
      `,
      },
    });
    this.setState({
      config: data.saveColumnsState.state,
    });
  }, 300);

  update = ({ field, key, value }) => {
    let index = this.state.config.columns.findIndex((x) => x.field === field);
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

  toggle = ({ field, show }) => {
    const toggled = { ...this.state.toggled, [field]: show };
    this.setColumnSelections(toggled);
  };

  toggleMultiple = (changes) => {
    const toggled = { ...this.state.toggled, ...changes };
    this.setColumnSelections(toggled);
  };

  saveOrder = (orderedFields) => {
    const columns = this.state.config.columns;
    if (
      orderedFields.every((field) => columns.find((column) => column.field === field)) &&
      columns.every((column) => orderedFields.find((field) => field === column.field))
    ) {
      this.save({
        ...this.state.config,
        columns: sortBy(columns, ({ field }) => orderedFields.indexOf(field)),
      });
    } else {
      console.warn('provided orderedFields are not clean: ', orderedFields);
    }
  };

  render() {
    let { extendedMapping = [] } = this.props;
    let { config, toggled } = this.state;
    return config
      ? this.props.render({
          loading: false,
          update: this.update,
          add: this.add,
          toggle: this.toggle,
          toggleMultiple: this.toggleMultiple,
          saveOrder: this.saveOrder,
          state: {
            ...config,
            columns: config.columns.map((column) => {
              const extendedField = extendedMapping.find((e) => e.field === column.field);

              return {
                ...column,
                Header: extendedField?.displayName || column.field,
                extendedType: extendedField?.type,
                show: column.field in toggled ? toggled[column.field] : column.show,
                extendedDisplayValues: extendedField?.displayValues,
              };
            }),
            defaultColumns: config.columns.filter((column) => column.show),
          },
        })
      : this.props.render({ loading: true, state: { config: null } });
  }
}

export default withData(ColumnsState);
