import React from 'react';
import { compose, withProps, withPropsOnChange, withState } from 'recompose';
import { debounce } from 'lodash';
import pluralize from 'pluralize';

import { currentFilterValue } from '../../SQONView/utils';
import TextFilter, { generateNextSQON } from '../../TextFilter';
import saveTSV from './saveTSV';
import { MultiSelectDropDown } from '../../DropDown';
import './Toolbar.css';

const enhance = compose(
  withProps(({ columns }) => ({
    canChangeShowColumns: columns.filter((column) => column.canChangeShow),
  })),
  withPropsOnChange(['onFilterChange'], ({ onFilterChange = () => {} }) => ({
    debouncedOnFilterChange: debounce(onFilterChange, 300),
  })),
  withState('filterVal', 'setFilterVal', ''),
  withPropsOnChange(['sqon'], ({ sqon, setFilterVal }) => {
    if (!currentFilterValue(sqon)) setFilterVal('');
  }),
);

const TableToolbar = ({
  columns,
  canChangeShowColumns,
  defaultColumns,
  onColumnsChange,
  onMultipleColumnsChange,
  filterVal,
  setFilterVal,
  onFilterChange,
  debouncedOnFilterChange,
  page = 0,
  pageSize = 0,
  propsData,
  filterInputPlaceholder = 'Filter',
  total = propsData?.total || 0,
  type = '',
  allowTogglingColumns = true,
  allowTSVExport = true,
  customActions = null,
  style,
  columnDropdownText = 'Show columns',
  exportTSVText = 'Export TSV',
  exportTSVFilename = `${type}-table.tsv`,
  exporter = saveTSV,
  transformParams = (params) => params,
  sqon,
  downloadUrl,
  InputComponent,
  showFilterInput = true,
  customHeaderContent = null,
}) => {
  const isPlural =
    total > 1 && pageSize > 1 && (Math.ceil(total / pageSize) !== page || total % pageSize > 1);
  return (
    <div style={{ display: 'flex', flex: 'none', ...style }} className="tableToolbar">
      <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
        Showing {(page * pageSize + 1).toLocaleString()} -{' '}
        {Math.min((page + 1) * pageSize, total).toLocaleString()} of {total?.toLocaleString()}{' '}
        {pluralize(type, isPlural ? 2 : 1)}
      </div>
      {!customHeaderContent ? null : customHeaderContent}
      <div className="group">
        {!showFilterInput ? null : (
          <TextFilter
            InputComponent={InputComponent}
            value={filterVal}
            placeholder={filterInputPlaceholder}
            onChange={({ value, generateNextSQON }) => {
              setFilterVal(value);
              debouncedOnFilterChange({ value, generateNextSQON });
            }}
          />
        )}
      </div>
      <div className="group">
        {allowTogglingColumns && (
          <MultiSelectDropDown
            buttonAriaLabelClosed={`Open column selection menu`}
            buttonAriaLabelOpen={`Close column selection menu`}
            itemSelectionLegend={`Select columns to display`}
            selectAllAriaLabel={`Select all columns`}
            resetToDefaultAriaLabel={`Reset to default columns`}
            itemToString={(i) => i.Header}
            items={canChangeShowColumns}
            defaultColumns={defaultColumns}
            onChange={(item) => {
              setFilterVal('');
              onFilterChange({
                value: '',
                generateNextSQON: generateNextSQON(''),
              });
              onColumnsChange({ ...item, show: !item.show });
            }}
            onMultipleChange={(changes) => {
              onMultipleColumnsChange(changes);
            }}
          >
            {columnDropdownText}
          </MultiSelectDropDown>
        )}
        {allowTSVExport && (
          <div className="buttonWrapper">
            <button
              style={{
                display: 'flex',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                minHeight: 16,
              }}
              onClick={() => {
                exporter(
                  transformParams({
                    url: downloadUrl,
                    files: [
                      {
                        fileName: exportTSVFilename,
                        fileType: 'tsv',
                        sqon,
                        index: type,
                        columns,
                      },
                    ],
                  }),
                );
              }}
            >
              {exportTSVText}
            </button>
          </div>
        )}
        {customActions}
      </div>
    </div>
  );
};

export default enhance(TableToolbar);
