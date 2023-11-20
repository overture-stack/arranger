/**
 * Class to manage and create shared project folder SQONs
 */
export class ProjectFolder {

    constructor(projectName) {
        this.baseSQON = {
            "op": "and",
            "content": [{
                "op": "in",
                "content": {
                    "field": "container_code",
                    "value": [
                        projectName
                    ]
                }
            }, {
                "op": "not",
                "content": []
            }]
        }
    }

    get SQON(){
      return this.baseSQON
    }

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
