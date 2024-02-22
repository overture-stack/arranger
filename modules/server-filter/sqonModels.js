/**
 * Class to manage and create shared project folder SQONs
 */
export class ProjectFolder {
    /**
     * Generate SQON for project folders and their respective files/folders that are user accessible
     * @param zone zone of project folder
     * @param folderName name of project folder
     */
    generateAccessibleSQON(zone, folderName){
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
                `shared/${folderName}*`,
              ],
            },
          },
          {
           "op":"and",
           "content":[
              {
                 "op":"in",
                 "content":{
                    "field":"type",
                    "value":[
                       "project_folder"
                    ]
                 }
              },
              {
                 "op":"in",
                 "content":{
                    "field":"name",
                    "value":[
                       `${folderName}`
                    ]
                 }
              }
           ]
        }]}],
      };
    }
}
