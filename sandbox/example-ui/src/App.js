import React, { Component, Fragment } from 'react';
import { BrowserRouter, Route } from 'react-router-dom';

class App extends Component {
  render() {
    return (
      <BrowserRouter>
        <Fragment>
          <Route
            path="/admin/:index/:component"
            component={() => {
              return 'test';
            }}
          />
        </Fragment>
      </BrowserRouter>
    );
  }
}

export default App;
