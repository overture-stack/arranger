import { Component } from 'react';
import { debounce } from 'lodash';

let API =
  process.env.STORYBOOK_API ||
  localStorage.STORYBOOK_API ||
  'http://localhost:5050';

let fields = `
  index
  states {
    timestamp
    state {
      keyField
      type
      defaultSorted {
        id
        desc
      }
      columns {
        show
        type
        field
        sortable
        canChangeShow
        query
        listAccessor
        totalAccessor
        id
        accessor
      }
    }
  }
`;

let api = ({ body, endpoint = '' }) =>
  fetch(API + endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ES_HOST: 'http://localhost:9200', // TODO; get from somewhere
    },
    body: JSON.stringify(body),
  }).then(r => r.json());

export default class extends Component {
  state = { aggs: {}, temp: {} };

  async componentDidMount() {
    this.fetchAggsState(this.props);
  }

  componentWillReceiveProps(next) {
    if (this.props.index !== next.index) {
      this.fetchAggsState(next);
    }
  }

  fetchAggsState = debounce(async ({ index }) => {
    try {
      let { data } = await api({
        endpoint: `/${this.props.projectId}/graphql`,
        body: {
          query: `
          {
            columnsState(indices:["${this.props.index}"]) {
              ${fields}
            }
          }
        `,
        },
      });

      this.setState({
        aggs: data.columnsState[0].states[0].state,
        temp: data.columnsState[0].states[0].state,
      });
    } catch (e) {
      // this.setState({ })
    }
  }, 300);

  save = debounce(async state => {
    let { data } = await api({
      endpoint: `/${this.props.projectId}/graphql`,
      body: {
        variables: { state },
        query: `
        mutation($state: JSON!) {
          saveColumnsState(
            state: $state
            index: "${this.props.index}"
          ) {
            ${fields}
          }
        }
      `,
      },
    });

    this.setState({
      aggs: data.saveColumnsState.states[0].state,
      temp: data.saveColumnsState.states[0].state,
    });
  }, 300);

  update = ({ field, key, value }) => {
    let column = this.state.temp.columns.find(x => x.field === field);
    let index = this.state.temp.columns.findIndex(x => x.field === field);
    let temp = {
      ...this.state.temp,
      columns: Object.assign([], this.state.temp.columns, {
        [index]: { ...column, [key]: value },
      }),
    };
    this.setState({ temp }, () => this.save(temp));
  };

  render() {
    return this.props.render({ update: this.update, aggs: this.state.temp });
  }
}
