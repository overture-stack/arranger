import React from 'react';
import { ToastContainer, toast } from 'react-toastify';

class DetectNewVersion extends React.Component {
  state = { shouldRefresh: true };

  componentDidMount() {
    this.props.socket.on('server::refresh', () => {
      this.setState({ shouldRefresh: true });

      toast(
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
        </span>,
        {
          className: {
            background: 'black',
          },
          position: toast.POSITION.BOTTOM_RIGHT,
        },
      );
    });
  }

  render() {
    return this.state.shouldRefresh && <ToastContainer autoClose={false} />;
  }
}

export default DetectNewVersion;
