import React from 'react';
import { isEqual } from 'lodash';
import { Table, TableToolbar } from './';

class DataTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      pageSize: 20,
      sort: props.config.defaultSorted,
    };
  }

  render() {
    const {
      config,
      fetchData,
      streamData,
      onSQONChange,
      onSelectionChange,
      sqon,
      allowTogglingColumns = true,
      allowTSVExport = true,
      customActions = null,
      data = null,
      loading = null,
      tableStyle,
      toolbarStyle,
      onFilterChange,
      onColumnsChange = () => {},
    } = this.props;
    const { page, pageSize, total, sort } = this.state;

    return (
      <>
        <TableToolbar
          onFilterChange={onFilterChange}
          style={toolbarStyle}
          propsData={data}
          customActions={customActions}
          allowTogglingColumns={allowTogglingColumns}
          allowTSVExport={allowTSVExport}
          onSQONChange={onSQONChange}
          streamData={options =>
            streamData({
              ...options,
              sort: sort.length
                ? sort.map(sort => ({
                    field: sort.id,
                    order: sort.desc ? 'desc' : 'asc',
                  }))
                : null,
            })
          }
          columns={config.columns}
          onColumnsChange={onColumnsChange}
          total={total}
          page={page}
          pageSize={pageSize}
          type={config.type}
        />
        <Table
          style={tableStyle}
          propsData={data}
          sqon={sqon}
          config={config}
          fetchData={fetchData}
          onSelectionChange={onSelectionChange}
          onPaginationChange={state => this.setState(state)}
          onSortedChange={sort => this.setState({ sort, page: 0 })}
          defaultPageSize={pageSize}
          loading={loading}
        />
      </>
    );
  }
}
export default DataTable;
