import * as React from 'react';
import { withTheme } from 'emotion-theming';
import Text from 'mineral-ui/Text';

const Header = withTheme(({}) => {
  return <Text element="h1">Arranger</Text>;
});

export default Header;
