import React, { Component } from 'react'
// import io from 'socket.io-client'
import TwoPaneLayout from './TwoPaneLayout'

// let socket = io(`http://localhost:5050`)



class App extends Component {
  render() {
    return (
      <div className="app">
        <TwoPaneLayout />
      </div>
    )
  }
}

export default App
