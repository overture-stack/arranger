import React from 'react';
import { isEqual, get, intersection, xor, noop } from 'lodash';

import ReactTable from './EnhancedReactTable';
import columnTypes from './columnTypes';
import { compose, defaultProps } from 'recompose';
import DropDown from './DropDown';

const enhance = compose(
  defaultProps({
    onSelectionChange: noop,
  }),
);

function normalizeColumns(columns) {
  return columns.map(function(column) {
    return {
      ...column,
      show: typeof column.show === 'boolean' ? column.show : true,
      Cell: column.Cell || columnTypes[column.type],
    };
  });
}

class DataTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selection: [],
      data: [],
      pages: -1,
      loading: false,
      columns: normalizeColumns(props.config.columns),
    };
  }

  setSelection(selection) {
    this.props.onSelectionChange(selection);
    this.setState({ selection });
  }

  toggleSelection = key => {
    const selection = xor(this.state.selection, [key]);

    this.setSelection(selection);
  };

  toggleAll = () => {
    const selection =
      this.state.selection.length === this.state.data.length
        ? []
        : this.state.data.map(item => item[this.props.keyField]);

    this.setSelection(selection);
  };

  isSelected = key => {
    return this.state.selection.includes(key);
  };

  componentWillReceiveProps(nextProps) {
    const nextColumns = nextProps.config.columns;
    if (!isEqual(nextColumns, this.props.config.columns)) {
      this.setState({ columns: normalizeColumns(nextColumns) });
    }
  }
  render() {
    const { toggleSelection, toggleAll, isSelected } = this;
    const { config: { keyField, defaultSorted }, fetchData } = this.props;
    const { columns, data, selection, pages, loading } = this.state;

    const fetchFromServerProps = {
      pages,
      loading,
      manual: true,
      onFetchData: state => {
        this.setState({ loading: true });

        fetchData({
          queryName: 'Table',
          sort: state.sorted.length
            ? state.sorted.map(sort => ({
                field: sort.id,
                order: sort.desc ? 'desc' : 'asc',
              }))
            : null,
          offset: state.page * state.pageSize,
          first: state.pageSize,
        }).then(res => {
          const hits = get(res, 'data.files.hits') || {};
          const data = get(hits, 'edges', []).map(e => e.node);

          this.setState({
            data,
            pages: Math.ceil((hits.total || 0) / state.pageSize),
            loading: false,
            selection: intersection(
              data.map(item => item[this.props.keyField]),
              selection,
            ),
          });
        });
      },
    };

    const checkboxProps = {
      selectAll: selection.length === data.length,
      isSelected,
      toggleSelection,
      toggleAll,
      selectType: 'checkbox',
      keyField,
    };

    return (
      <div>
        <div style={{ padding: 10, display: 'flex' }}>
          <DropDown
            itemToString={i => i.Header}
            items={columns}
            onChange={item => {
              this.setState({
                columns: Object.assign([], columns, {
                  [columns.indexOf(item)]: {
                    ...item,
                    show: !item.show,
                  },
                }),
              });
            }}
          />
        </div>
        <ReactTable
          data={data}
          defaultSorted={defaultSorted}
          columns={columns}
          defaultPageSize={10}
          className="-striped -highlight"
          {...checkboxProps}
          {...fetchFromServerProps}
        />
      </div>
    );
  }
}

export default enhance(DataTable);
