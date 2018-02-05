import React from 'react';

class State extends React.Component {
  constructor(props) {
    super(props);
    this.state = props.initial;
  }
  componentDidMount() {
    if (this.props.async) {
      Promise.resolve(this.props.async()).then(this.update);
    }
  }
  componentWillReceiveProps(props) {
    let { onReceiveProps } = props;
    onReceiveProps && onReceiveProps({ props, state: this.state, update: this.update });
  }
  update = object => this.setState(state => ({ ...state, ...object }));
  render() {
    return this.props.render({ ...this.state, update: this.update });
  }
}

export default State;
