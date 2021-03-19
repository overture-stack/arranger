import download from '../../utils/download';

export const saveTSV = async ({ url, files = [], fileName, options = {} }) =>
  download({
    url,
    method: 'POST',
    ...options,
    params: {
      fileName,
      files: files.map(({ allColumns, columns, exColumns = null, ...file }, i) => ({
        ...file,
        columns: exColumns // if the component gave you custom columns to show
          ? Object.values(
              exColumns.length > 0 // if they ask for any specific columns
                ? exColumns.map((fieldName) => allColumns[fieldName]) // use them
                : allColumns, // else, they're asking for all the columns
            )
          : columns.filter((column) => column.show), // no custom columns, use admin's
      })),
      ...options.params,
    },
  });

export const exporterProcessor = (exporter, allowTSVExport, exportTSVText) => {
  const exporterArray =
    Array.isArray(exporter) &&
    exporter.map((item) =>
      [item, item?.function].some((fnName) => fnName === 'saveTSV') ||
      (item.constructor === {}.constructor && !Object.keys(item).includes('function'))
        ? {
            exLabel: item?.label || exportTSVText,
            exFunction: saveTSV,
            ...(item?.columns && Array.isArray(item.columns) && { exColumns: item?.columns }),
          }
        : Object.entries(item).reduce(
            (exItem, [key, value]) => ({
              ...exItem,
              [`ex${key[0].toUpperCase()}${key.slice(1)}`]: value,
            }),
            {},
          ),
    );

  const multipleExporters = exporterArray && exporter.length > 1;

  // this checks whether a single custom function has been provided
  // by itself, or as the single item in an array
  const customExporter =
    exporter && //
    (exporter instanceof Function // check it's a valid function
      ? exporter // then use it
      : exporterArray // or check whether it's an array of them
      ? multipleExporters // that contains more than one
        ? exporterArray // return it, but may lead to bugs if misused
        : exporterArray[0]?.exFunction // or a single element in an array
      : console.log(
          `The custom exporter(s) format provided was invalid.${
            allowTSVExport ? ' Defaulting to TSV downloads' : ''
          }`,
        ));

  return {
    customExporter,
    exporterArray,
    multipleExporters,
  };
};
