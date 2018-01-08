import React, { Component } from 'react';

import ReactGridLayout, { WidthProvider } from 'react-grid-layout';

const ResponsiveReactGridLayout = WidthProvider(ReactGridLayout);

class App extends Component {
  render() {
    const layout = [
      {
        i: 'facets',
        x: 0,
        y: 0,
        w: 3,
        h: 12,
        static: true,
      },
      {
        i: 'current',
        x: 3,
        y: 0,
        w: 9,
        h: 2,
        static: true,
      },
      {
        i: 'table',
        x: 3,
        y: 2,
        w: 9,
        h: 10,
        static: true,
      },
    ];

    return (
      <div className="app">
        <ResponsiveReactGridLayout
          className="layout"
          layout={layout}
          cols={12}
          margin={[0, 0]}
          width={window.innerWidth}
          rowHeight={window.innerHeight / 12}
        >
          <div key="facets" style={{ background: 'grey', minHeight: '100vh' }}>
            Facets
          </div>
          <div key="current" style={{ background: 'darkgrey' }}>
            Current
          </div>
          <div key="table">Table</div>
        </ResponsiveReactGridLayout>
      </div>
    );
  }
}

export default App;
