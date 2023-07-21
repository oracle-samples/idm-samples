# Multi-User KMSI - Custom Login

This is an example implementation of a Custom Login screen which is built to implement Keep-Me-Signed-In (KMSI) for multiple users on the same client. The result of this is a Custom Sign-In page which provides a 'Who is Signing In?' experience, in which the an end user can simply select which account they wish to continue to the application.

## Configuring and Starting the Server

### Required IAM Configuration

To use this Custom Login Implmentation, a Confidential App is required to be configured in the IAM Domain. The confidential App needs to be configured as a client, permitting Client Credential use, as well as having the following IAM Roles Assigned:

* Signin
* Authenticator Client
* Change Password
* Reset Password
* Forgot Password
* Identity Domain Administrator

_Note:_ Identity Domain Administrator is a highly privileged role, and should not be granted lightly. It is required here to allow for the use of the `urn:opc:idm:t.mfa` scope, which is required to delete KMSI Sessions from within IAM. This may change in the future, but for now it is unfortunately needed to accomodate the 'Forget a User' flow.

Once the Custom Login page is configured and running, apps need to be configured to use the custom login page for authentication by setting the 'Custom Login URL' attribute for that application. Alternatively to apply the login page globally, the URL for the Custom Login page can be set in **Settings -> Session Settings**.

### Configuring the Login Implementation using `config.json`

A sample configuration file is included in the repository, it will need to be updated to reflect your specific configuration. The configuration parameters are described in more detail below.

`idcs_config` - IAM configuration

* `base_url` - The IAM Domain URL, which can be obtained from the Domain overview page.
* `client_id` - The Client ID associated with the Confidential App created in the Domain
* `client_secret` - The Client Secret associated with the Confidential App created in the Domain
* `required_scopes` - The list of scopes that are requested by the login client. It is recommended to not modify these unless you are extending this implmentation with additional capabilities.
* `kmsi_last_used_validity_in_days` - This represents the validity of a KMSI token as configured in IAM. The default value is 30, and is used to configure the expiry of the KMSI cookies used.
* `reset_password_endpoint` - The endpoint to redirect the user to after completing an SMS-based account recovery. By default this endpoint should be `https://idcs-<guid>.identity.oraclecloud.com/ui/v1/resetpwd`, however if you are implementing a custom reset password endpoint, you can change this to redirect the user to your custom implementation.

`ssl` - SSL Configuration

* `use_ssl` - Determines whether to start the server listening on HTTP or HTTPS. You SHOULD always be using HTTPS, though it may be permissible to perform SSL termination at a load balancer or similar. In that topology, `use_ssl` should be set to `false` and `is_ssl` should be set to `true`. Setting these both to false should ONLY be used for local testing.
* `is_ssl` - Flag for whether the content is being delivered over HTTPS. Not required if `use_ssl` is true, but can be enabled if SSL termination is being performed at a load balancer.
* `public_cert_path` / `private_key_path` - Path to the public certificate and private key to use for TLS for the server. Path is relative to the `dist` folder - though `sslcert` as used in the examples can be created in the root of the repository, as it is copied into dist via the build.

`port` - The listening port for the server

`force_ip_version_4` - flags whether to bind explictly to an IPv4 hostname. This ensures incoming connections specify an IPv4 address, which is then sent to IAM for the purpose of Network Perimeters and Audit. Allowing IPv6 can cause issues with those features.

`cookie_signing_key` - random string used to sign the cookies returned by the server, and as the base for deriving an encryption key for encrypting the cookie contents

`style` - Style config

* `redwood_theme` - used to load a subset of style classes to swap between IDCS and IAM Domains look and feel.

_Note:_ Protecting the client secret - as this sample is not prescriptive with regard to how and where it will be deployed, reading from a config flie represents a relatively universal mechanism for obtain configuration information, even when that information may be sensitive. If deploying onto Oracle Cloud Infrastructure or similar, then obtaining these sensitive values dynamically from a secure storage mechanism such as OCI Vault using runtime authentication would be preferable.

### Building and Starting the Server

Building the client and server components uses typescript and webpack, and scripts been created in the `package.json`.

Use the following to build the components and start the server:

```
npm install
npm run build:client
npm start
```

During development, the `run-dev.js` script can be used, which will watch the filesystem and trigger a build in response to changes.

## Implementation Notes

In general, this Custom Login page simply implements handlers for the [Authentication State Machine](https://docs.oracle.com/en/cloud/paas/identity-cloud/rest-api/usingauthenticateapis.html) used by IAM to provide a comprehensive login flow. Notably Social and SAML authentication are not supported, since this was envisaged as an authentication mechanism for B2C applications, for which those may be less relevant.

Other implementation specific consideration are described below.

### User Session Storage

This implementation uses a mix of Local Storage and Cookies to maintain the user KMSI session. Local storage is used to maintain an identifier for the client as well as store an association of users and the cookie path used for that particular user. The cookie stores the KMSI token used by IAM, as well as an encrypted user id. This user id is required to identify the owner of the KMSI token in order to handle the 'Forget this User' flow in order to appropriately revoke the token in the IAM Domain.

The cookies are signed to prevent client manipulation, and while a user could manipulate the references in local storage, the result of this would be the equivalent of clicking an alternative username, which doesn't represent any sort of security concern, given that trust has already been established.

### Server-Side Sessions

This implementation diverges from the typical IAM login flow in that it doesn't create an SSO session in the client. Rather than have the client create an IAM Session, the call to the session endpoint is performed by the server and the resulting session is not propagated to the client, instead simply redirecting the client to the appropriate post-authentication endpoint (usually the OAuth redirect URL).

This is depicted in the following sequence diagram:

![Authentication Flow Sequence Diagram](docs/auth_flow.png)

This design decision was driven by the expected User interaction with applications which use this model, where the benefit of flexibly selecting which user to authenticate as outweighs the convenience of bypassing authentication completely. It is assumed that the app being accessed will maintain its own session.

## Extending the App

This implementation is built using Express and React for the backend and frontend respectively. The React frontend is rendered server-side in order to populate the login context after performing validation and decryption of the initial redirect from the IAM Domain.

### Navigating the repository

Server Components

* Basic setup in server.js
* Specific functionality is in individual routers
  - Login performs Server-Side Rendering and serves the HTML
  - Cred Submit provides the bulk of the Authentication functionality
  - MFA Routes supports Enrollment and resending Validation messages
  - Forgot Password provides account recovery validation
  - Reset Password provides 'set new password on expiry'
* idcsUtil abstracts all of the IAM Domain API calls

Client Components

* Authentication Layout holds all of the top level state, which is passed down to subcomponents for rendering
* All styling is within the CSS folder
