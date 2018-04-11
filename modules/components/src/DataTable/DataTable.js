import React from 'react';
import { isEqual } from 'lodash';
import { Table, TableToolbar } from './';

class DataTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      pageSize: 20,
      sort: props.config.defaultSorted || [],
      fetchParam: null,
    };
  }
  componentWillReceiveProps(nextProps) {
    if (!isEqual(nextProps.sqon, this.props.sqon)) {
      this.setState({ page: 0 });
    }
  }
  render() {
    const {
      config,
      fetchData,
      setSelectedTableRows,
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
      columnDropdownText,
      exportTSVText,
      maxPagesOptions,
    } = this.props;
    const { page, pageSize, total, fetchParam } = this.state;

    const onTableFetchData = fetchData
      ? fetchParam => {
          this.setState({ fetchParam });
          return fetchData(fetchParam);
        }
      : null;

    return (
      <>
        <TableToolbar
          onFilterChange={onFilterChange}
          style={toolbarStyle}
          propsData={data}
          customActions={customActions}
          allowTogglingColumns={allowTogglingColumns}
          allowTSVExport={allowTSVExport}
          sqon={sqon}
          columns={config.columns}
          onColumnsChange={onColumnsChange}
          total={total}
          page={page}
          pageSize={pageSize}
          type={config.type}
          columnDropdownText={columnDropdownText}
          exportTSVText={exportTSVText}
          fetchParam={fetchParam}
          fetchData={fetchData}
        />
        <Table
          style={tableStyle}
          propsData={data}
          sqon={sqon}
          config={config}
          fetchData={onTableFetchData}
          setSelectedTableRows={setSelectedTableRows}
          onPaginationChange={state => this.setState(state)}
          onSortedChange={sort => this.setState({ sort, page: 0 })}
          defaultPageSize={pageSize}
          loading={loading}
          maxPagesOptions={maxPagesOptions}
        />
      </>
    );
  }
}
export default DataTable;
