import React from 'react';

export default class StyleProvider extends React.Component {

  state = {
    themeLoaded: false,
    loadedStyle: null,
  }

  componentDidMount() {
    this.applyStyle(this.props.availableThemes, this.props.selected)
  }

  componentWillReceiveProps(nextProps) {
    this.applyStyle(nextProps.availableThemes, nextProps.selected)
  }

  applyStyle(_availableThemes, _selectedThemeId){
    const selectedThemeId = _selectedThemeId
    const stylePath = _availableThemes
      .find(theme => theme.id === selectedThemeId)
      .stylePath
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
          <style dangerouslySetInnerHTML={{__html:this.state.loadedStyle}}/>
          { this.props.children }
        </>
      )
      : null
    }
}
