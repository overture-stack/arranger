import React from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../DataTable';

export default ({ total, data, customActions, projectId, onLinkClick }) => (
  <DataTable
    customActions={customActions}
    allowTogglingColumns={false}
    allowTSVExport={false}
    customTypes={{
      entity: props => {
        return (
          <Link
            to={`/projects/${projectId}/${props.value}`}
            onClick={() => onLinkClick(props.value)}
          >
            {props.value}
          </Link>
        );
      },
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
        // {
        //   show: true,
        //   Header: '# Types',
        //   type: 'number',
        //   sortable: true,
        //   canChangeShow: true,
        //   accessor: 'types.total',
        // },
        // {
        //   show: true,
        //   Header: 'Active',
        //   type: 'component',
        //   sortable: false,
        //   canChangeShow: false,
        //   accessor: 'active',
        // },
        // {
        //   show: true,
        //   Header: 'Has Mapping',
        //   type: 'component',
        //   sortable: false,
        //   canChangeShow: false,
        //   accessor: 'mapping',
        // },
      ],
    }}
    data={{
      total,
      data,
    }}
    loading={false}
  />
);
