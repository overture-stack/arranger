import { Component } from 'react';
import { debounce } from 'lodash';
import api from '../utils/api';

let aggFields = `
  state {
    field
    active
    type
  }
`;

export default class extends Component {
  state = { aggs: [], temp: [] };

  async componentDidMount() {
    this.fetchAggsState(this.props);
  }

  componentWillReceiveProps(next) {
    if (this.props.graphqlField !== next.graphqlField) {
      this.fetchAggsState(next);
    }
  }

  fetchAggsState = debounce(async ({ graphqlField }) => {
    try {
      let { data } = await api({
        endpoint: `/${this.props.projectId}/graphql`,
        body: {
          query: `
            {
              ${graphqlField} {
                aggsState {
                  ${aggFields}
                }
              }
            }
          `,
        },
      });

      this.setState({
        aggs: data[graphqlField].aggsState.state,
        temp: data[graphqlField].aggsState.state,
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
          saveAggsState(
            state: $state
            graphqlField: "${this.props.graphqlField}"
          ) {
            ${aggFields}
          }
        }
      `,
      },
    });

    this.setState({
      aggs: data.saveAggsState.state,
      temp: data.saveAggsState.state,
    });
  }, 300);

  update = ({ field, key, value }) => {
    let agg = this.state.temp.find(x => x.field === field);
    let index = this.state.temp.findIndex(x => x.field === field);
    let temp = Object.assign([], this.state.temp, {
      [index]: { ...agg, [key]: value },
    });
    this.setState({ temp }, () => this.save(temp));
  };

  render() {
    return this.props.render({ update: this.update, aggs: this.state.temp });
  }
}
