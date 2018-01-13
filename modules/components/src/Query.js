import React, { Component } from 'react';

let API = 'http://localhost:5050';

let api = ({ endpoint = 'graphql', name = 'UnnamedQuery', query, variables }) =>
  fetch(API + `/${endpoint}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  }).then(r => r.json());

export default class extends Component {
  state = { data: null, error: null };
  async componentDidMount() {
    let { query, variables, name, endpoint } = this.props;
    try {
      let { data, errors } = await api({ endpoint, query, variables, name });
      this.setState({ data, error: { errors } });
    } catch (error) {
      this.setState({ error });
    }
  }
  componentWillReceiveProps(next) {
    if (
      JSON.stringify(this.props.query) !== JSON.stringify(next.query) ||
      JSON.stringify(this.props.variables) !== JSON.stringify(next.variables)
    ) {
      let { endpoint, query, variables, name } = next;
      api({ endpoint, query, variables, name }).then(({ data }) =>
        this.setState({ data }),
      );
    }
  }
  componentDidCatch(error, info) {
    this.setState({ error });
  }
  render() {
    return this.state.error ? (
      <pre>{JSON.stringify(this.state.error, null, 2)}</pre>
    ) : (
      this.props.render(this.state.data)
    );
  }
}
