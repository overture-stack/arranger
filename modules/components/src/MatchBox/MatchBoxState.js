import { Component } from 'react';
import { debounce } from 'lodash';

import api from '../utils/api';
import { decorateFieldWithColumnsState } from '../Arranger/QuickSearch/QuickSearchQuery';

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
          query: `
            {
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
          `,
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
        query: `
        mutation($state: JSON!) {
          saveMatchBoxState(
            state: $state
            documentType: "${this.props.documentType}"
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

  update = ({ fieldName, key, value }) => {
    let matchBoxField = this.state.temp.find((x) => x.fieldName === fieldName);
    let index = this.state.temp.findIndex((x) => x.fieldName === fieldName);
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
          keyField: {
            fieldName: x.keyFieldName,
            ...decorateFieldWithColumnsState({
              columnsState: this.state.columnsState,
              fieldName: x.keyFieldName,
            }),
          },
          searchFields: x.searchFields.map((fieldName) => ({
            fieldName,
            entityName: x.displayName,
            ...decorateFieldWithColumnsState({
              columnsState: this.state.columnsState,
              fieldName,
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
