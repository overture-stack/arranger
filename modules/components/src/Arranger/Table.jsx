import Spinner from 'react-spinkit';

import DataTable, { ColumnsState } from '#DataTable/index.js';
import { withTableContext } from '#Table/index.js';
import defaultApiFetcher from '#utils/api.js';
import noopFn from '#utils/noops.js';

/**
 * @param {Object} props
 * @param {import('#types.js').SQONType} props.sqon
 */
const Table = ({
	onFilterChange = noopFn,
	documentType = '',
	fetchData = defaultApiFetcher,
	setSQON = noopFn,
	sqon = null,
	fieldTypesForFilter = ['text', 'keyword'],
	apiFetcher,
	InputComponent,
	showFilterInput = true,
	customHeaderContent = null,
	sessionStorage = false, // Use session storage to save selected columns, page size, and column sort.
	storageKey = '', // Identifier to use in session storage property name where state info is stored. Use the same save-key in multiple tables to share save state.
	...props
}) => {
	return (
		<ColumnsState
			documentType={documentType}
			apiFetcher={apiFetcher}
			sessionStorage={sessionStorage}
			storageKey={storageKey}
			render={(tableConfigs = {}) => {
				return tableConfigs.loading ? (
					<Spinner fadeIn="full" name="circle" />
				) : (
					<DataTable
						{...{ ...props, apiFetcher, showFilterInput, customHeaderContent }}
						InputComponent={InputComponent}
						sqon={sqon}
						config={{
							...tableConfigs.state,
							// generates a handy dictionary with all the available columns
							allColumns: tableConfigs.state.columns?.reduce(
								(columnsDict, column) => ({
									...columnsDict,
									[column.field]: column,
								}),
								{},
							),
							documentType,
						}}
						fetchData={fetchData}
						onColumnsChange={tableConfigs.toggle}
						onMultipleColumnsChange={tableConfigs.toggleMultiple}
						onFilterChange={({ generateNextSQON, value }) => {
							onFilterChange(value);
							setSQON(
								generateNextSQON({
									sqon,
									fieldNames: tableConfigs.state.columns
										.filter((x) => fieldTypesForFilter.includes(x.type) && x.show)
										.map((x) => x.field),
								}),
							);
						}}
						sessionStorage={sessionStorage}
						storageKey={storageKey}
					/>
				);
			}}
		/>
	);
};

export default withTableContext(Table);
