export const downloadsConfigs = `
	downloads {
		allowCustomMaxRows
		maxRows
	}
`;

export const facetsConfigs = `
	facets {
		aggregations {
			displayType
			fieldName
			isActive
			show
		}
	}
`;

export const tableConfigs = `
	table {
		columns {
			accessor
			canChangeShow
			displayFormat
			displayName
			displayValues
			fieldName
			id
			isArray
			jsonPath
			query
			show
			sortable
			type
		}
		defaultSorting {
			desc
			fieldName
		}
		keyFieldName
		maxResultsWindow
	}
`;

export const componentConfigsQuery = (documentType: string, queryName = '') =>
	`query ${queryName} {
		${documentType} {
			configs {
				${downloadsConfigs}
				extended
				${facetsConfigs}
				${tableConfigs}
			}
		}
	}`;
