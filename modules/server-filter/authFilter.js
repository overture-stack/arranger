import jwt_decode from 'jwt-decode';
import * as fs from 'fs';
import axios from 'axios';
import memoize from 'memoizee';

import {
    AUTH_SERVICE,
    AUTH_SERVICE_PAGE_SIZE,
    MEMOIZE_TIMEOUT
} from './config.js';

/**
 * Function will read sqon json files
 * @param path The path to sqon file
 * @returns A Promise for JSON of sqon
 */
async function readFile(path) {
    try {
        return new Promise((resolve, reject) => {
            fs.readFile(path, 'utf8', function(err, data) {
                if (err) {
                    reject(err);
                }
                resolve(JSON.parse(data));
            });
        });

    } catch (error) {
        console.error(`Failed to read sqon model: ${error}`);
    }

}

/**
 * Function will decode auth token and return user and realm role information
 * @param request The incoming request
 * @returns Username and respective keycloak realm roles
 */
export function decodeToken(request) {
    try {
        // get user roles
        const decoded = jwt_decode(request.headers.authorization);
        const user_roles = decoded['realm_access']['roles'];

        // get username
        const username = decoded['preferred_username'];

        return {
            'username': username,
            'roles': user_roles
        }

    } catch (error) {
        console.error(`Failed to decode token: ${error}`);
    }

}

/**
 * Function will check if user has any roles for given project
 * @param project_code project code for a project
 * @param user_roles The realm roles obtained by decoded token
 * @returns role associated with project_code (e.g., testproject-collaborator)
 */
function UserRoleCheck(project_code, user_roles) {
    try {
        if (user_roles.filter((s) => s.includes('admin-role')).length !== 0 || user_roles.filter((s) => s.includes('platform-admin')).length !== 0 ||
            user_roles.filter((s) => s.includes(`${project_code}-admin`)).length !== 0) {
            return 'admin';
        }
        // extract role that contains project
        const project_role = user_roles.filter((s) => s.includes(project_code))
        if (project_role.length !== 0) {
            const filtered_project = project_role[0].split('-')[0]
            if (filtered_project === project_code) {
                return project_role[0].split("-").pop()
            }
        } else {
            return null;
        }

    } catch (error) {
        console.error(`Failed to check realm roles against project: ${error}`)
    }

}

/**
 * Function will call auth service to obtain rbac permissions for a project
 * @param project_code The project code for a project
 * @param page The page number used for pagination
 * @param data The resulting data for a single api call
 * @returns An array of RBAC permissions data for a project
 */

const getPermissions = async (project_code, page = 0, data = []) => {
    try {
        const url = `${AUTH_SERVICE}/v1/permissions/metadata?page=${page}&page_size=${AUTH_SERVICE_PAGE_SIZE}&order_by=category&order_type=asc&project_code=${project_code}`;
        const response = await axios.get(url);
        page++;
        data.push(...response.data.result);
        if (response.data.num_of_pages > page) {
            return getPermissions(project_code, page, data);
        }
        return data;
    } catch (error) {
        console.error(`Failed to call auth service: ${error}`);
    }
};

/**
 * Function will obtain rbac permissions for a project and filter based on realm role
 * @param project_code The project code for a project
 * @param user_roles The realm roles obtained by decoded token
 * @returns Role and respective RBAC permissions for a project
 */

const getRBAC = async (project_code, user_roles) => {
    try {
        // define base RBAC
        const permitted = {
            file_in_own_namefolder: [],
            file_any: []
        };

        // check if user has role associated with project
        const validated_role = UserRoleCheck(project_code, user_roles);
        if (validated_role == null) {
            return {
                "role": null,
                "permissions": permitted
            }
        }
        // obtain permissions for project role from auth service
        const rbac = await getPermissions(project_code);
        // filter permissions based on realm role
        for (const entry of rbac) {
            if (entry.operation === 'view' && entry.category === 'Data Operation Permissions') {
                if (entry.permissions[validated_role]) {
                    permitted[entry.resource].push(entry.zone);
                }
            }
        }
        return {
            "role": validated_role,
            "permissions": permitted
        };

    } catch (error) {
        console.log(`Failed to get RBAC info for project ${project_code}: ${error}`)
    }

};

/**
 * Function will build SQON based on RBAC permissions
 * @param role_metadata The realm role and respective permissions based on project
 * @param project_code The project code
 * @param username Username of requester
 * @returns a JSON encoded SQON filter to apply to graphql query, including aggregations
 */

const buildSQON = async (role_metadata, project_code, username) => {
    try {
        // extract role and permissions
        const role = role_metadata['role']
        const permissions = role_metadata['permissions']

        // read in base sqon
        const base_sqon = await readFile('./models/base_sqon.json');

        // if user does not have any permissions, return no data
        if (permissions['file_any'].length === 0 && permissions['file_in_own_namefolder'].length === 0) {
            base_sqon['content'][0]['content']['field'] = 'no_permissions'
            return base_sqon
        }

        // assign project to sqon
        base_sqon['content'][0]['content']['value'] = [project_code];
        if (role === 'admin') {
            return base_sqon;
        }

        // assign permissions to sqon
        if (permissions['file_any'].length !== 0) {
            for (const p of permissions['file_any']) {
                let others_sqon = await readFile('./models/others_sqon.json');
                others_sqon['content']['value'] = [p];
                base_sqon['content'][1]['content'].push(others_sqon);
            }
        }
        if (permissions['file_in_own_namefolder'].length !== 0) {
            for (const p of permissions['file_in_own_namefolder']) {
                let owner_sqon = await readFile('./models/owner_sqon.json');
                owner_sqon['content'][0]['content']['value'] = [`${username}*`];
                owner_sqon['content'][1]['content']['value'] = [p];
                base_sqon['content'][1]['content'].push(owner_sqon);
            }
        }

        // return sqon with user permissions in place
        return base_sqon;


    } catch (error) {
        console.error(`Failed to build SQON for project ${project_code}: ${error}`)
    }

};


/**
 * Function will create custom SQON filter, based on RBAC, for both query and aggregation results
 * @param project_code project code for faceted search interface
 * @param username username of requester
 * @param user_roles user realm roles
 * @returns a JSON encoded SQON filter to apply to graphql query, including aggregations
 */

export async function arrangerAuthFilter(project_code, username, user_roles) {
    try {

        // get rbac permissions (if any)
        const rbac = await getRBAC(project_code, user_roles);

        // build sqon
        return await buildSQON(rbac, project_code, username);


    } catch (error) {
        console.error(`Failed to execute auth filter: ${error} `)

    }
}


/**
 * Function will process incoming request to obtain SQON filter based on RBAC
 * @param project_code project code of faceted search interface
 * @param username username of requester
 * @param request_body JSON of the incoming request body
 * @param realm_roles keycloak realm roles for user
 * @returns a JSON encoded SQON filter to apply to graphql query, including aggregations
 */

export async function processRequest(project_code, username, request_body, realm_roles) {

    try {
        return await arrangerAuthFilter(project_code, username, realm_roles)

    } catch (error) {
        console.log(`Failed to process request: ${error}`)
    }


}

// memoize processRequest function, based on project code, username, and request body parameters.
// request body is passed in order to ensure specific facet selections and identifiers (during download) are cached

export const memoizedProcess = memoize(processRequest, {
    promise: true,
    maxAge: MEMOIZE_TIMEOUT,
    length: 3
}) // length designates first 3 parameters are cached
