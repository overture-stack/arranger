import { css } from '@emotion/react';
import cx from 'classnames';
import { filesize } from 'filesize';
import { JSONPath } from 'jsonpath-plus';
import { get, isNil } from 'lodash-es';
import type { ReactNode } from 'react';

import { ColumnListStyles } from '#Table/types.js';
import dateFormatter from '#utils/dates.js';
import { emptyObj } from '#utils/noops.js';

import { getSingleValue } from './index.js';

export const getCellValue = (
	row = emptyObj as unknown,
	{ accessor = '', id = '', jsonPath = '' } = emptyObj,
): string => {
	// TODO: generate json mapping for nested automatically
	// remove jsonPath from configs
	const value = jsonPath
		? JSONPath({ json: row as Record<string, any>, path: jsonPath, wrap: false })
		: get(row, (id || accessor).split('.'), '');

	return value ?? null; // prevents React "return" errors when the value is undefined
};

export const getDisplayValue = (row = emptyObj as unknown, column = emptyObj): string => {
	const value = getCellValue(row, column);
	switch (column.type) {
		case 'date':
			return dateFormatter(value, column);

		default:
			return value;
	}
};

const Link = (props = emptyObj) => (
	<a
		css={css`
			text-align: right;
		`}
		href={props.value}
		rel="noopener noreferrer"
		target="_blank"
	>
		{props.value}
	</a>
);

const Number = (props = emptyObj) => (
	<span
		css={css`
			text-align: right;
		`}
	>
		{props.value?.toLocaleString('en-CA')}
	</span>
);

const FileSize = ({ options = emptyObj, value = 0 }) => <span>{`${filesize(value, options)}`}</span>;

export const defaultCellTypes = {
	bits: ({ value = 0, ...props } = {}) => (
		<FileSize
			{...props}
			value={value / 8}
		/>
	),
	boolean: ({ value = undefined } = {}) => (isNil(value) ? '' : `${value}`),
	bytes: (props = emptyObj) => <FileSize {...props} />,
	date: ({ value, ...props } = emptyObj) => dateFormatter(value, props),
	link: Link,
	list: ({ column, id, theme, value: valuesArr } = emptyObj) => {
		// TODO: option to remove duplicates in array
		// TODO: study how lists behave for nested rows

		if (Array.isArray(valuesArr)) {
			const arrHasValues =
				valuesArr?.filter(
					(value) =>
						(['bits', 'boolean', 'bytes', 'date', 'number'].includes(column?.displayType) &&
							(value || value === '0')) ||
						value,
				).length > 0; // table shouldn't display Nulls

			if (column.isArray && arrHasValues) {
				return Object.values(ColumnListStyles).includes(theme.listStyle) ? (
					<ul className={cx('list-values', theme.listStyle)}>
						{valuesArr.map((value: ReactNode, index) => (
							<li
								key={`${id}-${index}`}
								data-value={value}
							>
								{value}
							</li>
						))}
					</ul>
				) : (
					valuesArr.join(', ')
				);
			}

			const total = valuesArr.length;
			const firstValue = total > 0 && getSingleValue(valuesArr[0]);
			return [firstValue || '', ...(total > 1 ? [<br key="br" />, '...'] : [])];
		}

		return valuesArr;
	},
	number: Number,
};
