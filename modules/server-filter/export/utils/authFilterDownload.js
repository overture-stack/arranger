import jwt_decode from 'jwt-decode';
import * as fs from 'fs';

/**
 * Function will create custom SQON filter for both query and aggregation results
 * @param project_code project_code passed by front-end.
 * @param sqon SQON provided by faceted search filtering.
 * @param header header passed by front-end.
 * @returns a SQON filter in form of JSON to apply to the entire request and to all aggregations
 */

export function arrangerAuthFilterDownload(project_code, sqon, header) {
  const auth_mapping = {
    project_admin: 'admin-role',
    project_collaborator: `${project_code}-collaborator`,
    project_contributor: `${project_code}-contributor`,
  };
  let role_filter = '';
  const decoded = jwt_decode(header['Authorization']);
  const user_roles = decoded['realm_access']['roles'];
  const username = decoded['preferred_username'];
  for (const role of user_roles) {
    for (const key in auth_mapping) {
      if (auth_mapping[key] === role) {
        role_filter += key;
      }
    }
  }
  const data = fs.readFileSync(`./auth/${role_filter}.json`, 'utf8');
  const filtered = JSON.parse(data);

	// update project_id
  filtered['content'][0]['content']['value'] = [project_code];

  // update parent_path based on role
  if (role_filter === 'project_contributor') {
    filtered['content'][1]['content']['value'] = [`${username}*`];
  }
  if (role_filter === 'project_collaborator') {
    filtered['content'][1]['content'][0]['content'][0]['content']['value'] = [`${username}*`];
  }

  // Append download SQON to auth SQON
  if (sqon) {
    for (const i of sqon['content'])
    filtered.content.push(i)
  }
  return filtered;
}

