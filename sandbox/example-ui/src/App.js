import React, { Component, Fragment } from 'react';
import { BrowserRouter, Route } from 'react-router-dom';
import { AggsState, EditAggs } from '@arranger/components/lib/Aggs';

class App extends Component {
  render() {
    return (
      <BrowserRouter>
        <Fragment>
          <Route
            path="/admin/:index/:component"
            component={props => (
              <AggsState
                index={props.match.params.index}
                render={p => <EditAggs handleChange={p.update} {...p} />}
              />
            )}
          />
        </Fragment>
      </BrowserRouter>
    );
  }
}

export default App;
