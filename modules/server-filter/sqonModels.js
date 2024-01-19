/**
 * Class to manage and create shared project folder SQONs
 */
export class ProjectFolder {
    generateNonAccessibleSQON(zone, folderName) {
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

    generateAbsentSQON(){
      return {
        "op":"in",
        "content":{
        "field":"parent_path.keyword",
        "value":["shared/*"]
        }
      }
    }

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
