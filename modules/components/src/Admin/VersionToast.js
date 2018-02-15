import React from 'react';
import { ToastContainer, toast } from 'react-toastify';
import api from '../utils/api';

class VersionToast extends React.Component {
  state = {
    shouldRefresh: true,
    Message: ({ redeploy }) => (
      <span>
        A new version of @arranger/server is availble.
        <span
          css={`
            cursor: pointer;
            color: rgb(154, 232, 229);
            font-weight: bold;
          `}
          onClick={redeploy}
        >
          &nbsp;DEPLOY
        </span>
      </span>
    ),
  };

  redeploy = () => {
    api({
      endpoint: '/restartServer',
    });
  };

  componentDidMount() {
    let { socket } = this.props;

    socket.on('server::newServerVersion', () => {
      this.setState({ shouldRefresh: true });

      let { Message } = this.state;

      toast(() => <Message redeploy={this.redeploy} />, {
        className: {
          background: 'black',
        },
        position: toast.POSITION.BOTTOM_RIGHT,
      });
    });

    socket.on('server::serverRestarting', () => {
      this.setState({ Message: () => `Redeploying, standby. ⌛️` });
    });
  }

  render() {
    return this.state.shouldRefresh && <ToastContainer autoClose={false} />;
  }
}

export default VersionToast;
