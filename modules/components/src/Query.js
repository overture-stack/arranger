import React, { Component } from 'react';
import { isEqual, debounce } from 'lodash';
import path from 'path';
import api from './utils/api';
import { defaultProps } from 'recompose';

class Query extends Component {
  state = { data: null, error: null, loading: false };
  componentDidMount() {
    if (this.props.shouldFetch) {
      this.fetch(this.props);
    }
  }
  componentWillReceiveProps(next) {
    if (
      !isEqual(this.props.query, next.query) ||
      !isEqual(this.props.variables, next.variables) ||
      (next.shouldFetch && !this.props.shouldFetch)
    ) {
      this.fetch(next);
    }
  }
  componentDidCatch(error, info) {
    this.setState({ error });
  }
  fetch = debounce(
    async ({ projectId, query, variables, name, ...options }) => {
      this.setState({ loading: true });
      try {
        let { data, errors } = await api({
          ...options,
          endpoint: path.join(projectId, 'graphql', name || ''),
          body: { query, variables },
        });
        this.setState({
          data,
          error: errors ? { errors } : null,
          loading: false,
        });
      } catch (error) {
        this.setState({ data: null, error: error.message, loading: false });
      }
    },
    this.props.debounceTime || 0,
  );
  render() {
    const { loading, error, data } = this.state;
    const { render, renderError } = this.props;
    return error && renderError ? (
      <pre>{JSON.stringify(error, null, 2)}</pre>
    ) : (
      render({ data, loading, error })
    );
  }
}
const EnhancedQuery = defaultProps({ shouldFetch: true })(Query);

export const withQuery = getOptions => Component => props => {
  const options = getOptions(props);

  return (
    <EnhancedQuery
      {...options}
      render={data => <Component {...props} {...{ [options.key]: data }} />}
    />
  );
};

export default EnhancedQuery;
