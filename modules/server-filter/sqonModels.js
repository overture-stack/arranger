/**
 * Class to manage and create shared project folder SQONs
 */
export class ProjectFolder {
    populateProjectFolderSQON(zone, folderName) {
      return {
        'op': 'and',
        'content': [{
          'op': 'in',
          'content': {
            'field': 'zonefilter',
            'value': [
              zone,
            ],
          },
        }, {
          'op': 'or',
          'content': [{
            'op': 'in',
            'content': {
              'field': 'parent_path.keyword',
              'value': [
                `shared/${folderName}`,
              ],
            },
          }, {
            'op': 'in',
            'content': {
              'field': 'parent_path.keyword',
              'value': [
                `shared/${folderName}/*`,
              ],
            },
          }],
        }],
      };
    }
}
