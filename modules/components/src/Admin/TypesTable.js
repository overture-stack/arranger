import React from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../DataTable';

export default ({
  total,
  data,
  customActions,
  projectId,
  onLinkClick,
  basePath,
}) => (
  <DataTable
    customActions={customActions}
    allowTogglingColumns={false}
    allowTSVExport={false}
    customTypes={{
      entity: props => {
        return (
          <Link
            to={`${basePath}/${projectId}/${props.value}`}
            onClick={() => onLinkClick(props.value)}
          >
            {props.value}
          </Link>
        );
      },
      boolean: props => (props.value ? 'Yes' : 'No'),
      component: ({ value: Component }) => <Component />,
    }}
    config={{
      timestamp: '2018-01-12T16:42:07.495Z',
      type: 'Index Types',
      keyField: 'id',
      defaultSorted: [{ id: 'id', desc: false }],
      columns: [
        {
          show: true,
          Header: 'Index',
          type: 'entity',
          sortable: true,
          canChangeShow: true,
          accessor: 'index',
        },
        {
          show: true,
          Header: 'Display Name',
          type: 'text',
          sortable: true,
          canChangeShow: true,
          accessor: 'name',
        },
        {
          show: true,
          Header: 'Active',
          type: 'boolean',
          sortable: false,
          canChangeShow: false,
          accessor: 'active',
        },
        {
          show: true,
          Header: 'Has Mapping',
          type: 'boolean',
          sortable: false,
          canChangeShow: false,
          accessor: 'mappings',
        },
        {
          show: true,
          Header: 'Delete',
          type: 'component',
          sortable: false,
          canChangeShow: false,
          accessor: 'delete',
        },
      ],
    }}
    data={{
      total,
      data,
    }}
    loading={false}
  />
);
