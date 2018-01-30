import React from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../DataTable';

export default ({
  newProjectName,
  setNewProjectName,
  addProject,
  projectsTotal,
  projects,
}) => (
  <DataTable
    customActions={
      <div>
        <input
          style={{ padding: 5 }}
          placeholder="New Project..."
          value={newProjectName}
          onChange={e => setNewProjectName({ newProjectName: e.target.value })}
        />
        <button onClick={addProject}>+</button>
      </div>
    }
    allowTogglingColumns={false}
    allowTSVExport={false}
    customTypes={{
      entity: props => {
        return <Link to={`/projects/${props.value}`}>{props.value}</Link>;
      },
      component: ({ value: Component }) => <Component />,
    }}
    config={{
      timestamp: '2018-01-12T16:42:07.495Z',
      type: 'Projects',
      keyField: 'id',
      defaultSorted: [{ id: 'id', desc: false }],
      columns: [
        {
          show: true,
          Header: 'ID',
          type: 'entity',
          sortable: true,
          canChangeShow: true,
          accessor: 'id',
        },
        {
          show: true,
          Header: '# Types',
          type: 'number',
          sortable: true,
          canChangeShow: true,
          accessor: 'types.total',
        },
        {
          show: true,
          Header: 'Active',
          type: 'component',
          sortable: false,
          canChangeShow: false,
          accessor: 'active',
        },
        {
          show: true,
          Header: 'Endpoint Status',
          type: 'component',
          sortable: false,
          canChangeShow: false,
          accessor: 'endpointStatus',
        },
        {
          show: true,
          Header: 'Delete',
          type: 'component',
          sortable: false,
          canChangeShow: false,
          accessor: 'delete',
        },
        {
          show: true,
          Header: 'ARRANGE!',
          type: 'component',
          sortable: false,
          canChangeShow: false,
          accessor: 'spinup',
        },
        {
          show: true,
          Header: 'decomission',
          type: 'component',
          sortable: false,
          canChangeShow: false,
          accessor: 'teardown',
        },
      ],
    }}
    data={{
      total: projectsTotal,
      data: projects,
    }}
    loading={false}
  />
);
