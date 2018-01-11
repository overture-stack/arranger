import React from 'react';
import { isEqual } from 'lodash';
import DataTable, { TableToolbar } from '..';

class RepoView extends React.Component {
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
    const { fetchData, streamData, onSQONChange } = this.props;
    const { columns, page, pageSize, total, sort } = this.state;

    return (
      <div>
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
        <DataTable
          config={{ ...this.props.config, columns }}
          fetchData={fetchData}
          onSelectionChange={selection => console.log(selection)}
          onPaginationChange={state => this.setState(state)}
          onSortedChange={sort => this.setState({ sort })}
          defaultPageSize={pageSize}
        />
      </div>
    );
  }
}
export default RepoView;
