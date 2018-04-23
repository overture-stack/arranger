import React from 'react';
import { compose, withPropsOnChange, withState } from 'recompose';
import PaginationComponent from './DataTable/Table/CustomPagination';
import ReactTable from 'react-table';

const enhance = compose(
  withState('activeTab', 'setActiveTab', null),
  withPropsOnChange(['tabs'], ({ tabs, activeTab, setActiveTab }) => {
    const tabsWithKey = tabs.map(x => ({ ...x, key: x.key || x.title }));
    !activeTab && tabs?.length && setActiveTab(tabsWithKey[0].key);
    return { tabs: tabsWithKey };
  }),
);

export const TabsTable = ({
  className,
  columns,
  data,
  pageSize = 10,
  ...props
}) => (
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
      PaginationComponent: props => (
        <PaginationComponent
          {...props}
          showPageSizeOptions={false}
          paginationStyle={{ justifyContent: 'center' }}
        />
      ),
      ...props,
    }}
  />
);

const Tabs = ({ tabs, activeTab, setActiveTab }) =>
  tabs?.length && (
    <div className={`tabs`}>
      <div
        className={`tabs-titles`}
        css={`
          display: flex;
        `}
      >
        {tabs.map(({ key, title }) => (
          <div
            key={key}
            className={`tabs-title ${key === activeTab ? `active-tab` : ``}`}
            onClick={() => setActiveTab(key)}
          >
            {title}
          </div>
        ))}
      </div>
      <div className={`tabs-content`}>
        {tabs.find(t => t.key === activeTab)?.content}
      </div>
    </div>
  );

export default enhance(Tabs);
