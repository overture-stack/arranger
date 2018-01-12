import React, { Component } from 'react';
import io from 'socket.io-client';
import TwoPaneLayout from './TwoPaneLayout';

let socket = io(`http://localhost:5050`);

class App extends Component {
  state = { data: [] };
  componentDidMount() {
    socket.on('server::chunk', ({ data }) => {
      this.setState({ data: this.state.data.concat(data.models.hits.edges) });
    });
  }
  render() {
    return (
      <div className="app">
        <button
          onClick={() => {
            socket.emit('client::stream', {
              index: 'models',
              size: 100,
              fields: `
                id
                gender
              `,
            });
          }}
        >
          Stream
        </button>
        {JSON.stringify(this.state.data)}
      </div>
    );
  }
}

export default App;
