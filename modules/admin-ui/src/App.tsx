import * as React from 'react';
import { Provider } from 'react-redux';
import { Route } from 'react-router-dom';
import { ConnectedRouter } from 'connected-react-router';
import ApolloClient from 'apollo-boost';
import { ApolloProvider } from 'react-apollo';
import { Store } from 'redux';
import { createBrowserHistory } from 'history';
import { ThemeProvider } from 'mineral-ui/themes';

import { createLocalStore } from './store';
import Header from './components/Header';
import VersionsDashboard from './pages/VersionDashboard';
import ProjectIndicesDashboard from './pages/ProjectIndicesDashboard';

const history = createBrowserHistory();
const localStore = createLocalStore({ history });

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
  const RoutedProjectIndicesDashboard = ({ match }) => (
    <ProjectIndicesDashboard projectId={match.params.projectId} />
  );

  return (
    <Provider store={store}>
      <ApolloProvider client={client}>
        <ConnectedRouter history={history}>
          <ThemeProvider>
            <div>
              <Header />
              <Route exact={true} path="/" render={RoutedVersionDashboard} />
              <Route
                exact={true}
                path="/project/:projectId/"
                render={RoutedProjectIndicesDashboard}
              />
            </div>
          </ThemeProvider>
        </ConnectedRouter>
        {/* <BrowserRouter basename={basename}>
        </BrowserRouter> */}
      </ApolloProvider>
    </Provider>
  );
};

export default App;
