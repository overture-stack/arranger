import React from 'react';
import { isEqual } from 'lodash';
import { Table, TableToolbar } from './';
import { Subject } from 'rxjs';

class DataTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      pageSize: 20,
      sort: props.config.defaultSorted || [],
      toolbarDisplayType: null,
    };
    const { config: { type } } = props;

    this.$fetchedData = new Subject();
    this.$fetchedData.subscribe(({ data }) => {
      this.setState({
        toolbarDisplayType: type + (data.length > 1 ? 's' : ''),
      });
    });
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
    const { page, pageSize, total, toolbarDisplayType } = this.state;
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
          type={toolbarDisplayType}
          columnDropdownText={columnDropdownText}
          exportTSVText={exportTSVText}
        />
        <Table
          style={tableStyle}
          propsData={data}
          sqon={sqon}
          config={config}
          fetchData={fetchData}
          setSelectedTableRows={setSelectedTableRows}
          onPaginationChange={state => this.setState(state)}
          onSortedChange={sort => this.setState({ sort, page: 0 })}
          defaultPageSize={pageSize}
          loading={loading}
          maxPagesOptions={maxPagesOptions}
          $fetchedData={this.$fetchedData}
        />
      </>
    );
  }
}
export default DataTable;
