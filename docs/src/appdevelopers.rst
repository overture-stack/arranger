================================
Ego for Application Developers
================================

To create an Ego-aware application, a developer must:

1. Pick a unique policy name for each type of authorization that the application requires.

2. Write the application. Ensure that the application does it’s authorization by performing a call to Ego’s “check_token” REST endpoint, and only grants access to the service for the user id returned by “check_token” if the permissions returned by “check_token” include the required permission.

3. Configure the program with a meaningful client_id and a secret password.

4. Give the client_id, password, and policy names to an Ego administrator, and ask them to configure Ego for you.
