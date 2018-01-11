import React, { Component, Fragment } from 'react';
import { BrowserRouter, Route } from 'react-router-dom';

let API = 'http://localhost:5050';

class Aggs extends Component {
  state = { aggs: [] };
  async componentDidMount() {
    let { data } = await fetch(API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
        {
        	aggsState(indices:["${this.props.index}"]) {
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
          }
        }

        `,
      }),
    }).then(r => r.json());

    this.setState({ aggs: data.aggsState[0].states[0].state });
  }
  render() {
    return (
      <Fragment>
        {this.state.aggs.map(x => (
          <Fragment key={x.field}>
            <div>field: {x.field}</div>
            <div>displayName: {x.displayName}</div>
            <div>
              active: <input type="checkbox" checked={x.active} />
            </div>
            <div>type: {x.type}</div>
            <div>allowedValues: {x.allowedValues}</div>
            <div>
              restricted: <input type="checkbox" checked={x.restricted} />
            </div>
          </Fragment>
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
