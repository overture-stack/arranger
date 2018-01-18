import { withNormalizedColumns } from './utils';
import TableToolbar from './TableToolbar';
import BaseTable from './Table';
import BaseDataTable from './DataTable';

const Table = withNormalizedColumns(BaseTable);
const DataTable = withNormalizedColumns(BaseDataTable);

export { Table, TableToolbar };
export { columnsToGraphql, getSingleValue } from './utils';
export default DataTable;
