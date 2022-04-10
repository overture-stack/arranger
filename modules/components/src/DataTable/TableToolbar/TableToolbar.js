import { compose, withProps, withPropsOnChange, withState } from 'recompose';
import { debounce } from 'lodash';
import pluralize from 'pluralize';
import { css } from '@emotion/react';

import { currentFilterValue } from '@/SQONViewer/utils';
import { useThemeContext } from '@/ThemeContext';

import DropDown, { MultiSelectDropDown } from '../../DropDown';
import TextFilter, { generateNextSQON } from '../../TextFilter';
import download from '../../utils/download';
import stringCleaner from '../../utils/stringCleaner';

import exporterProcessor from './helpers';
import './Toolbar.css';
import { useDataContext } from '@/DataContext';

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

/** Advanced Implementation details
 * This component allows library integrators to pass custom exporters (functionality to be run on the data, e.g. get JSON)
 * They can provide their own function (default is saveTSV) through `exporter`, and leverage other props like
 * `exportTSVText` and `exportTSVFilename` in order to customise the resulting button; or they can display multiple
 * options in a dropdown, by passing an array of objects with details like so:
 *
 * @param exporter [{
 *   @prop columns?: [''],
 *   Columns passed here override the ones being displayed in the table.
 *   If columns is undefined/null, the exporter will use all the columns shown in the table.
 *   However, if columns is an empty array, the exporter will use all the columns declared in the column-state config.
 *   @prop fileName?: '',
 *   When a fileName is given without a custom function, Arranger will produce a TSV file.
 *   @prop function?: () => {},
 *   The function attribute accepts 'saveTSV' as well, in case you wish to use a custom label for it.
 *   @prop label: '' || () => </>,
 *   A label doesn't require an exporter function, and can be a React component (e.g. to display instructions, a divider, etc.)
 *   furthermore, if label is 'saveTSV', Arranger will use its internal TSV exporter.
 *   @prop maxRows?: 100,
 *   @prop requiresRowSelection?: false,
 * }]
 */

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
  enableSelectedTableRowsExporterFilter = false,
  selectedRowsFilterPropertyName = 'file_autocomplete',
  exporter = null,
  exporterLabel = 'Download',
  exportMaxRows,
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
  selectedTableRows = [],
  setFilterVal,
  showFilterInput = true,
  sqon = {},
  style,
  total = propsData?.total || 0,
  transformParams = (params) => params,
}) => {
  const { documentType } = useDataContext();
  const { components: { Table: { DropDown: themeDropDownProps = {} } = {} } = {} } =
    useThemeContext();

  const isPlural =
    total > 1 && pageSize > 1 && (Math.ceil(total / pageSize) !== page || total % pageSize > 1);

  const { singleExporter, exporterArray, multipleExporters } = exporterProcessor(
    exporter,
    allowTSVExport,
    exportTSVText,
    exportMaxRows,
  );

  const hasSelectedRows = selectedTableRows.length > 0;

  const downloadSqon =
    enableSelectedTableRowsExporterFilter && hasSelectedRows
      ? {
          op: 'and',
          content: [
            {
              op: 'in',
              content: { field: selectedRowsFilterPropertyName, value: selectedTableRows },
            },
          ],
        }
      : sqon;

  return (
    <div style={{ display: 'flex', flex: 'none', ...style }} className="tableToolbar">
      <div
        className="currentlyDisplayed"
        style={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}
      >
        <span className="numbers">
          {`Showing ${(page * pageSize + 1).toLocaleString()} - ${Math.min(
            (page + 1) * pageSize,
            total,
          ).toLocaleString()}`}
        </span>{' '}
        <span className="ofTotal">of {total?.toLocaleString()}</span>{' '}
        <span className="type">{pluralize(documentType, isPlural ? 2 : 1)}</span>
      </div>
      {customHeaderContent || null}

      {showFilterInput && (
        <div className="group">
          <TextFilter
            Component={InputComponent}
            onChange={({ value, generateNextSQON } = {}) => {
              setFilterVal(value);
              debouncedOnFilterChange({ value, generateNextSQON });
            }}
            placeholder={filterInputPlaceholder}
            value={filterVal}
          />
        </div>
      )}

      <div className="group">
        {allowTogglingColumns &&
          (enableDropDownControls ? (
            <MultiSelectDropDown
              buttonAriaLabelClosed={`Open column selection menu`}
              buttonAriaLabelOpen={`Close column selection menu`}
              itemSelectionLegend={`Select columns to display`}
              selectAllAriaLabel={`Select all columns`}
              resetToDefaultAriaLabel={`Reset to default columns`}
              itemToString={(i) => i.header}
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
              {...themeDropDownProps}
            >
              {columnDropdownText}
            </MultiSelectDropDown>
          ) : (
            <DropDown
              aria-label={`Select columns`}
              itemToString={(i) => i.header}
              items={canChangeShowColumns}
              onChange={(item) => {
                setFilterVal('');
                onFilterChange({
                  value: '',
                  generateNextSQON: generateNextSQON(''),
                });
                onColumnsChange({ ...item, show: !item.show });
              }}
              {...themeDropDownProps}
            >
              {columnDropdownText}
            </DropDown>
          ))}

        {multipleExporters ? ( // check if we're given more than one custom exporter
          <div className="buttonWrapper">
            <DropDown
              aria-label={`Download options`}
              hasSelectedRows={hasSelectedRows}
              items={exporterArray}
              itemToString={(i) =>
                typeof i.exporterLabel === 'function' ? <i.exporterLabel /> : i.exporterLabel
              }
              onChange={({
                exporterColumns,
                exporterLabel,
                exporterFileName,
                exporterFunction,
                exporterMaxRows,
                exporterRequiresRowSelection,
              }) =>
                (exporterRequiresRowSelection && !hasSelectedRows) ||
                exporterFunction?.(
                  transformParams({
                    files: [
                      {
                        allColumns,
                        columns,
                        documentType,
                        maxRows: exporterMaxRows,
                        fileName: exporterFileName
                          ? `${exporterFileName}${
                              exporterFileName.toLowerCase().endsWith('.tsv') ? '' : '.tsv'
                            }`
                          : `${stringCleaner(exporterLabel.toLowerCase())}.tsv`,
                        fileType: 'tsv',
                        sqon: downloadSqon,
                        ...(exporterColumns && { exporterColumns }),
                      },
                    ],
                    selectedTableRows,
                    url: downloadUrl,
                  }),
                  download,
                )
              }
              singleSelect={true}
              {...themeDropDownProps}
            >
              {exporterLabel}
            </DropDown>
          </div>
        ) : (
          // else, use a custom function if any is given, or use the default saveTSV if the flag is on
          singleExporter && (
            <div className="buttonWrapper">
              <button
                disabled={exporter?.[0]?.requiresRowSelection && !hasSelectedRows}
                css={css`
                  display: flex;
                  min-height: 16;
                  white-space: nowrap;

                  &:not(:disabled):hover {
                    cursor: pointer;
                  }
                `}
                onClick={() => {
                  (exporter?.[0]?.requiresRowSelection && !hasSelectedRows) ||
                    singleExporter(
                      transformParams({
                        files: [
                          {
                            columns,
                            documentType,
                            fileName: exportTSVFilename || `${documentType}-table.tsv`,
                            fileType: 'tsv',
                            sqon: downloadSqon,
                          },
                        ],
                        selectedTableRows,
                        url: downloadUrl,
                      }),
                      download,
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
