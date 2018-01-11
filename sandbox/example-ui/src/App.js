import React, { Component, Fragment } from 'react';
import { BrowserRouter, Route } from 'react-router-dom';
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

class Aggs extends Component {
  state = { aggs: [], temp: [], searchTerm: '' };
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
    return (
      <Fragment>
        <div style={{ padding: 10 }}>
          <label>filter: </label>
          <input
            type="text"
            value={this.state.searchTerm}
            onChange={e => this.setState({ searchTerm: e.target.value })}
          />
        </div>
        {this.state.temp
          .filter(x => x.field.includes(this.state.searchTerm))
          .map(x => (
            <div key={x.field} style={{ padding: 10 }}>
              <div>field: {x.field}</div>
              <div>
                displayName:
                <input
                  value={x.displayName}
                  onChange={e =>
                    this.update({
                      field: x.field,
                      key: 'displayName',
                      value: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                active: <input type="checkbox" checked={x.active} />
              </div>
              <div>type: {x.type}</div>
              <div>allowedValues: {x.allowedValues}</div>
              <div>
                restricted: <input type="checkbox" checked={x.restricted} />
              </div>
            </div>
          ))}
      </Fragment>
    );
  }
}

class App extends Component {
  render() {
    return (
      <BrowserRouter>
        <Fragment>
          <Route
            path="/admin/:index/:component"
            component={props => <Aggs index={props.match.params.index} />}
          />
        </Fragment>
      </BrowserRouter>
    );
  }
}

export default App;
