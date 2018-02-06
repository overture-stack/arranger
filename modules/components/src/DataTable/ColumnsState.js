import { Component } from 'react';
import { debounce } from 'lodash';

import { api } from '../Admin/Dashboard';
import { ES_HOST } from '../utils/config';

let columnFields = `
  states {
    state {
      type
      keyField
      defaultSorted{
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
      }
    }
  }
`;

export default class extends Component {
  state = {
    config: { keyField: 'id', columns: [] },
    extended: [],
    toggled: {},
  };

  async componentDidMount() {
    this.fetchColumnsState(this.props);
  }

  componentWillReceiveProps(next) {
    if (this.props.index !== next.index) {
      this.fetchColumnsState(next);
    }
  }

  fetchColumnsState = debounce(async ({ index }) => {
    try {
      let { data } = await api({
        endpoint: `/${this.props.projectId}/graphql`,
        headers: { ES_HOST },
        body: {
          query: `
          {
            columnsState(indices:["${this.props.index}"]) {
              ${columnFields}
            }
          }
        `,
        },
      });
      const config = data.columnsState[0].states[0].state;
      let { data: { [this.props.index]: { extended } } } = await api({
        endpoint: `/${this.props.projectId}/graphql`,
        headers: { ES_HOST },
        body: {
          variables: {
            fields: config.columns
              .filter(column => column.canChangeShow || column.show)
              .map(column => column.field),
          },
          query: `
          query($fields: [String]){
            ${this.props.index} {
              extended(fields: $fields)
            }
          }
        `,
        },
      });
      console.log(extended);

      this.setState({
        extended,
        config,
      });
    } catch (e) {
      // this.setState({ })
    }
  }, 300);

  save = debounce(async state => {
    let { data } = await api({
      endpoint: `/${this.props.projectId}/graphql`,
      headers: { ES_HOST },
      body: {
        variables: { state },
        query: `
        mutation($state: JSON!) {
          saveColumnsState(
            state: $state
            index: "${this.props.index}"
          ) {
            ${columnFields}
          }
        }
      `,
      },
    });

    this.setState({
      config: data.saveColumnsState.states[0].state,
    });
  }, 300);

  update = ({ field, key, value }) => {
    let index = this.state.config.columns.findIndex(x => x.field === field);
    let column = this.state.config.columns[index];
    let temp = {
      ...this.state.config,
      columns: Object.assign([], this.state.config.columns, {
        [index]: { ...column, [key]: value },
      }),
    };

    this.setState({ temp }, () => this.save(temp));
  };

  toggle = ({ field, show }) => {
    this.setState({ toggled: { ...this.state.toggled, [field]: show } });
  };

  render() {
    let { config, extended, toggled } = this.state;
    return this.props.render({
      update: this.update,
      toggle: this.toggle,
      state: {
        ...config,
        columns: config.columns.map(column => {
          const extendedField = extended.find(e => e.field === column.field);
          return {
            ...column,
            Header: extendedField?.displayName || column.field,
            extendedType: extendedField?.type,
            show: column.field in toggled ? toggled[column.field] : column.show,
          };
        }),
      },
    });
  }
}
