import jwt_decode from 'jwt-decode';
import * as fs from 'fs';
import axios from 'axios';
import memoize from 'memoizee';

import {
    AUTH_SERVICE,
    AUTH_SERVICE_PAGE_SIZE,
    MEMOIZE_TIMEOUT, METADATA_SERVICE, METADATA_SERVICE_PAGE_SIZE
} from './config.js';

import {
    ProjectFolder
} from './sqonModels.js'

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
        console.error(error)
        throw Error('Failed to read sqon model')
    }

}

/**
 * Function will decode auth token and return user and realm role information
 * @param request The incoming request
 * @returns Username and respective keycloak realm roles
 */
export function decodeToken(request) {
    try {
        // decode token
        const decoded = jwt_decode(request.headers.authorization);

        if ((!decoded['preferred_username']) || (!decoded['realm_access']['roles'])) {
            throw Error('Invalid decoded token format')
        }

        // get user roles
        const user_roles = decoded['realm_access']['roles'];

        // get username
        const username = decoded['preferred_username'];

        return {
            'username': username,
            'roles': user_roles
        }

    } catch (error) {
        console.error(error)
        throw Error('Failed to decode token')
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
        console.error(error)
        throw Error(`Failed to check realm roles against project ${project_code}`)

    }

}

/**
 * Function will call metadata service to obtain project folder names that cannot be accessed by user
 * @param project_folder_ids array of project folder ids a user does not have access to
 * @param page The page number used for pagination
 * @param data The resulting data for a single api call
 * @returns An array of non user-accessible project folders for a project
 */

const getProjectFolders = async (project_folder_ids, page = 0, data = []) => {
    try {
        const zones = {0:'greenroom', 1:'core'}
        const params = {
            params: {
            ids: project_folder_ids,
            page: page,
            page_size: METADATA_SERVICE_PAGE_SIZE
            }
        }
        const url = `${METADATA_SERVICE}/v1/items/batch`;
        const response = await axios.get(url, params);
        page++;
        if (response.data.result.length !== 0){
            for (const entry of response.data.result) {
                data.push(...{"name":entry.name, "zone":zones[entry.zone]});
            }
        }
        if (response.data.num_of_pages > page) {
            return getProjectFolders(project_folder_ids, page, data);
        }
        return data;
    } catch (error) {
        console.error(error.message)
        throw Error(`Failed to call metadata service`);
    }
};


/**
 * Function will call auth service to obtain rbac permissions for project_folders
 * @param project_code The project code for a project
 * @param data The resulting data of api call
 * @returns An array of RBAC permissions data for project folders
 */

const getProjectFolderPermissions = async (project_code, data = []) => {
    try {
        for (const zone of ["0","1"]){
            const url = `${AUTH_SERVICE}/v1/permissions/project-folder?project_code=${project_code}&zone=${zone}`;
            const response = await axios.get(url);
            data.push(...response.data.result);
        }
        return data;
    } catch (error) {
        console.error(error.message)
        throw Error(`Failed to call auth service for project folders`);
    }
};


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
        console.error(error.message)
        throw Error(`Failed to call auth service`);
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
            file_any: [],
            project_folders: []
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

        // obtain permissions for project folders from auth service
        const rbacProjectFolder = await getProjectFolderPermissions(project_code);
        // filter project folders that a user does not have access to
        const folderIds = [];
        if (rbacProjectFolder.length !==0){
            for (const entry of rbacProjectFolder) {
                if (!entry.permissions[validated_role]){
                    folderIds.push(entry.folder_id);
                }
            }
        }

        // obtain names of non-accessible project folders from metadata service
        if (folderIds.length !== 0){
            const projectFolders = await getProjectFolders(folderIds);
            // check for names of non-accessible project folders
            if (projectFolders.length !== 0){
                for (const folder of projectFolders) {
                    permitted['project_folders'].push(folder)
                }
            }
        }

        return {
            "role": validated_role,
            "permissions": permitted
        };

    } catch (error) {
        console.error(error)
        throw Error(`Cannot retrieve RBAC info for project ${project_code}`)
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

        if (permissions['project_folders'].length !== 0) {
            const projectFolder = new ProjectFolder(project_code);
            for (const p of permissions['project_folders']){
                const sqon = projectFolder.populateProjectFolderSQON(p.zone, p.name);
                base_sqon['content'][2]['content'].push(sqon);
            }
        }

        // return sqon with user permissions in place
        return base_sqon;


    } catch (error) {
        console.error(error)
        throw Error(`Cannot build SQON for project ${project_code}`)
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
    // get rbac permissions (if any)
    const rbac = await getRBAC(project_code, user_roles);

    // build sqon
    return await buildSQON(rbac, project_code, username);
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
    return await arrangerAuthFilter(project_code, username, realm_roles)


}

// memoize processRequest function, based on project code, username, and request body parameters.
// request body is passed in order to ensure specific facet selections and identifiers (during download) are cached

export const memoizedProcess = memoize(processRequest, {
    promise: true,
    maxAge: MEMOIZE_TIMEOUT,
    length: 3
}) // length designates first 3 parameters are cached
