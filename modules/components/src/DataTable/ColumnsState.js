import { Component } from 'react';
import { debounce, sortBy } from 'lodash';

import { withData } from '@/DataContext';

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

  fetchColumnsState = debounce(async ({ documentType }) => {
    try {
      const toggled = this.getStoredToggled();

      this.setState({ toggled });
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
            documentType: "${this.props.documentType}"
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
    let { columnsState = { columns: [] } } = this.props;
    const { columns } = columnsState;
    if (
      orderedFields.every((field) => columns.find((column) => column.field === field)) &&
      columns.every((column) => orderedFields.find((field) => field === column.field))
    ) {
      this.save({
        ...columnsState,
        columns: sortBy(columns, ({ field }) => orderedFields.indexOf(field)),
      });
    } else {
      console.warn('provided orderedFields are not clean: ', orderedFields);
    }
  };

  render() {
    let { columnsState = { columns: [] }, isLoadingConfigs } = this.props;
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
              ...columnsState,
              columns: columnsState?.columns?.map((column) => {
                return {
                  ...column,
                  Header: column.header,
                  show: column.field in toggled ? toggled[column.field] : column.show,
                };
              }),
              defaultColumns: columnsState?.columns?.filter((column) => column.show),
            },
          },
    );
  }
}

export default withData(ColumnsState);
