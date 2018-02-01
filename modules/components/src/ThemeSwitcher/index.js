import React from 'react';
import StyleProvider from './StyleProvider.js';

export default class ThemeSwitcher extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedThemeId: props.availableThemes[0]?.id,
    };
  }
  render() {
    return (
      <>
        <select
          value={this.state.selectedThemeId}
          onChange={e =>
            this.setState({
              selectedThemeId: e.target.value,
            })
          }
        >
          {this.props.availableThemes.map(theme => (
            <option key={theme.id} value={theme.id}>
              {theme.title}
            </option>
          ))}
        </select>
        <StyleProvider
          selected={this.state.selectedThemeId}
          availableThemes={this.props.availableThemes}
        />
      </>
    );
  }
}

export const AVAILABLE_THEMES = [
  {
    id: 'beagle',
    title: 'Beagle',
    stylePath: '/themeStyles/beagle/beagle.css',
  },
  {
    id: 'default',
    title: 'Default',
    stylePath: '/themeStyles/default.css',
  },
];

export { StyleProvider };
