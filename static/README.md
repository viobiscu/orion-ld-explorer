# Keycloak Authentication Integration

This application has been configured to use Keycloak's hosted login page for authentication. This document outlines how to test and validate the integration.

## Testing the Keycloak Authentication Flow

### Prerequisites

Make sure your Keycloak server is properly configured with:

1. The correct client ID (`ContextBroker`)
2. Client type set to "confidential" (since we're using client_secret)
3. Valid redirect URIs that match your application URLs
4. Proper client secret configuration matching what's in the code

### Test Plan

Follow these steps to test the Keycloak authentication flow:

1. **Clear Existing Tokens**:
   - Open your browser developer tools (F12)
   - Go to Application → Local Storage
   - Clear the following keys if they exist:
     - javaToken
     - refreshToken
     - tokenExpiresAt
     - auth_state

2. **Access the Application**:
   - Load the application in your browser
   - You should be automatically redirected to the Keycloak login page
   - The URL should start with `https://www.sensorsreport.net/auth/realms/sr/protocol/openid-connect/auth`

3. **Authenticate**:
   - Enter valid credentials in the Keycloak login page
   - After successful authentication, you should be redirected back to the application
   - Check the developer console for "[Auth Flow]" logs showing the authentication process

4. **Verify Token**:
   - Once back in the application, check that you're properly authenticated
   - The user information should be displayed correctly
   - Click the "Show Token" button (if available) to verify the token contents

5. **Test Token Refresh**:
   - To force a token refresh, you can modify the expiration time in local storage to a time near the current time
   - The application should automatically refresh the token without requiring re-login

6. **Test Logout**:
   - Click the logout button
   - You should be redirected to the Keycloak logout page
   - After logout, you should be redirected back to the application
   - The application should now show you're not authenticated

## Troubleshooting

If you encounter any issues:

1. **Check Browser Console**: Look for any error messages, especially those prefixed with "[Auth Flow]"

2. **Inspect Network Requests**: In your browser's developer tools, check the network tab for requests to:
   - `/auth/realms/sr/protocol/openid-connect/auth`
   - `/auth/realms/sr/protocol/openid-connect/token`
   - `/auth/realms/sr/protocol/openid-connect/logout`

3. **Validate Keycloak Configuration**:
   - Ensure the client ID, client secret, and redirect URIs match in both Keycloak and the application
   - Check that your Keycloak server is accessible

4. **Clear Local Storage**: If you experience persistent issues, try clearing all local storage and restarting the process