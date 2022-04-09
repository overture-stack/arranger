import { Component } from 'react';
import { debounce, get, sortBy } from 'lodash';

import defaultApiFetcher from '../utils/api';
import esToAggTypeMap from '../utils/esToAggTypeMap';

let aggFields = `
  state {
    field
    show
    active
  }
`;

export const queryFromAgg = ({ field, type }) =>
  type === 'Aggregations'
    ? `
        ${field} {
          buckets {
            doc_count
            key_as_string
            key
          }
        }
      `
    : `
      ${field} {
        stats {
          max
          min
          count
          avg
          sum
        }
      }
      `;

const getMappingTypeOfField = ({ mapping = {}, field = '' }) => {
  const mappingPath = field.split('__').join('.properties.');
  return esToAggTypeMap[get(mapping, mappingPath)?.type];
};

class AggsState extends Component {
  state = { aggs: [], temp: [], mapping: {} };

  componentDidMount() {
    this.fetchAggsState(this.props);
  }

  componentDidUpdate(prev) {
    if (this.props.documentType !== prev.documentType) {
      this.fetchAggsState(this.props);
    }
  }

  fetchAggsState = debounce(async ({ documentType }) => {
    const { apiFetcher = defaultApiFetcher } = this.props;
    try {
      let { data } = await apiFetcher({
        endpoint: `/graphql/AggsStateQuery`,
        body: {
          query: `query aggsStateQuery
            {
              ${documentType} {
                mapping
                aggsState {
                  ${aggFields}
                }
              }
            }
          `,
        },
      });

      this.setState({
        aggs: data[documentType].aggsState.state,
        temp: data[documentType].aggsState.state,
        mapping: data[documentType].mapping,
      });
    } catch (error) {
      // this.setState({ })
      console.warn(error);
    }
  }, 300);

  save = debounce(async (state) => {
    const { apiFetcher = defaultApiFetcher } = this.props;
    let { data } = await apiFetcher({
      endpoint: `/graphql`,
      body: {
        variables: { state },
        query: `
          mutation($state: JSON!) {
            saveAggsState(
              state: $state
              documentType: "${this.props.documentType}"
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
    let agg = this.state.temp.find((x) => x.field === field);
    let index = this.state.temp.findIndex((x) => x.field === field);
    let temp = Object.assign([], this.state.temp, {
      [index]: { ...agg, [key]: value },
    });
    this.setState({ temp }, () => this.save(temp));
  };

  saveOrder = (orderedFields) => {
    const aggs = this.state.temp;
    if (
      orderedFields.every((field) => aggs.find((agg) => agg.field === field)) &&
      aggs.every((agg) => orderedFields.find((field) => field === agg.field))
    ) {
      this.save(sortBy(aggs, (agg) => orderedFields.indexOf(agg.field)));
    } else {
      console.warn('provided orderedFields are not clean: ', orderedFields);
    }
  };

  render() {
    const { mapping } = this.state;
    return this.props.render({
      update: this.update,
      aggs: this.state.temp.map((x) => {
        const type = getMappingTypeOfField({ field: x.field, mapping }) || x.type;
        return {
          ...x,
          type,
          query: queryFromAgg({
            ...x,
            type,
          }),
          isTerms: type === 'Aggregations',
        };
      }),
      saveOrder: this.saveOrder,
    });
  }
}

export default AggsState;
