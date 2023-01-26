# Arranger Server with User Role Filter

### Overview
This arranger server implements a custom server-side filter in order to restrict
the search space by user-roles.

### Prerequisites
NodeJs version: `v14.21.0`; NPM version: `6.14.17`. Recommended to use node version manager (NVM).


### Installation
1. ``cd server-filter``
2. ``npm install``
3. Set ``.env`` to point to desired server port, arranger project ID, and elasticsearch instance.

```
npm i -g @arranger/server
arranger-server
```

### Important notes
1. User role filters are under `/auth`, which represents a SQON in JSON.
2. User role selection based on JWT and project_code occurs in `authFilter.js`.