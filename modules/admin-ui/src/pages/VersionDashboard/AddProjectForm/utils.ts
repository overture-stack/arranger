import { readFile } from 'src/utils';
import { invert } from 'lodash';
import { IIndexConfigImportData } from './types';

export const CONFIG_FILENAMES: {
  aggsState: string;
  columnsState: string;
  extended: string;
  matchboxState: string;
} = {
  aggsState: 'aggs-state.json',
  columnsState: 'columns-state.json',
  extended: 'extended.json',
  matchboxState: 'matchbox-state.json',
};

export const extractAndValidate = (files: FileList) => {
  const fileNames = Array.prototype.map.call(files, (file: File) => {
    return file.name;
  }) as string[];
  const allValidNames =
    fileNames.filter(name => Object.values(CONFIG_FILENAMES).includes(name))
      .length === fileNames.length;
  if (!allValidNames) {
    throw new Error(
      `File name must be one of: ${Object.values(CONFIG_FILENAMES).join(', ')}`,
    );
  }
  return fileNames;
};

export const getFileContentCollection = async (files: FileList) => {
  const fileNames = extractAndValidate(files);
  const fileContents = await Promise.all(Array.prototype.map.call(
    files,
    readFile,
  ) as Array<Promise<string>>);
  const dataContents = fileContents.map(s => JSON.parse(s));
  files[0].name;
  const configTypesMap = invert(CONFIG_FILENAMES);
  const filesCollection = fileNames.reduce(
    (acc, name, i) => ({ ...acc, [configTypesMap[name]]: dataContents[i] }),
    {},
  );
  return filesCollection as IIndexConfigImportData;
};
