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
      lastState: null,
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

  onFetchData = state => {
    const { fetchData, config } = this.props;
    const { selection } = this.state;

    this.setState({ loading: true, lastState: state });

    fetchData(config, {
      queryName: 'Table',
      sort: state.sorted.length
        ? state.sorted.map(sort => ({
            field: sort.id,
            order: sort.desc ? 'desc' : 'asc',
          }))
        : null,
      offset: state.page * state.pageSize,
      first: state.pageSize,
    }).then(({ total, data }) => {
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
  };

  componentDidUpdate(lastProps) {
    if (
      !this.state.loading &&
      lastProps.config.columns.some(
        (lastColumn, i) =>
          lastColumn.show !== this.props.config.columns[i].show,
      )
    ) {
      this.onFetchData(this.state.lastState);
    }
  }

  render() {
    const { toggleSelection, toggleAll, isSelected, onFetchData } = this;
    const { config, defaultPageSize } = this.props;
    const { columns, keyField, defaultSorted } = config;
    const { data, selection, pages, loading } = this.state;

    const fetchFromServerProps = {
      pages,
      loading,
      manual: true,
      onFetchData,
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
