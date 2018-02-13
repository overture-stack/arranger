import React from 'react';
import { intersection, xor, noop } from 'lodash';
import { compose, defaultProps } from 'recompose';
import ReactTable from './EnhancedReactTable';
import CustomPagination from './CustomPagination';

const enhance = compose(
  defaultProps({
    setSelection: noop,
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
    this.props.setSelection(selection);
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

  // QUESTION: onFetchData? isn't this doing the actual fetching
  onFetchData = state => {
    const { fetchData, config, sqon } = this.props;
    const { selection } = this.state;

    this.setState({ loading: true, lastState: state });

    fetchData?.({
      config,
      sqon,
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

    // TODO: in receive props? better if else ladder?
    if (this.props.sqon !== lastProps.sqon) {
      this.onFetchData(this.state.lastState);
    }
  }

  render() {
    const { toggleSelection, toggleAll, isSelected, onFetchData } = this;
    const {
      config,
      defaultPageSize,
      onSortedChange,
      propsData,
      loading: propsLoading,
      style,
    } = this.props;
    const { columns, keyField, defaultSorted } = config;
    const { data, selection, pages, loading } = this.state;

    const fetchFromServerProps = {
      pages,
      loading: propsLoading !== null ? propsLoading : loading,
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
        style={style}
        onSortedChange={onSortedChange}
        onPageChange={page => this.props.onPaginationChange({ page })}
        onPageSizeChange={(pageSize, page) =>
          this.props.onPaginationChange({ pageSize, page })
        }
        data={propsData?.data || data}
        defaultSorted={defaultSorted}
        columns={columns}
        defaultPageSize={defaultPageSize}
        className="-striped -highlight"
        PaginationComponent={CustomPagination}
        {...checkboxProps}
        {...fetchFromServerProps}
      />
    );
  }
}

export default enhance(DataTable);
