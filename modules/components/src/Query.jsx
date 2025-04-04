import { isEqual, debounce } from 'lodash-es';
import { Component } from 'react';
import { defaultProps } from 'recompose'; // Get rid of this cruft

import defaultApiFetcher from './utils/api.js';

class Query extends Component {
	state = { data: null, error: null, loading: this.props.shouldFetch };

	componentDidMount() {
		if (this.props.shouldFetch) {
			this.fetch(this.props);
		}
	}
	UNSAFE_componentWillReceiveProps(next) {
		if (
			next.shouldFetch &&
			(!this.props.shouldFetch ||
				!isEqual(this.props.query, next.query) ||
				!isEqual(this.props.variables, next.variables))
		) {
			this.fetch(next);
		}
	}
	componentDidCatch(error, info) {
		this.setState({ error });
	}
	fetch = debounce(async ({ callback, query, variables, ...options }) => {
		const { apiFetcher = defaultApiFetcher } = this.props;
		this.setState({ loading: true });
		try {
			let { data, errors } = await apiFetcher({
				...options,
				body: { query, variables },
			});

			this.setState({
				data,
				error: errors ? { errors } : null,
				loading: false,
			});

			callback?.({ data, errors });
		} catch (error) {
			this.setState({ data: null, error: error.message, loading: false });
		}
	}, this.props.debounceTime || 0);
	render() {
		const { loading, error, data } = this.state;
		const { render, renderError } = this.props;
		return error && renderError ? <pre>{JSON.stringify(error, null, 2)}</pre> : render({ data, loading, error });
	}
}
const EnhancedQuery = defaultProps({ shouldFetch: true })(Query);

export const withQuery = (getOptions) => (Component) => (props) => {
	const options = getOptions(props);

	return (
		<EnhancedQuery
			apiFetcher={props.apiFetcher}
			{...options}
			render={(data) => <Component {...props} {...{ [options.key || 'response']: data }} />}
		/>
	);
};

export default EnhancedQuery;
