import React from 'react';

class DetectNewVersion extends React.Component {
  state = { shouldRefresh: false };

  componentDidMount() {
    this.props.socket.on('server::refresh', () => {
      this.setState({ shouldRefresh: true });
    });
  }

  render() {
    const { shouldRefresh } = this.state;

    return shouldRefresh ? (
      <div
        css={`
          z-index: 10000;
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: #383838;
          color: white;
          padding: 10px;
          border-radius: 6px;
        `}
      >
        A new version of this app is available.{' '}
        <span
          css={`
            cursor: pointer;
            color: rgb(154, 232, 229);
            font-weight: bold;
          `}
          onClick={() => (window.location.href = window.location.href)}
        >
          REFRESH
        </span>
      </div>
    ) : null;
  }
}

export default DetectNewVersion;
