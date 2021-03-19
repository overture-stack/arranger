import React from 'react';
import { compose, withProps, withPropsOnChange, withState } from 'recompose';
import { debounce } from 'lodash';
import pluralize from 'pluralize';

import { currentFilterValue } from '../../SQONView/utils';
import stringCleaner from '../../utils/stringCleaner';
import TextFilter, { generateNextSQON } from '../../TextFilter';
import { exporterProcessor, saveTSV } from './helpers';
import DropDown, { MultiSelectDropDown } from '../../DropDown';
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
  allColumns = [],
  allowTogglingColumns = true,
  allowTSVExport = true,
  canChangeShowColumns,
  columnDropdownText = 'Show columns',
  columns,
  customActions = null,
  customHeaderContent = null,
  debouncedOnFilterChange,
  defaultColumns,
  downloadUrl,
  enableDropDownControls = false,
  exporter = null,
  exporterLabel = 'Download',
  exportTSVFilename = '',
  exportTSVText = 'Export TSV',
  filterInputPlaceholder = 'Filter',
  filterVal,
  InputComponent,
  onColumnsChange,
  onFilterChange,
  onMultipleColumnsChange,
  page = 0,
  pageSize = 0,
  propsData,
  setFilterVal,
  showFilterInput = true,
  sqon,
  style,
  total = propsData?.total || 0,
  transformParams = (params) => params,
  type = '',
}) => {
  const isPlural =
    total > 1 && pageSize > 1 && (Math.ceil(total / pageSize) !== page || total % pageSize > 1);

  const { customExporter, exporterArray, multipleExporters } = exporterProcessor(
    exporter,
    allowTSVExport,
    exportTSVText,
    columns,
  );

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
        {allowTogglingColumns &&
          (enableDropDownControls ? (
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
          ) : (
            <DropDown
              aria-label={`Select columns`}
              itemToString={(i) => i.Header}
              items={canChangeShowColumns}
              onChange={(item) => {
                setFilterVal('');
                onFilterChange({
                  value: '',
                  generateNextSQON: generateNextSQON(''),
                });
                onColumnsChange({ ...item, show: !item.show });
              }}
            >
              {columnDropdownText}
            </DropDown>
          ))}

        {multipleExporters ? ( // check if we're given more than one custom exporter
          <DropDown
            aria-label={`Download options`}
            itemToString={(i) => i.exLabel}
            items={exporterArray}
            onChange={({ exColumns, exLabel, exFunction }) =>
              exFunction(
                transformParams({
                  url: downloadUrl,
                  files: [
                    {
                      allColumns,
                      columns,
                      fileName: `${stringCleaner(exLabel.toLowerCase())}.tsv`,
                      fileType: 'tsv',
                      index: type,
                      sqon,
                      ...(exColumns && { exColumns }),
                    },
                  ],
                }),
              )
            }
            singleSelect={true}
          >
            {exporterLabel}
          </DropDown>
        ) : (
          // else, use a custom function if any is given, or use the default saveTSV if the flag is on
          (customExporter || allowTSVExport) && (
            <div className="buttonWrapper">
              <button
                style={{
                  display: 'flex',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  minHeight: 16,
                }}
                onClick={() => {
                  (customExporter || saveTSV)(
                    transformParams({
                      url: downloadUrl,
                      files: [
                        {
                          fileName: exportTSVFilename || `${type}-table.tsv`,
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
          )
        )}
        {customActions}
      </div>
    </div>
  );
};

export default enhance(TableToolbar);
