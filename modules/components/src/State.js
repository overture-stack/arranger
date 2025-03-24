import { Component } from 'react';

import noopFn from '#utils/noops.js';

class State extends Component {
	constructor(props) {
		super(props);
		console.warn(
			'[[ DEPRECATION WARNING ]]: the State component has been deprecated in favor of react-component-component',
		);
		this.state = props.initial;
	}
	componentDidMount() {
		const { async = noopFn } = this.props;
		Promise.resolve(async()).then(this.update);
	}
	UNSAFE_componentWillReceiveProps(props) {
		let { onReceiveProps } = props;
		onReceiveProps && onReceiveProps({ props, state: this.state, update: this.update });
	}
	update = (object, onComplete = noopFn) => this.setState((state) => ({ ...state, ...object }), onComplete);
	componentDidUpdate(prevProps, prevState) {
		if (this.props.didUpdate) {
			this.props.didUpdate({
				prevProps,
				prevState,
				update: this.update,
				...this.state,
			});
		}
	}
	render() {
		return this.props.render({
			...this.state,
			update: this.update,
		});
	}
}

export default State;
