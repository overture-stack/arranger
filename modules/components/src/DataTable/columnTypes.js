import cx from 'classnames';
import { format, isValid, parseISO } from 'date-fns';
import { filesize } from 'filesize';
import jsonPath from 'jsonpath/jsonpath.min';
import { isNil } from 'lodash';

import { getSingleValue } from './utils';

const STANDARD_DATE = 'yyyy-MM-dd';

const dateHandler = ({ value, ...props } = {}) => {
	switch (true) {
		case isNil(value):
			return '';

		case isValid(new Date(value)):
			return format(new Date(value), STANDARD_DATE);

		case isValid(parseISO(value)):
			return format(parseISO(value), STANDARD_DATE);

		case !isNaN(parseInt(value, 10)):
			return format(parseInt(value, 10), STANDARD_DATE);

		default: {
			console.error('unhandled data', value, props);
			return value;
		}
	}
};

const Number = (props) => <div style={{ textAlign: 'right' }}>{props.value}</div>;
const FileSize = ({ options = {}, value = 0 }) => <Number value={filesize(value, options)} />;

export default {
	bits: ({ value = 0, ...props } = {}) => <FileSize {...props} value={value / 8} />,
	boolean: ({ value = undefined } = {}) => (isNil(value) ? '' : `${value}`),
	bytes: (props) => <FileSize {...props} />,
	date: dateHandler,
	list: ({ column, id, original }) => {
		const valuesArr = jsonPath.query(original, column.jsonPath ?? column.fieldName)?.[0];
		const arrHasValues = Array.isArray(valuesArr) && valuesArr?.filter((v) => v).length > 0; // table shouldn't display Nulls

		if (Array.isArray(valuesArr)) {
			if (column.isArray && arrHasValues) {
				return (
					<ul className={cx('list-values', column.displayFormat || 'commas')}>
						{valuesArr.map((value, index) => (
							<li key={`${id}-${index}`} data-value={value}>
								{value}
							</li>
						))}
					</ul>
				);
			}

			const total = valuesArr.length;
			const firstValue = getSingleValue(valuesArr[0]);
			return [firstValue || '', ...(total > 1 ? [<br key="br" />, '...'] : [])];
		}

		return valuesArr;
	},
	number: Number,
};
