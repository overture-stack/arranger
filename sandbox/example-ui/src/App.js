import React, { Component, Fragment } from 'react';
import { BrowserRouter, Route } from 'react-router-dom';
import { Formik } from 'formik';

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
  async save() {
    let { data } = await api({
      variables: { state: this.state.temp },
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

    // TODO: display latest in main section, maybe have previous states as well

    this.setState({
      aggs: data.saveAggsState.states[0].state,
      temp: data.saveAggsState.states[0].state,
    });
  }
  update = ({ field, key, value }) => {
    let agg = this.state.temp.find(x => x.field === field);
    let index = this.state.temp.findIndex(x => x.field === field);
    let temp = Object.assign([], this.state.temp, {
      [index]: { ...agg, [key]: value },
    });
    this.setState({ temp });
    this.save();
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
