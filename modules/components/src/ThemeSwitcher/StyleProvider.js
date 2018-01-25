import React from 'react';

export default class StyleProvider extends React.Component {

  state = {
    themeLoaded: false,
    loadedStyle: null,
  }

  componentDidMount = () => {
    this.applyStyle(this.props.availableThemes, this.props.selected)
  }

  componentWillReceiveProps = (nextProps) => {
    this.applyStyle(nextProps.availableThemes, nextProps.selected)
  }

  applyStyle = (availableThemes, selectedThemeId) => {
    const stylePath = availableThemes
      .find(theme => theme.id === selectedThemeId)
      .stylePath
    this.setState({
      themeLoaded: false,
      loadedStyle: null,
    })
    fetch(stylePath)
      .then(data => data.text())
      .then(str => this.setState({
        themeLoaded: true,
        loadedStyle: str,
      }))
  }

  render() {
    return this.state.themeLoaded
      ? (
        <>
          <style type="text/css"> {this.state.loadedStyle} </style>
          { this.props.children }
        </>
      )
      : null
    }
}
