import React from 'react';
import { ToastContainer, toast } from 'react-toastify';

class DetectNewVersion extends React.Component {
  state = { shouldRefresh: false };

  static defaultProps = {
    event: 'server::refresh',
    Message: () => (
      <span>
        A new version of this app is available.
        <span
          css={`
            cursor: pointer;
            color: rgb(154, 232, 229);
            font-weight: bold;
          `}
          onClick={() => (window.location.href = window.location.href)}
        >
          &nbsp;REFRESH
        </span>
      </span>
    ),
  };
  onInit = () => {
    if (!toast.isActive(this.serverOnlineToastID)) {
      this.serverOnlineToastID = toast('The server is online.', {
        className: {
          background: 'black',
        },
        position: toast.POSITION.BOTTOM_RIGHT,
      });
    }
  };
  onRestart = () => {
    if (!toast.isActive(this.serverRestartingToastID)) {
      this.serverRestartingToastID = toast(
        'The server is restarting. Please standby.',
        {
          className: {
            background: 'black',
          },
          position: toast.POSITION.BOTTOM_RIGHT,
        },
      );
    }
  };

  onEvent = () => {
    if (!toast.isActive(this.refreshToastID)) {
      this.setState({ shouldRefresh: true });
      this.refreshToastID = toast(this.props.Message, {
        className: {
          background: 'black',
        },
        position: toast.POSITION.BOTTOM_RIGHT,
      });
    }
  };

  componentDidMount() {
    this.props.socket.on('server::init', this.onInit);
    this.props.socket.on('server::serverRestarting', this.onRestart);
    this.props.socket.on(this.props.event, this.onEvent);
  }

  componentWillUnmount() {
    this.props.socket.off('server::init', this.onInit);
    this.props.socket.off('server::serverRestarting', this.onRestart);
    this.props.socket.off(this.props.event, this.onEvent);
  }

  render() {
    return this.state.shouldRefresh && <ToastContainer autoClose={false} />;
  }
}

export default DetectNewVersion;
