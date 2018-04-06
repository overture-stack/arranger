import React from 'react';
import { compose, withProps, withPropsOnChange, withState } from 'recompose';
import { debounce } from 'lodash';

import { currentFilterValue } from '../../SQONView/utils';
import TextFilter, { generateNextSQON } from '../../TextFilter';
import saveTSV from './saveTSV';
import DropDown from '../../DropDown';
import './Toolbar.css';

const enhance = compose(
  withProps(({ columns }) => ({
    canChangeShowColumns: columns.filter(column => column.canChangeShow),
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
  onColumnsChange,
  filterVal,
  setFilterVal,
  onFilterChange,
  debouncedOnFilterChange,
  page = 0,
  pageSize = 0,
  propsData,
  total = propsData?.total || 0,
  type = '',
  allowTogglingColumns = true,
  allowTSVExport = true,
  customActions = null,
  style,
  columnDropdownText = 'Show columns',
  exportTSVText = 'Export TSV',
  sqon,
}) => (
  <div
    style={{ display: 'flex', flex: 'none', ...style }}
    className="tableToolbar"
  >
    <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
      Showing {(page * pageSize + 1).toLocaleString()} -{' '}
      {Math.min((page + 1) * pageSize, total).toLocaleString()} of{' '}
      {total?.toLocaleString()} {type}
    </div>
    <div className="group">
      <TextFilter
        value={filterVal}
        onChange={({ value, generateNextSQON }) => {
          setFilterVal(value);
          debouncedOnFilterChange({ value, generateNextSQON });
        }}
      />
    </div>
    <div className="group">
      {allowTogglingColumns && (
        <DropDown
          itemToString={i => i.Header}
          items={canChangeShowColumns}
          onChange={item => {
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
              saveTSV({
                files: [
                  {
                    fileName: `${type}-table.tsv`,
                    sqon,
                    index: type,
                    columns,
                  },
                ],
              });
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

export default enhance(TableToolbar);
