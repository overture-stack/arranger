import React from 'react';
import { ToastContainer, toast } from 'react-toastify';

class DetectNewVersion extends React.Component {
  state = { shouldRefresh: false, autoClose: false };

  defaultProps = {
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
    this.props.socket.on('server::init', () => {
      toast.dismiss();
      this.setState({ autoClose: true });
      toast('The server is online.', {
        className: {
          background: 'black',
        },
        position: toast.POSITION.BOTTOM_RIGHT,
      });
    });

    this.props.socket.on('server::serverRestarting', () => {
      toast.dismiss();
      toast('The server is restarting. Please standby.', {
        className: {
          background: 'black',
        },
        position: toast.POSITION.BOTTOM_RIGHT,
      });
    });

    this.props.socket.on(this.props.event, () => {
      this.setState({ shouldRefresh: true, autoClose: false });
      toast.dismiss();
      toast(this.props.Message, {
        className: {
          background: 'black',
        },
        position: toast.POSITION.BOTTOM_RIGHT,
      });
    });
  }

  render() {
    return (
      this.state.shouldRefresh && (
        <ToastContainer autoClose={this.state.autoClose} />
      )
    );
  }
}

export default DetectNewVersion;
