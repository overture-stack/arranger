import React from 'react';
import { isEqual } from 'lodash';
import urlJoin from 'url-join';

import { ARRANGER_API, PROJECT_ID } from '../utils/config';
import { Table, TableToolbar } from './';

class DataTableWithToolbar extends React.Component {
  constructor(props) {
    super(props);

    let pageSize = 20;
    let sorted = props.config.defaultSorted || [];

    // Read initial config settings from session storage, if enabled:
    if (this.props.sessionStorage) {
      const storedSorted = JSON.parse(window.sessionStorage.getItem(this.getSortedStorageKey()));
      const storedPageSize = JSON.parse(
        window.sessionStorage.getItem(this.getPageSizeStorageKey()),
      );
      if (storedSorted) {
        sorted = storedSorted;
        this.props.config.defaultSorted = sorted;
      }
      if (storedPageSize) {
        pageSize = storedPageSize;
      }
    }

    this.state = {
      pageSize,
      sorted,
    };

    props.onSortedChange?.(sorted);
  }

  getPageSizeStorageKey() {
    return `arranger-table-pagesize-${this.props.storageKey || ''}`;
  }
  getSortedStorageKey() {
    return `arranger-table-sorted-${this.props.storageKey || ''}`;
  }

  storeSorted(sorted) {
    if (this.props.sessionStorage) {
      window.sessionStorage.setItem(this.getSortedStorageKey(), JSON.stringify(sorted));
    }
  }

  storePageSize(pageSize) {
    if (this.props.sessionStorage) {
      window.sessionStorage.setItem(this.getPageSizeStorageKey(), JSON.stringify(pageSize));
    }
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
      selectedTableRows = null,
      allowTogglingColumns = true,
      allowTSVExport = true,
      customActions = null,
      data = null,
      loading = null,
      tableStyle,
      toolbarStyle,
      onFilterChange,
      onColumnsChange = () => {},
      onMultipleColumnsChange = () => {},
      columnDropdownText,
      enableDropDownControls = false,
      exportTSVText,
      exportTSVFilename,
      exporter,
      transformParams,
      maxPagesOptions,
      projectId = PROJECT_ID,
      downloadUrl = urlJoin(ARRANGER_API, projectId, 'download'),
      onSortedChange = () => {},
      alwaysSorted = [],
      initalSelectedTableRows = [],
      keepSelectedOnPageChange = false,
      showFilterInput = true,
      filterInputPlaceholder,
      InputComponent,
      customHeaderContent = null,
    } = this.props;
    const { page, pageSize, sorted, total } = this.state;
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
          defaultColumns={config.defaultColumns}
          onColumnsChange={onColumnsChange}
          onMultipleColumnsChange={onMultipleColumnsChange}
          total={total}
          page={page}
          pageSize={pageSize}
          type={config.type}
          columnDropdownText={columnDropdownText}
          enableDropDownControls={enableDropDownControls}
          exportTSVText={exportTSVText}
          exportTSVFilename={exportTSVFilename}
          exporter={exporter}
          transformParams={transformParams}
          downloadUrl={downloadUrl}
          InputComponent={InputComponent}
          showFilterInput={showFilterInput}
          customHeaderContent={customHeaderContent}
        />
        <Table
          style={tableStyle}
          propsData={data}
          sqon={sqon}
          config={config}
          fetchData={fetchData}
          setSelectedTableRows={setSelectedTableRows}
          onPaginationChange={(state) => {
            this.setState(state);
            if (state.pageSize) {
              this.storePageSize(state.pageSize);
            }
          }}
          onSortedChange={(sorted) => {
            this.setState({ sorted, page: 0 });
            onSortedChange(sorted);
            this.storeSorted(sorted);
          }}
          defaultPageSize={pageSize}
          defaultSorted={sorted}
          loading={loading}
          maxPagesOptions={maxPagesOptions}
          alwaysSorted={alwaysSorted}
          initalSelectedTableRows={initalSelectedTableRows}
          keepSelectedOnPageChange={keepSelectedOnPageChange}
          selectedTableRows={selectedTableRows}
        />
      </>
    );
  }
}
export default DataTableWithToolbar;
