import { ReactNode } from 'react';
import { css } from '@emotion/react';
import cx from 'classnames';
import { filesize } from 'filesize';
import { JSONPath } from 'jsonpath-plus';
import { get, isNil } from 'lodash';

import { ColumnListStyles } from '@/Table/types';
import dateFormatter from '@/utils/dates';
import { emptyObj } from '@/utils/noops';

import { getSingleValue } from '.';

export const getCellValue = (
	row = emptyObj as unknown,
	{ accessor = '', id = '', jsonPath = '' } = emptyObj,
): string =>
	jsonPath
		? JSONPath({ json: row as Record<string, any>, path: jsonPath })
		: get(row, (id || accessor).split('.'), '');

export const getDisplayValue = (row = emptyObj as unknown, column = emptyObj): string => {
	const value = getCellValue(row, column);
	switch (column.type) {
		case 'date':
			return dateFormatter(value, column);

		default:
			return value;
	}
};

const Number = (props = emptyObj) => (
	<span
		css={css`
			text-align: right;
		`}
	>
		{props.value?.toLocaleString('en-CA')}
	</span>
);

const FileSize = ({ options = emptyObj, value = 0 }) => (
	<span>{`${filesize(value, options)}`}</span>
);

export const defaultCellTypes = {
	bits: ({ value = 0, ...props } = {}) => <FileSize {...props} value={value / 8} />,
	boolean: ({ value = undefined } = {}) => (isNil(value) ? '' : `${value}`),
	bytes: (props = emptyObj) => <FileSize {...props} />,
	date: ({ value, ...props } = emptyObj) => dateFormatter(value, props),
	list: ({ column, id, theme, value: valuesArr } = emptyObj) => {
		const arrHasValues = Array.isArray(valuesArr) && valuesArr?.filter((v) => v).length > 0; // table shouldn't display Nulls

		if (Array.isArray(valuesArr)) {
			if (column.isArray && arrHasValues) {
				const format = theme.listStyle || column.displayFormat;

				return Object.values(ColumnListStyles).includes(format) ? (
					<ul className={cx('list-values', format)}>
						{valuesArr.map((value: ReactNode, index) => (
							<li key={`${id}-${index}`} data-value={value}>
								{value}
							</li>
						))}
					</ul>
				) : (
					valuesArr.join(', ')
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
