import 'babel-polyfill';
import React, { Component } from 'react';
import { BrowserRouter, Route } from 'react-router-dom';
import { Dashboard } from '@arranger/components';

class App extends Component {
  render() {
    return (
      <BrowserRouter>
        <>
          <Route path="/admin" component={Dashboard} />
        </>
      </BrowserRouter>
    );
  }
}

export default App;
