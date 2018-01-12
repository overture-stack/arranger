import { Component } from 'react';
import { debounce } from 'lodash';

let API = 'http://localhost:5050';

let aggFields = `
  index
  states {
    timestamp
    state {
      field
      displayName
      active
      type
      allowedValues
      restricted
    }
  }
`;

let api = body =>
  fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }).then(r => r.json());

export default class extends Component {
  state = { aggs: [], temp: [] };

  async componentDidMount() {
    let { data } = await api({
      query: `
        {
        	aggsState(indices:["${this.props.index}"]) {
            ${aggFields}
          }
        }
      `,
    });

    this.setState({
      aggs: data.aggsState[0].states[0].state,
      temp: data.aggsState[0].states[0].state,
    });
  }

  save = debounce(async state => {
    let { data } = await api({
      variables: { state },
      query: `
        mutation($state: JSON!) {
          saveAggsState(
            state: $state
            index: "${this.props.index}"
          ) {
            ${aggFields}
          }
        }
      `,
    });

    this.setState({
      aggs: data.saveAggsState.states[0].state,
      temp: data.saveAggsState.states[0].state,
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
