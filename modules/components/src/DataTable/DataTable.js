import React from 'react';
import { isEqual } from 'lodash';
import urlJoin from 'url-join';

import { ARRANGER_API, PROJECT_ID } from '../utils/config';
import { Table, TableToolbar } from './';

class DataTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      pageSize: 20,
      sort: props.config.defaultSorted || [],
    };
    props.onSortedChange?.(props.config.defaultSorted);
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
      exportTSVFilename,
      maxPagesOptions,
      projectId = PROJECT_ID,
      downloadUrl = urlJoin(ARRANGER_API, projectId, 'download'),
      onSortedChange = () => {},
      alwaysSorted = [],
      initalSelectedTableRows = [],
      keepSelectedOnPageChange = false,
      filterInputPlaceholder,
    } = this.props;
    const { page, pageSize, total } = this.state;

    return (
      <>
        <TableToolbar
          filterInputPlaceholder={filterInputPlaceholder}
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
          exportTSVFilename={exportTSVFilename}
          downloadUrl={downloadUrl}
        />
        <Table
          style={tableStyle}
          propsData={data}
          sqon={sqon}
          config={config}
          fetchData={fetchData}
          setSelectedTableRows={setSelectedTableRows}
          onPaginationChange={state => this.setState(state)}
          onSortedChange={sort => {
            this.setState({ sort, page: 0 });
            onSortedChange(sort);
          }}
          defaultPageSize={pageSize}
          loading={loading}
          maxPagesOptions={maxPagesOptions}
          alwaysSorted={alwaysSorted}
          initalSelectedTableRows={initalSelectedTableRows}
          keepSelectedOnPageChange={keepSelectedOnPageChange}
        />
      </>
    );
  }
}
export default DataTable;
