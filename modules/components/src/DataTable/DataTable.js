import React from 'react';
import { get, intersection, xor } from 'lodash';

import ReactTable from './EnhancedReactTable';
import columnTypes from './columnTypes';

class DataTable extends React.Component {
  state = {
    selection: [],
    data: [],
    pages: -1,
    loading: false,
  };

  toggleSelection = key => {
    const selection = xor(this.state.selection, [key]);

    this.setState({
      selection,
    });
  };

  toggleAll = () => {
    const selection =
      this.state.selection.length === this.state.data.length
        ? []
        : this.state.data.map(item => item[this.props.keyField]);
    this.setState({ selection });
  };

  isSelected = key => {
    return this.state.selection.includes(key);
  };

  render() {
    const { toggleSelection, toggleAll, isSelected } = this;
    const { columns, keyField, fetchData } = this.props;
    const { data, selection, pages, loading } = this.state;

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
        <ReactTable
          data={data}
          columns={columns.map(column => ({
            ...column,
            Cell: column.Cell || columnTypes[column.type],
          }))}
          defaultPageSize={10}
          className="-striped -highlight"
          {...checkboxProps}
          {...fetchFromServerProps}
        />
      </div>
    );
  }
}

export default DataTable;
