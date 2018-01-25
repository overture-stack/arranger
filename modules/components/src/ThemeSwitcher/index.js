import React from 'react';
import StyleProvider from './StyleProvider.js'

export default class ThemeSwitcher extends React.Component {
  constructor(props){
    super(props)
    this.state = {
      selectedThemeId: props.availableThemes[0].id
    }
  }
  onStyleChange = (e) => {
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
      id: "default",
      title: "Default",
      stylePath: './themeStyles/default.css'
    },
    {
      id: "kids_first",
      title: "Kids First",
      stylePath: './themeStyles/kids_first.css'
    }
]
