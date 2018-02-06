import React from 'react';
import { debounce } from 'lodash';
import { compose, withProps, withPropsOnChange } from 'recompose';
import FontAwesomeIcon from '@fortawesome/react-fontawesome';

import saveTSV from './saveTSV';
import DropDown from '../../DropDown';
import TextInput from '../../Input';
import './Toolbar.css';

const enhance = compose(
  withProps(({ columns }) => ({
    canChangeShowColumns: columns.filter(column => column.canChangeShow),
  })),
  withPropsOnChange(['onFilterChange'], ({ onFilterChange = () => {} }) => ({
    debouncedOnFilterChange: debounce(onFilterChange, 300),
  })),
);

const TableToolbar = ({
  columns,
  canChangeShowColumns,
  onColumnsChange,
  onSQONChange,
  debouncedOnFilterChange,
  page = 0,
  pageSize = 0,
  propsData,
  total = propsData?.total || 0,
  type = '',
  allowTogglingColumns = true,
  allowTSVExport = true,
  customActions = null,
  streamData = () => {},
  style,
}) => (
  <div
    style={{ padding: 10, display: 'flex', flex: 'none', ...style }}
    className="tableToolbar"
  >
    <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
      Showing {(page * pageSize + 1).toLocaleString()} -{' '}
      {Math.min((page + 1) * pageSize, total).toLocaleString()} {type} of{' '}
      {total?.toLocaleString()}
    </div>
    <div className="group">
      <TextInput
        icon={<FontAwesomeIcon icon="search" />}
        type="text"
        placeholder="Filter"
        onChange={e => {
          debouncedOnFilterChange(e.target.value);
        }}
      />
      {allowTogglingColumns && (
        <DropDown
          itemToString={i => i.Header}
          items={canChangeShowColumns}
          onChange={item => {
            onColumnsChange({ ...item, show: !item.show });
          }}
        />
      )}
    </div>
    <div className="group">
      {allowTogglingColumns && (
        <DropDown
          itemToString={i => i.Header}
          items={canChangeShowColumns}
          onChange={item => {
            onColumnsChange(
              Object.assign([], columns, {
                [columns.indexOf(item)]: {
                  ...item,
                  show: !item.show,
                },
              }),
            );
          }}
        >
          Show columns
        </DropDown>
      )}
      {allowTSVExport && (
        <div className="buttonWrapper">
          <button
            style={{ display: 'flex', cursor: 'pointer' }}
            onClick={() => {
              saveTSV({ columns: columns.filter(c => c.show), streamData });
            }}
          >
            <div style={{ minHeight: 16 }}>Export TSV</div>
          </button>
        </div>
      )}
      {customActions}
    </div>
  </div>
);

export default enhance(TableToolbar);
