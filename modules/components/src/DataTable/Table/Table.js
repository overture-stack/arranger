import React from 'react';
import { get, intersection, isEmpty, xor, noop } from 'lodash';
import { compose, defaultProps } from 'recompose';
import jsonpath from 'jsonpath/jsonpath.min';
import DetectScrollbarSize from 'react-scrollbar-size';

import createStyle from './style';
import ReactTable from './EnhancedReactTable';
import CustomPagination from './CustomPagination';

const enhance = compose(
  defaultProps({
    setSelectedTableRows: noop,
    onPaginationChange: noop,
    selectedTableRows: null,
  }),
);

class DataTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedTableRows:
        props.selectedTableRows || props.initalSelectedTableRows || [],
      data: [],
      pages: -1,
      loading: false,
      lastState: null,
      scrollbarSize: {},
    };
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    return {
      ...prevState,
      selectedTableRows:
        nextProps.selectedTableRows || prevState.selectedTableRows,
    };
  }

  setSelectedTableRows = selectedTableRows => {
    this.props.setSelectedTableRows(selectedTableRows);
    this.setState({ selectedTableRows });
  };

  toggleSelectedTableRow = key => {
    // react-table does some weird stuff and passes `select-${}` for some reason
    const sanitizedKey = key.split('select-').join('');
    const selectedTableRows = xor(this.state.selectedTableRows, [sanitizedKey]);
    this.setSelectedTableRows(selectedTableRows);
  };

  toggleAll = () => {
    const selectedTableRows =
      this.state.selectedTableRows.length === this.state.data.length
        ? []
        : this.state.data.map(item => item[this.props.config.keyField]);

    this.setSelectedTableRows(selectedTableRows);
  };

  isSelected = key => {
    return this.state.selectedTableRows.includes(key);
  };

  // QUESTION: onFetchData? isn't this doing the actual fetching
  onFetchData = state => {
    const {
      fetchData,
      config,
      sqon,
      alwaysSorted = [],
      keepSelectedOnPageChange,
    } = this.props;
    const { selectedTableRows } = this.state;

    this.setState({ loading: true, lastState: state });

    fetchData?.({
      config,
      sqon,
      queryName: 'Table',
      sort: [
        ...state.sorted.map(sort => ({
          field: sort.id,
          order: sort.desc ? 'desc' : 'asc',
        })),
        ...alwaysSorted,
      ],
      offset: state.page * state.pageSize,
      first: state.pageSize,
    })
      .then(({ total, data }) => {
        if (total !== this.state.total) {
          this.props.onPaginationChange({ total });
        }
        this.setState({
          data,
          total,
          pages: Math.ceil(total / state.pageSize),
          loading: false,
        });

        if (!keepSelectedOnPageChange) {
          this.setSelectedTableRows(
            intersection(
              data.map(item => item[this.props.config.keyField]),
              selectedTableRows,
            ),
          );
        }
      })
      .catch(err => {
        console.error(err);
        this.setState({ loading: false });
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
    const { toggleSelectedTableRow, toggleAll, isSelected, onFetchData } = this;
    const {
      config,
      defaultPageSize,
      onSortedChange,
      propsData,
      loading: propsLoading,
      style,
      maxPagesOptions,
    } = this.props;
    const { columns, keyField, defaultSorted } = config;
    const {
      data,
      selectedTableRows,
      pages,
      loading,
      scrollbarSize,
    } = this.state;

    const fetchFromServerProps = {
      pages,
      loading: propsLoading !== null ? propsLoading : loading,
      manual: true,
      onFetchData,
    };

    const checkboxProps = {
      selectAll: selectedTableRows.length === data.length,
      isSelected,
      toggleSelection: toggleSelectedTableRow,
      toggleAll,
      selectType: 'checkbox',
      keyField,
    };
    return (
      <>
        <DetectScrollbarSize
          onLoad={scrollbarSize => this.setState({ scrollbarSize })}
          onChange={scrollbarSize => this.setState({ scrollbarSize })}
        />
        <ReactTable
          minRows={0}
          className={`-striped -highlight ${createStyle({ scrollbarSize })}`}
          style={style}
          onSortedChange={onSortedChange}
          onPageChange={page => this.props.onPaginationChange({ page })}
          onPageSizeChange={(pageSize, page) =>
            this.props.onPaginationChange({ pageSize, page })
          }
          data={propsData?.data || data}
          defaultSorted={defaultSorted}
          columns={columns.map(
            ({ Cell, ...c }) => ({
              ...c,
              ...(!c.hasCustomType && !isEmpty(c.extendedDisplayValues)
                ? {
                    accessor: x => {
                      const values = c.accessor
                        ? [get(x, c.accessor)]
                        : jsonpath.query(x, c.jsonPath);
                      return values
                        .map(x => c.extendedDisplayValues[`${x}`] || x)
                        .join(', ');
                    },
                    id: c.field,
                  }
                : { Cell }),
            }),
            {},
          )}
          defaultPageSize={defaultPageSize}
          PaginationComponent={props => (
            <CustomPagination {...props} maxPagesOptions={maxPagesOptions} />
          )}
          {...checkboxProps}
          {...fetchFromServerProps}
        />
      </>
    );
  }
}

export default enhance(DataTable);
