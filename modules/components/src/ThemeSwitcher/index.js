import React from 'react';
import StyleProvider from './StyleProvider.js'

export default class ThemeSwitcher extends React.Component {
  constructor(props){
    super(props)
    this.state = {
      selectedThemeId: props.availableThemes[0].id
    }
    this.onStyleChange = this.onStyleChange.bind(this)
  }
  onStyleChange(e){
    this.setState({
      ...this.state,
      selectedThemeId: e.target.value
    })
  }
  render(){
    return (
      <>
        <select value={this.state.selectedThemeId} onChange={ this.onStyleChange } >
          {
            this.props.availableThemes.map(theme => (
              <option key={theme.id} value={theme.id}> {theme.title} </option>
            ))
          }
        </select>
        <StyleProvider selected={this.state.selectedThemeId} availableThemes={this.props.availableThemes}>
          { this.props.children }
        </StyleProvider>
      </>
    )
  }
}

export const AVAILABLE_THEMES = [
    {
      id: "theme_1",
      title: "theme 1",
      stylePath: './themeStyles/theme1.css'
    },
    {
      id: "theme_2",
      title: "theme 2",
      stylePath: './themeStyles/theme2.css'
    }
]
