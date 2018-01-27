import React from 'react';
import { isEqual } from 'lodash';
import { Table, TableToolbar } from './';

class DataTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      columns: props.config.columns,
      pageSize: 10,
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
    } = this.props;
    const { columns, page, pageSize, total, sort } = this.state;

    return (
      <>
        <TableToolbar
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
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            top: 50,
          }}
        >
          <Table
            sqon={sqon}
            config={{ ...this.props.config, columns }}
            fetchData={fetchData}
            onSelectionChange={onSelectionChange}
            onPaginationChange={state => this.setState(state)}
            onSortedChange={sort => this.setState({ sort, page: 0 })}
            defaultPageSize={pageSize}
          />
        </div>
      </>
    );
  }
}
export default DataTable;
