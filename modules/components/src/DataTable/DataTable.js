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
      default:
        return '';
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
      allowTogglingColumns = true,
      allowTSVExport = true,
      alwaysSorted = [],
      columnDropdownText,
      config,
      customActions = null,
      customHeaderContent = null,
      data = null,
      downloadUrl = '',
      enableDropDownControls = false,
      enableSelectedTableRowsExporterFilter,
      selectedRowsFilterPropertyName,
      exporter,
      exporterLabel,
      exportTSVFilename,
      exportTSVText,
      fetchData,
      filterInputPlaceholder,
      initalSelectedTableRows,
      InputComponent,
      keepSelectedOnPageChange = false,
      loading = null,
      maxPagesOptions,
      onColumnsChange = () => {},
      onFilterChange = () => {},
      onMultipleColumnsChange = () => {},
      onSortedChange = () => {},
      projectId = PROJECT_ID,
      sessionStorage,
      selectedTableRows = [],
      setSelectedTableRows = () => {},
      showFilterInput = true,
      sqon,
      tableStyle,
      toolbarStyle,
      transformParams,
    } = this.props;
    const { page, pageSize, sorted, total } = this.state;

    const url = downloadUrl || urlJoin(ARRANGER_API, projectId, 'download');

    return (
      <>
        <TableToolbar
          allColumns={config.allColumns}
          allowTSVExport={allowTSVExport}
          allowTogglingColumns={allowTogglingColumns}
          columnDropdownText={columnDropdownText}
          columns={config.columns}
          customActions={customActions}
          customHeaderContent={customHeaderContent}
          defaultColumns={config.defaultColumns}
          downloadUrl={url}
          enableDropDownControls={enableDropDownControls}
          enableSelectedTableRowsExporterFilter={enableSelectedTableRowsExporterFilter}
          exportTSVFilename={exportTSVFilename}
          exportTSVText={exportTSVText}
          exporter={exporter}
          exporterLabel={exporterLabel}
          filterInputPlaceholder={filterInputPlaceholder}
          InputComponent={InputComponent}
          keyField={config.keyField}
          onColumnsChange={onColumnsChange}
          onFilterChange={onFilterChange}
          onMultipleColumnsChange={onMultipleColumnsChange}
          page={page}
          pageSize={pageSize}
          propsData={data}
          selectedTableRows={selectedTableRows}
          showFilterInput={showFilterInput}
          sqon={sqon}
          style={toolbarStyle}
          total={total}
          transformParams={transformParams}
          type={config.type}
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
          keepSelectedOnPageChange={sessionStorage || keepSelectedOnPageChange} // If false, this will reset the selection to empty on reload. To keep selections after reload set this to true. Use sessionStorage or specific property to set this.
          selectedTableRows={selectedTableRows}
        />
      </>
    );
  }
}
export default DataTableWithToolbar;
