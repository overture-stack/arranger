import React from 'react';
import { isEqual } from 'lodash';
import urlJoin from 'url-join';

import { ARRANGER_API, PROJECT_ID } from '../utils/config';
import { Table, TableToolbar } from './';

const STORED_PROPS = {
  PAGE_SIZE: 'PAGE_SIZE',
  SORT_ORDER: 'SORT_ORDER',
  SELECTED_ROWS: 'SELECTED_ROWS',
};

class DataTableWithToolbar extends React.Component {
  constructor(props) {
    super(props);

    let pageSize = 20;
    let sorted = props.config.defaultSorted || [];
    let selectedTableRows = [];

    // Read initial config settings from session storage, if enabled:
    if (this.props.sessionStorage) {
      const storedSorted = JSON.parse(
        window.sessionStorage.getItem(this.getStorageKey(STORED_PROPS.SORT_ORDER)),
      );
      const storedPageSize = JSON.parse(
        window.sessionStorage.getItem(this.getStorageKey(STORED_PROPS.PAGE_SIZE)),
      );
      const storedSelectedRows = JSON.parse(
        window.sessionStorage.getItem(this.getStorageKey(STORED_PROPS.SELECTED_ROWS)),
      );
      if (storedSorted) {
        sorted = storedSorted;
        this.props.config.defaultSorted = sorted;
      }
      if (storedPageSize) {
        pageSize = storedPageSize;
      }
      if (storedSelectedRows && storedSelectedRows.length) {
        selectedTableRows = storedSelectedRows;
      }
    }

    this.state = {
      pageSize,
      sorted,
      selectedTableRows,
    };

    props.onSortedChange?.(sorted);
  }

  getStorageKey(prop) {
    switch (prop) {
      case STORED_PROPS.PAGE_SIZE:
        return `arranger-table-pagesize-${this.props.storageKey || ''}`;
      case STORED_PROPS.SORT_ORDER:
        return `arranger-table-sorted-${this.props.storageKey || ''}`;
      case STORED_PROPS.SELECTED_ROWS:
        return `arranger-table-selectedrows-${this.props.storageKey || ''}`;
    }
  }

  storeProperty(prop, value) {
    if (this.props.sessionStorage) {
      const stringValue = JSON.stringify(value);
      window.sessionStorage.setItem(this.getStorageKey(prop), stringValue);
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
      setSelectedTableRows = () => {},
      sqon,
      selectedTableRows = null,
      allowTogglingColumns = true,
      allowTSVExport = true,
      customActions = null,
      data = null,
      loading = null,
      tableStyle,
      toolbarStyle,
      onFilterChange = () => {},
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
      initalSelectedTableRows,
      keepSelectedOnPageChange = false, // If false, this will reset the selection to empty on reload even if sessionStorage is enabled. To keep selections after reload st this to true.
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
          setSelectedTableRows={(selectedTableRows) => {
            setSelectedTableRows(selectedTableRows);
            this.storeProperty(STORED_PROPS.SELECTED_ROWS, selectedTableRows);
          }}
          onPaginationChange={(state) => {
            this.setState(state);
            if (state.pageSize) {
              this.storeProperty(STORED_PROPS.PAGE_SIZE, state.pageSize);
            }
          }}
          onSortedChange={(sorted) => {
            this.setState({ sorted, page: 0 });
            onSortedChange(sorted);
            this.storeProperty(STORED_PROPS.SORT_ORDER, sorted);
          }}
          defaultPageSize={pageSize}
          defaultSorted={sorted}
          sorted={sorted}
          loading={loading}
          maxPagesOptions={maxPagesOptions}
          alwaysSorted={alwaysSorted}
          initalSelectedTableRows={initalSelectedTableRows || this.state.selectedTableRows}
          keepSelectedOnPageChange={keepSelectedOnPageChange}
          selectedTableRows={selectedTableRows}
        />
      </>
    );
  }
}
export default DataTableWithToolbar;
