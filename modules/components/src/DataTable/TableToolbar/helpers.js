import download from '../../utils/download';

const saveTSV = async ({ url, files = [], fileName, options = {} }) =>
  download({
    url,
    method: 'POST',
    ...options,
    params: {
      fileName,
      files: files.map(({ allColumns, columns, exporterColumns = null, ...file }, i) => ({
        ...file,
        columns: exporterColumns // if the component gave you custom columns to show
          ? Object.values(
              exporterColumns.length > 0 // if they ask for any specific columns
                ? // use them
                  exporterColumns.map((column) => {
                    switch (typeof column) {
                      // checking if the columns are customised
                      case 'object': {
                        const extendedColumn = allColumns[column.fieldName];
                        return {
                          ...extendedColumn,
                          ...(column.displayName && {
                            displayName:
                              typeof column.displayName === 'function'
                                ? column.displayName(extendedColumn)
                                : column.displayName,
                          }),
                        };
                      }

                      // or not
                      case 'string':
                      default:
                        return allColumns[column];
                    }
                  })
                : allColumns, // else, they're asking for all the columns
            )
          : columns.filter((column) => column.show), // no custom columns, use admin's
      })),
      ...options.params,
    },
  });

const exporterProcessor = (exporter, allowTSVExport, exportTSVText) => {
  const exporterArray =
    Array.isArray(exporter) &&
    exporter
      .filter((item) => item)
      .map((item) =>
        [item, item.function].some((fnName) => fnName === 'saveTSV') ||
        (item.hasOwnProperty('fileName') && !item.hasOwnProperty('function'))
          ? {
              exporterLabel: item?.label || exportTSVText,
              exporterFunction: saveTSV,
              exporterFileName: item?.fileName,
              exporterRequiresRowSelection: item?.requiresRowSelection,
              ...(item?.columns &&
                Array.isArray(item.columns) && { exporterColumns: item?.columns }),
            }
          : Object.entries(item).reduce(
              (exporterItem, [key, value]) => ({
                ...exporterItem,
                [`exporter${key[0].toUpperCase()}${key.slice(1)}`]: value,
              }),
              {},
            ),
      );

  const multipleExporters = exporterArray && exporter.length > 1;

  // this checks whether a single custom function has been provided
  // by itself, or as the single item in an array
  const resolveSingleExporter = (exporter, useDefaultTSV) => {
    switch (true) {
      case exporter instanceof Function:
        return exporter;

      case multipleExporters:
        return exporterArray;

      case exporterArray:
        return exporterArray[0]?.exporterFunction;

      case useDefaultTSV:
        return saveTSV;

      default:
        exporter && // log something to indicate this needs to be addressed
          console.log('The custom exporter(s) format provided was invalid');
    }
  };

  return {
    singleExporter: resolveSingleExporter(exporter, allowTSVExport),
    exporterArray,
    multipleExporters,
  };
};

export default exporterProcessor;
