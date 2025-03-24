import { action } from '@storybook/addon-actions';
import { storiesOf } from '@storybook/react';
import { JSONPath } from 'jsonpath-plus';
import { orderBy, get } from 'lodash-es';
import { compose, withState } from 'recompose';
import { v4 as uuid } from 'uuid';

import DataTable, { Table, TableToolbar, getSingleValue } from '#DataTable/index.js';
import api from '#utils/api.js';
import columnsToGraphql from '#utils/columnsToGraphql.js';

import { themeDecorator } from './decorators.js';

const withSQON = withState('sqon', 'setSQON', null);

const tableConfig = {
	timestamp: '2018-01-12T16:42:07.495Z',
	type: 'models',
	rowIdFieldName: 'name',
	defaultSorting: [{ field: 'age_at_diagnosis', desc: false }],
	columns: [
		{
			show: true,
			Header: 'Age At Diagnosis',
			type: 'number',
			sortable: true,
			canChangeShow: true,
			accessor: 'age_at_diagnosis',
		},
		{
			show: true,
			Header: 'Name',
			type: 'string',
			sortable: true,
			canChangeShow: true,
			accessor: 'name',
		},
	],
};

const dummyConfig = {
	timestamp: '2018-01-12T16:42:07.495Z',
	type: 'files',
	rowIdFieldName: 'file_id',
	defaultSorting: [{ field: 'access', desc: false }],
	columns: [
		{
			show: true,
			Header: 'Access',
			type: 'string',
			sortable: true,
			canChangeShow: true,
			accessor: 'access',
		},
		{
			show: true,
			Header: 'File Id',
			type: 'string',
			sortable: true,
			canChangeShow: true,
			accessor: 'file_id',
		},
		{
			show: true,
			Header: 'File Name',
			type: 'string',
			sortable: true,
			canChangeShow: true,
			accessor: 'file_name',
		},
		{
			show: true,
			Header: 'Data Type',
			type: 'string',
			sortable: true,
			canChangeShow: true,
			accessor: 'data_type',
		},
		{
			show: true,
			Header: 'File Size',
			type: 'bits',
			sortable: true,
			canChangeShow: true,
			accessor: 'file_size',
		},
		{
			show: true,
			Header: 'Cases Primary Site',
			type: 'list',
			sortable: false,
			canChangeShow: false,
			query: 'cases { hits { total, edges { node { primary_site } } } }',
			jsonPath: '$.cases.hits.edges[*].node.primary_site',
			id: 'cases.primary_site',
		},
	],
};

const dummyData = Array(1000)
	.fill(null)
	.map(() => {
		const cases = Array(Math.floor(Math.random() * 10))
			.fill()
			.map(() => ({
				node: {
					primary_site: uuid(),
				},
			}));
		return {
			access: Math.random() > 0.5 ? 'controlled' : 'open',
			file_id: uuid(),
			file_name: uuid(),
			data_type: uuid(),
			file_size: Math.floor(Math.random() * 10000000),
			cases: {
				hits: {
					total: cases.length,
					edges: cases,
				},
			},
		};
	});

const withColumns = compose(withState('columns', 'onColumnsChange', dummyConfig.columns));

const TableToolbarStory = withColumns(TableToolbar);

function fetchDummyData({ config, sort, offset, first }) {
	return Promise.resolve({
		total: dummyData.length,
		data: orderBy(
			dummyData,
			sort.map((s) => s.field),
			sort.map((s) => s.order),
		).slice(offset, offset + first),
	});
}

const EnhancedDataTable = withSQON(({ sqon, setSQON }) => (
	<DataTable
		config={tableConfig}
		setSelectedTableRows={action('selection changed')}
		fetchData={(options) => {
			return api({
				endpoint: 'table',
				body: columnsToGraphql({ ...options, sqon }),
			}).then((r) => {
				const hits = get(r, `data.${options.config.type}.hits`) || {};
				const data = get(hits, 'edges', []).map((e) => e.node);
				const total = hits.total || 0;
				return { total, data };
			});
		}}
	/>
));

storiesOf('Table', module)
	.addDecorator(themeDecorator)
	.addDecorator((story) => (
		<div
			style={{
				position: 'absolute',
				left: '0px',
				right: '0px',
				top: '50px',
				bottom: '0px',
				display: 'flex',
				flexDirection: 'column',
			}}
		>
			{story()}
		</div>
	))
	.add('Table', () => (
		<Table config={dummyConfig} fetchData={fetchDummyData} setSelectedTableRows={action('selection changed')} />
	))
	.add('Toolbar', () => <TableToolbarStory enableDropDownControls={true} onFilterChange={console.log.bind(console)} />)
	.add('Toolbar with customHeaderContent', () => (
		<TableToolbarStory customHeaderContent={<div style={{ backgroundColor: 'red', paddingTop: '4px' }}>Red Box</div>} />
	))
	.add('Data Table', () => (
		<DataTable
			config={dummyConfig}
			filterInputPlaceholder={'Filter table'}
			customTypes={{
				list: (props) => {
					const values = JSONPath({
						json: props.original,
						path: props.column.jsonPath,
					});
					const total = values.length;
					const firstValue = getSingleValue(values[0]);
					return total > 1 ? <a href="">{total} total</a> : firstValue || '';
				},
			}}
			fetchData={fetchDummyData}
			sessionStorage={true}
			storageKey="storybook"
			// Note: keepSelectedOnPageChange doesn't work atm because the row IDs are regenerated on page reload.
			//       Including this here as a reference that this needs to be toggled on to maintain storage between page loads
			keepSelectedOnPageChange={true}
		/>
	))
	.add('Live Data Table', () => <EnhancedDataTable />);
