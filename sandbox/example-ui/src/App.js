import React, { Component } from 'react';
import Table from './Table';
import SQONView from '@arranger/components/lib/SQONView';

class App extends Component {
  render() {
    return (
      <div className="app" style={{ display: 'flex' }}>
        <div>aggregations</div>
        <div style={{ flexGrow: 1 }}>
          <SQONView
            sqon={{
              op: 'and',
              content: [],
            }}
          />
          <Table />
        </div>
      </div>
    );
  }
}

export default App;
