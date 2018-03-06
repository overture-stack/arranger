import React from 'react';

class State extends React.Component {
  constructor(props) {
    super(props);
    this.state = props.initial;
  }
  componentDidMount() {
    const { async = () => {} } = this.props;
    Promise.resolve(async).then(this.update);
  }
  componentWillReceiveProps(props) {
    let { onReceiveProps } = props;
    onReceiveProps &&
      onReceiveProps({ props, state: this.state, update: this.update });
  }
  update = (object, onComplete = () => {}) =>
    this.setState(state => ({ ...state, ...object }), onComplete);
  componentDidUpdate(prevProps, prevState) {
    if (this.props.didUpdate) {
      this.props.didUpdate({
        prevProps,
        prevState,
        update: this.update,
        ...this.state,
      });
    }
  }
  render() {
    return this.props.render({
      ...this.state,
      update: this.update,
    });
  }
}

export default State;
