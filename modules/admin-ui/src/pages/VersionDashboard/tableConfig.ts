import { Column } from 'react-table';

const tableConfigs: Column[] = [
  {
    show: true,
    Header: 'ID',
    sortable: true,
    accessor: 'id',
  },
  {
    show: true,
    Header: 'Index count',
    sortable: true,
    accessor: 'indices.length',
  },
];

export default tableConfigs;
