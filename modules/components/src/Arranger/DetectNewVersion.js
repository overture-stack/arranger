import React from 'react';
import { ToastContainer, toast } from 'react-toastify';

class DetectNewVersion extends React.Component {
  state = { shouldRefresh: false };

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
    this.props.socket.on(this.props.event, () => {
      this.setState({ shouldRefresh: true });

      toast(this.props.Message, {
        className: {
          background: 'black',
        },
        position: toast.POSITION.BOTTOM_RIGHT,
      });
    });
  }

  render() {
    return this.state.shouldRefresh && <ToastContainer autoClose={false} />;
  }
}

export default DetectNewVersion;
