import * as React from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter, Route } from 'react-router-dom';
import ApolloClient from 'apollo-boost';
import { ApolloProvider } from 'react-apollo';
import { Store } from 'redux';
import { ThemeProvider } from 'mineral-ui/themes';

import localStore from './store';
import VersionsDashboard from './pages/VersionDashboard';
import Header from './components/Header';

const App = ({
  basename = '',
  store = localStore,
}: {
  basename?: string;
  store?: Store;
}) => {
  const client = new ApolloClient({
    uri:
      process.env.REACT_APP_ARRANGER_ADMIN_ROOT ||
      'http://localhost:5050/admin/graphql',
  });

  const RoutedVersionDashboard = () => <VersionsDashboard />;

  return (
    <Provider store={store}>
      <ApolloProvider client={client}>
        <BrowserRouter basename={basename}>
          <ThemeProvider>
            <div>
              <Header />
              <Route path="/" render={RoutedVersionDashboard} />
            </div>
          </ThemeProvider>
        </BrowserRouter>
      </ApolloProvider>
    </Provider>
  );
};

export default App;
