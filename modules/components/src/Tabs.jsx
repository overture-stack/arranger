import { css } from '@emotion/react';
import cx from 'classnames';
import ReactTable from 'react-table-old';
import { compose, withPropsOnChange, withState } from 'recompose';

import Pagination from './Table/index.js';

const enhance = compose(
	withState('activeTab', 'setActiveTab', null),
	withPropsOnChange(['tabs'], ({ tabs, activeTab, setActiveTab }) => {
		const tabsWithKey = tabs.map((x) => ({ ...x, key: x.key || x.title }));
		!activeTab && tabs?.length && setActiveTab(tabsWithKey[0].key);
		return { tabs: tabsWithKey };
	}),
);

export const TabsTable = ({ className, columns, data, pageSize = 10, ...props }) => (
	<ReactTable
		{...{
			columns,
			data,
			className: `tabs-table ${className} -striped`,
			minRows: 0,
			sortable: false,
			resizable: false,
			pageSize,
			showPagination: data?.length > pageSize,
			PaginationComponent: (props) => (
				// TODO: this component relied on the old table. needs an update
				<Pagination {...props} showPageSizeOptions={false} paginationStyle={{ justifyContent: 'center' }} />
			),
			...props,
		}}
	/>
);

const Tabs = ({ tabs, activeTab, setActiveTab }) =>
	tabs?.length ? (
		<div className={`tabs`}>
			<div
				className={`tabs-titles`}
				css={css`
					display: flex;
				`}
			>
				{tabs.map(({ key, title }) => (
					<div
						key={key}
						className={cx('tabs-title', { 'active-tab': key === activeTab })}
						onClick={() => setActiveTab(key)}
					>
						{title}
					</div>
				))}
			</div>

			<div className={`tabs-content`}>{tabs.find(({ key }) => key === activeTab)?.content}</div>
		</div>
	) : null;

export default enhance(Tabs);
