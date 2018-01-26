import React from 'react';

export default class StyleProvider extends React.Component {
  state = {
    themeLoaded: false,
    loadedStyle: null,
  };

  componentDidMount = () => {
    this.applyStyle(this.props.availableThemes, this.props.selected);
  };

  componentWillReceiveProps = nextProps => {
    this.applyStyle(nextProps.availableThemes, nextProps.selected);
  };

  applyStyle = async (availableThemes, selectedThemeId) => {
    const stylePath = availableThemes.find(
      theme => theme.id === selectedThemeId,
    ).stylePath;

    let response = await fetch(stylePath);
    let loadedStyle = await response.text();

    this.setState({
      themeLoaded: true,
      loadedStyle,
    });
  };

  render() {
    return (
      this.state.themeLoaded && (
        <style type="text/css"> {this.state.loadedStyle} </style>
      )
    );
  }
}
