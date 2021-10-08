import { Abortable } from 'events';
import fs, { ObjectEncodingOptions } from 'fs';
import path from 'path';

import { CONFIG } from '..';
import { ConfigObject } from '../types';

type FileEncodingType =
  | BufferEncoding
  | (ObjectEncodingOptions & { flag?: string | undefined } & Abortable)
  | null
  | undefined;

const readDirectoryAsync = (dirname: string) =>
  new Promise((resolve, reject) =>
    fs.readdir(dirname, (err, filenames) => {
      err ? reject(err) : resolve(filenames);
    }),
  ) // this catches the
    .catch((error) => console.error(error.message || error));

const readFileAsync = (dirname: string, filename: string, encoding: FileEncodingType) =>
  new Promise((resolve, reject) =>
    fs.readFile(path.join(dirname, filename), encoding, (err, data) => {
      err ? reject(err) : resolve([filename.replace('.json', ''), data]);
    }),
  );

const isDataFile = (filename: string) => {
  const fileNameParts = filename.split('.');

  return fileNameParts[fileNameParts.length - 1].toLowerCase() === 'json';
};

export default (dirname: string): Promise<ConfigObject> => {
  const configsPath = path.resolve(global.__basedir, dirname);
  console.log(`Reading files from '${configsPath}', if available...`);

  return readDirectoryAsync(configsPath)
    .then((filenames = []) =>
      Promise.all(
        (filenames as string[])
          .filter(isDataFile)
          .map((filename) => readFileAsync(configsPath, filename, 'utf8')),
      ),
    )
    .then((files = []) => {
      if (files.length === 0) throw new Error('Could not find any config files');

      const configObj = files.reduce(
        (configsAcc: ConfigObject, file) => {
          const [fileName, fileData] = file as [string, any];
          var fileDataJSON = JSON.parse(fileData);

          return {
            ...configsAcc,
            ...(fileName.includes('base') ? fileDataJSON : { [fileName]: fileDataJSON }),
          };
        },
        {
          index: CONFIG.ES_INDEX,
          name: CONFIG.GRAPHQL_FIELD,
        } as ConfigObject,
      );

      // in case we want to write out a single file?
      //
      // fs.appendFile(readFileAsync(path.join(configsPath, 'arranger_configs.json'), JSON.stringify(summaryFiles, null, 4), function (err) {
      //   if(err) {
      //     return console.log(err);
      //   }
      //
      //   console.log("The file was appended!");
      // });

      return configObj;
    });
};
