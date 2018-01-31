import React from 'react';
import { isEqual } from 'lodash';
import { Table, TableToolbar } from './';

class DataTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      columns: props.config.columns,
      pageSize: 20,
      sort: props.config.defaultSorted,
    };
  }
  componentWillReceiveProps(nextProps) {
    const columns = nextProps.config.columns;

    if (!isEqual(columns, this.props.config.columns)) {
      this.setState({ columns });
    }
  }
  render() {
    const {
      fetchData,
      streamData,
      onSQONChange,
      onSelectionChange,
      sqon,
      allowTogglingColumns = true,
      allowTSVExport = true,
      customActions = null,
      data = null,
      loading = null,
      tableStyle,
      toolbarStyle,
    } = this.props;
    const { columns, page, pageSize, total, sort } = this.state;

    return (
      <>
        <TableToolbar
          style={toolbarStyle}
          propsData={data}
          customActions={customActions}
          allowTogglingColumns={allowTogglingColumns}
          allowTSVExport={allowTSVExport}
          onSQONChange={onSQONChange}
          streamData={options =>
            streamData({
              ...options,
              sort: sort.length
                ? sort.map(sort => ({
                    field: sort.id,
                    order: sort.desc ? 'desc' : 'asc',
                  }))
                : null,
            })
          }
          columns={columns}
          onColumnsChange={columns => this.setState({ columns })}
          total={total}
          page={page}
          pageSize={pageSize}
          type={this.props.config.type}
        />
        <Table
          style={tableStyle}
          propsData={data}
          sqon={sqon}
          config={{ ...this.props.config, columns }}
          fetchData={fetchData}
          onSelectionChange={onSelectionChange}
          onPaginationChange={state => this.setState(state)}
          onSortedChange={sort => this.setState({ sort, page: 0 })}
          defaultPageSize={pageSize}
          loading={loading}
        />
      </>
    );
  }
}
export default DataTable;
