Tokens
============================

User Authentication Tokens
----------------------------------------------------
Authentication concerns *who the user is*.

User Authentication tokens are used to verify a user’s identity.

Ego’s User Authentication tokens are signed JSON Web Tokens (see http://jwt.io) that Ego issues when a user successfully logs into Ego using their Google or Facebook credentials.

Ego's authentication tokens confirm the user’s identity, and contain information about a user’s name, their role (user/administrator), and any applications, permissions, and groups associated with their Ego account etc.

This data is current as of the time the token is issued, and the token is digitally signed by Ego with a publicly available signing key that applications have to use to verify that an authentication token is valid. Most of Ego’s REST endpoints require an Ego authentication token to be provided in the authorization header, in order to validate the user’s identity before operating on their data.

.. image :: jwt.png

User Authorization Tokens
----------------------------------------------------
Authorization concerns *what a user is allowed to do*.

User Authorization tokens are used to verify a user's permissions to execute on a desired scope.

Ego’s User Authorization tokens are random numbers that Ego issues to users so they can interact with Ego-aware applications with a chosen level of authority.

Each token is a unique secret password that is associated with a specific user, permissions, and optionally, an allowed set of applications.

Unlike passwords, Authorization tokens automatically expire, and they can be revoked if the user suspects that they have been compromised.

The user can then use their token with Ego-authorized applications as proof of who they are and what they are allowed to do. Typically, the user will configure a client program (such as SING, the client program used with SONG, the ICGC Metadata management service) with their secret token, and the program will then operate with the associated level of authority.

In more detail, when an Ego-aware application wants to know if it is authorized to do something on behalf of a given user, it just sends their user authorization token to Ego, and gets back the associated information about who the user is (their user id), and what they are allowed to do (the permissions associated with their token). If the permissions that the user have include the permission the application wants, the application know it is authorized to perform the requested service on behalf of the user.


Application Authentication Tokens
----------------------------------------------------

For security reasons, applications need to be able to prove to Ego that they are the legitimate applications that Ego has been configured to work with.

For this reason, every Ego-aware application must be configured in Ego with it’s own unique CLIENT ID and CLIENT SECRET, and the application must send a token with this information to Ego whenever it makes a request to get the identity and credentials associated with a user’s authorization token.
