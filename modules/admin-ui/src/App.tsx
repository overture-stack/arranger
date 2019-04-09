import * as React from 'react';
import { Provider } from 'react-redux';
import { Route } from 'react-router-dom';
import { BrowserRouter, withRouter } from 'react-router-dom';
import ApolloClient from 'apollo-boost';
import { ApolloProvider } from 'react-apollo';
import { ThemeProvider } from 'mineral-ui/themes';

import { createLocalStore } from './store';
import Header from './components/Header';
import VersionsDashboard from './pages/VersionDashboard';
import ProjectIndicesDashboard from './pages/ProjectIndicesDashboard';
import ConfigEditorDashboard from './pages/ConfigEditorDashboard';
import { adminApiRoot as configAdminApiRoot } from './config';

const App = withRouter(
  ({
    history,
    apiRoot = configAdminApiRoot,
    store = createLocalStore({ history }),
  }: any) => {
    const client = new ApolloClient({ uri: apiRoot });

    const RoutedVersionDashboard = () => <VersionsDashboard />;
    const RoutedProjectIndicesDashboard = ({ match }) => (
      <ProjectIndicesDashboard projectId={match.params.projectId} />
    );

    const RoutedConfigEditor = ({ match }) => (
      <ConfigEditorDashboard
        projectId={match.params.projectId}
        graphqlField={match.params.indexId}
      />
    );

    return (
      <Provider store={store}>
        <ApolloProvider client={client}>
          <ThemeProvider>
            <div>
              <Header />
              <Route exact={true} path="/" render={RoutedVersionDashboard} />
              <Route
                exact={true}
                path="/:projectId/"
                render={RoutedProjectIndicesDashboard}
              />
              <Route
                exact={true}
                path="/:projectId/:indexId"
                render={RoutedConfigEditor}
              />
            </div>
          </ThemeProvider>
        </ApolloProvider>
      </Provider>
    );
  },
);

export default ({ basename = '' }: { basename?: string }) => (
  <BrowserRouter basename={basename}>
    <App />
  </BrowserRouter>
);
