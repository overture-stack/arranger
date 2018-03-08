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

  componentDidMount() {
    let serverOnlineToastID = null;
    this.props.socket.on('server::init', () => {
      if (!toast.isActive(serverOnlineToastID)) {
        serverOnlineToastID = toast('The server is online.', {
          className: {
            background: 'black',
          },
          position: toast.POSITION.BOTTOM_RIGHT,
        });
      }
    });

    let serverRestartingToastID = null;
    this.props.socket.on('server::serverRestarting', () => {
      if (!toast.isActive(serverRestartingToastID)) {
        serverRestartingToastID = toast(
          'The server is restarting. Please standby.',
          {
            className: {
              background: 'black',
            },
            position: toast.POSITION.BOTTOM_RIGHT,
          },
        );
      }
    });

    let refreshToastID;
    this.props.socket.on(this.props.event, () => {
      if (!toast.isActive(refreshToastID)) {
        this.setState({ shouldRefresh: true });
        refreshToastID = toast(this.props.Message, {
          className: {
            background: 'black',
          },
          position: toast.POSITION.BOTTOM_RIGHT,
        });
      }
    });
  }

  render() {
    return this.state.shouldRefresh && <ToastContainer autoClose={false} />;
  }
}

export default DetectNewVersion;
