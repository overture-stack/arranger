import * as React from 'react';
import { EsMapping, EsTypes } from '@arranger/admin';

const something: EsMapping = {
  asdf: {
    mappings: {
      asdf: {
        properties: {
          sdfg: {
            type: EsTypes.nested,
            properties: {},
          },
        },
      },
    },
  },
};

console.log('something: ', something);

const App = () => {
  return (
    <div className="App">
      <header className="App-header">
        <h1 className="App-title">Welcome to React</h1>
      </header>
      <p className="App-intro">
        To get started, edit <code>src/App.tsx</code> and save to reload.
      </p>
    </div>
  );
};

export default App;
