import React from 'react';
import { get, intersection, xor, noop } from 'lodash';

import ReactTable from './EnhancedReactTable';

import { compose, defaultProps } from 'recompose';

const enhance = compose(
  defaultProps({
    onSelectionChange: noop,
    onPaginationChange: noop,
  }),
);

class DataTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selection: [],
      data: [],
      pages: -1,
      loading: false,
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
        : this.state.data.map(item => item[this.props.config.keyField]);

    this.setSelection(selection);
  };

  isSelected = key => {
    return this.state.selection.includes(key);
  };
  render() {
    const { toggleSelection, toggleAll, isSelected } = this;
    const {
      config: { columns, keyField, defaultSorted },
      fetchData,
      defaultPageSize,
    } = this.props;
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
          const total = hits.total || 0;
          if (total !== this.state.total) {
            this.props.onPaginationChange({ total });
          }
          this.setState({
            data,
            total,
            pages: Math.ceil(total / state.pageSize),
            loading: false,
          });
          this.setSelection(
            intersection(
              data.map(item => item[this.props.config.keyField]),
              selection,
            ),
          );
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
      <ReactTable
        onPageChange={page => this.props.onPaginationChange({ page })}
        onPageSizeChange={(pageSize, page) =>
          this.props.onPaginationChange({ pageSize, page })
        }
        data={data}
        defaultSorted={defaultSorted}
        columns={columns}
        defaultPageSize={defaultPageSize}
        className="-striped -highlight"
        {...checkboxProps}
        {...fetchFromServerProps}
      />
    );
  }
}

export default enhance(DataTable);
