import React from 'react';

/**
 * This is a utility component for handling clickaway events.
 * All props other than `handler` are passed down to the dom wrapper
 * so customization is possible through normal react-dom API
 */
export default class ClickAwayListener extends React.Component {
  ref = React.createRef();
  clickHandler = e => {
    const { handler = () => {} } = this.props;
    if (!this.ref.current.contains(e.target)) {
      handler(e);
    }
  };
  componentWillMount() {
    document.addEventListener('click', this.clickHandler);
  }
  componentWillUnmount() {
    document.removeEventListener('click', this.clickHandler);
  }
  render() {
    const { handler, ...rest } = this.props; // omits `handler`
    return <span {...rest} ref={this.ref} />;
  }
}
