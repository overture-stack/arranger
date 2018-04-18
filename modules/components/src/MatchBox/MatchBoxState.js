import { Component } from 'react';
import { debounce } from 'lodash';
import api from '../utils/api';

import { decorateFieldWithColumnsState } from '../Arranger/QuickSearch/QuickSearchQuery';

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
  state = { extended: [], columnsState: {}, matchBoxState: [], temp: [] };

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
      let {
        data: {
          [graphqlField]: {
            extended,
            matchBoxState: { state: matchBoxState },
            columnsState: { state: columnsState },
          },
        },
      } = await api({
        endpoint: `/${this.props.projectId}/graphql`,
        body: {
          query: `
            {
              ${graphqlField} {
                extended
                matchBoxState {
                  ${matchBoxFields}
                }
                columnsState {
                  state {
                    columns {
                      field
                      query
                      jsonPath
                    }
                  }
                }
              }
            }
          `,
        },
      });

      this.setState({
        matchBoxState,
        temp: matchBoxState,
        extended,
        columnsState,
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
      primaryKeyField: this.state.extended?.find(x => x.primaryKey),
      activeFields: this.state.temp?.filter(x => x.isActive)?.map(x => {
        return {
          ...x,
          keyField: {
            field: x.keyField,
            ...decorateFieldWithColumnsState({
              columnsState: this.state.columnsState,
              field: x.keyField,
            }),
          },
          searchFields: x.searchFields.map(y => ({
            field: y,
            entityName: x.displayName,
            ...decorateFieldWithColumnsState({
              columnsState: this.state.columnsState,
              field: y,
            }),
          })),
        };
      }),
      extended: this.state.extended,
    });
  }
}

export default MatchBoxState;
