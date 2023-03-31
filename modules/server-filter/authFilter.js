import jwt_decode from 'jwt-decode';
import * as fs from 'fs';
import axios from 'axios';

import {AUTH_SERVICE} from './config.js';

/**
 * Function will read sqon json files
 * @param path The path to sqon file
 * @returns A JSON of SQON
 */
async function readFile(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', function (err, data) {
      if (err) {
        reject(err);
      }
      resolve(JSON.parse(data));
    });
  });
}

/**
 * Function will check if user has any roles for given project
 * @param project_code project code for a project
 * @param user_roles The realm roles obtained by decoded token
 * @returns role associated with project_code
 */
function UserRoleCheck(project_code, user_roles) {
  if (user_roles.filter((s) => s.includes('admin-role')).length !==0 || user_roles.filter((s) => s.includes('platform-admin')).length !==0) {
    return 'admin';
  } else if (user_roles.filter((s) => s.includes(project_code)).length !==0) {
    return user_roles.filter((s) => s.includes(project_code))[0];
  } else {
    return null;
  }
}

/**
 * Function will call auth service to obtain rbac permissions for a project
 * @param project_code The project code for a project
 * @param page The page number used for pagination
 * @param data The result data of the api call
 * @returns An array of RBAC permissions data for a project
 */

const getPermissions = async (project_code, page = 0, data = []) => {
  const page_size = 25;
  const url = `${AUTH_SERVICE}/v1/permissions/metadata?page=${page}&page_size=${page_size}&order_by=category&order_type=asc&project_code=${project_code}`;
  try {
    const response = await axios.get(url);
    page++;
    data.push(...response.data.result);
    if (response.data.num_of_pages > page) {
      return getPermissions(project_code, page, data);
    }
    return data;
  } catch (error) {
    console.error(error);
  }
};

/**
 * Function will obtain rbac permissions for a project and filter based on realm role
 * @param project_code The project code for a project
 * @param realm_role The realm role obtained by decoded token that matches project_code
 * @returns An array of RBAC permissions data for a project
 */

const getRBAC = async (project_code, realm_role) => {
  const role_name = realm_role.split("-").pop()
  const permitted = { file_in_own_namefolder: [], file_any: [] };
  const rbac = await getPermissions(project_code);
  // filter permissions based on realm role
  for (const entry of rbac) {
    if (entry.operation === 'view') {
      if (entry.permissions[role_name]) {
        permitted[entry.resource].push(entry.zone);
      }
    }
  }
  return permitted;
};

/**
 * Function will build sqon based on filtered rbac permissions
 * @param permissions The permissions filtered based on realm role
 * @param project_code The project code
 * @param username Username
 * @param role Default role aside from admin
 * @returns a SQON filter in form of JSON to apply to the entire request and to all aggregations
 */

const buildSQON = async (permissions, project_code, username, role = 'other') => {
  const base_sqon = await readFile('./auth/base_sqon.json');
  const owner_sqon = await readFile('./auth/owner_sqon.json');
  const others_sqon = await readFile('./auth/others_sqon.json');
  // assign project to sqon
  base_sqon['content'][0]['content']['value'] = [project_code];
  if (role === 'admin') {
    return base_sqon;
  }
  // assign permissions to sqon
  if (permissions['file_any'].length !== 0) {
    for (const p of permissions['file_any']) {
      others_sqon['content']['value'] = [p];
      base_sqon['content'][1]['content'].push(others_sqon);
    }
  }
  if (permissions['file_in_own_namefolder'].length !== 0) {
    owner_sqon['content'][0]['content']['value'] = [`${username}*`];
    for (const p of permissions['file_in_own_namefolder']) {
      owner_sqon['content'][1]['content']['value'] = [p];
      base_sqon['content'][1]['content'].push(owner_sqon);
    }
  }
  // return sqon with user permissions in place
  return base_sqon;
};


/**
 * Function will create custom SQON filter for both query and aggregation results
 * @param context This is the context provided by the ApolloServer based on the incoming request, see the `context` property of the ApolloServer.
 * @returns a SQON filter in form of JSON to apply to the entire request and to all aggregations
 */

export async function arrangerAuthFilter(context) {
  // get project
  const project_code = context.req.body['project_code'];
  // get user role
  const decoded = jwt_decode(context.req.headers.authorization);
  const user_roles = decoded['realm_access']['roles'];
  // get username
  const username = decoded['preferred_username'];

  // check if user has role associated with project
  const validated_role = UserRoleCheck(project_code, user_roles);
  if (validated_role != null) {
    // get rbac permissions
    const rbac = await getRBAC(project_code, validated_role);
    // build sqon
    return await buildSQON(rbac, project_code, username);
  }
}
