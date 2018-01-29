import React, { Component } from 'react';
import { debounce } from 'lodash';

let API = 'http://localhost:5050';

let api = ({ endpoint = 'graphql', name = 'UnnamedQuery', query, variables }) =>
  fetch(API + `/${endpoint}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ES_HOST: 'http://localhost:9200',
    },
    body: JSON.stringify({ query, variables }),
  }).then(r => r.json());

export default class extends Component {
  state = { data: null, error: null, loading: false };
  componentDidMount() {
    this.fetch(this.props);
  }
  componentWillReceiveProps(next) {
    //TODO: more critical check
    if (
      JSON.stringify(this.props.query) !== JSON.stringify(next.query) ||
      JSON.stringify(this.props.variables) !== JSON.stringify(next.variables)
    ) {
      this.fetch(next);
    }
  }
  componentDidCatch(error, info) {
    this.setState({ error });
  }
  fetch = debounce(async options => {
    this.setState({ loading: true });
    try {
      let { data, errors } = await api(options);
      this.setState({
        data,
        error: errors ? { errors } : null,
        loading: false,
      });
    } catch (error) {
      this.setState({ error: error.message, loading: false });
    }
  }, this.props.debounceTime || 0);
  componentDidUpdate() {
    if (this.props.onUpdate) this.props.onUpdate(this.state);
  }
  render() {
    return this.state.error ? (
      <pre>{JSON.stringify(this.state.error, null, 2)}</pre>
    ) : (
      this.props.render(this.state.data)
    );
  }
}
