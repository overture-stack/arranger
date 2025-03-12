import { parse } from 'query-string';
import { Route } from 'react-router-dom';

const Location = (props) => (
	<Route>
		{(p) => {
			let search = parse(p.location.search);
			if (search.filters) search.filters = JSON.parse(search.filters);
			return props.render(search);
		}}
	</Route>
);

export default Location;
