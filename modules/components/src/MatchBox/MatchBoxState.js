import { Component } from 'react';
import { debounce } from 'lodash';
import api from '../utils/api';

let matchBoxFields = `
  state {
    displayName
    field
    isActive
    keyField
    searchFields
  }
`;

class MatchBoxState extends Component {
  state = { extended: [], matchBoxFields: [], temp: [] };

  async componentDidMount() {
    this.fetchMatchBoxState(this.props);
  }

  componentWillReceiveProps(next) {
    if (this.props.graphqlField !== next.graphqlField) {
      this.fetchMatchBoxState(next);
    }
  }

  fetchMatchBoxState = debounce(async ({ graphqlField }) => {
    try {
      let { data } = await api({
        endpoint: `/${this.props.projectId}/graphql`,
        body: {
          query: `
            {
              ${graphqlField} {
                matchBoxState {
                  ${matchBoxFields}
                }
              }
            }
          `,
        },
      });

      let { data: { [this.props.graphqlField]: { extended } } } = await api({
        endpoint: `/${this.props.projectId}/graphql`,
        body: {
          query: `
          query{
            ${this.props.graphqlField} {
              extended
            }
          }
        `,
        },
      });

      this.setState({
        extended,
        matchBoxState: data[graphqlField].matchBoxState.state,
        temp: data[graphqlField].matchBoxState.state,
      });
    } catch (e) {}
  }, 300);

  save = debounce(async state => {
    let { data } = await api({
      endpoint: `/${this.props.projectId}/graphql`,
      body: {
        variables: { state },
        query: `
        mutation($state: JSON!) {
          saveMatchBoxState(
            state: $state
            graphqlField: "${this.props.graphqlField}"
          ) {
            ${matchBoxFields}
          }
        }
      `,
      },
    });

    this.setState({
      matchBoxState: data.saveMatchBoxState.state,
      temp: data.saveMatchBoxState.state,
    });
  }, 300);

  update = ({ field, key, value }) => {
    let matchBoxField = this.state.temp.find(x => x.field === field);
    let index = this.state.temp.findIndex(x => x.field === field);
    let temp = Object.assign([], this.state.temp, {
      [index]: { ...matchBoxField, [key]: value },
    });
    this.setState({ temp }, () => this.save(temp));
  };

  render() {
    return this.props.render({
      update: this.update,
      matchBoxState: this.state.temp,
      activeFields: this.state.temp?.filter(x => x.isActive),
      extended: this.state.extended,
    });
  }
}

export default MatchBoxState;
