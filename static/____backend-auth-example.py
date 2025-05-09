import os
import requests
from flask import Flask, request, redirect, jsonify, session, make_response
from flask_cors import CORS
from urllib.parse import urlencode
import logging
import json
import base64
import uuid
import time

# Set up logging for debugging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='.')
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key')  # Change in production

# Enable CORS with appropriate configuration
CORS(app, 
     resources={r"/*": {"origins": "*"}},  # Allow all origins for development
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization", "NGSILD-Tenant"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"])

# Frontend URL detection
def get_frontend_url():
    # Check request origin to determine the frontend URL dynamically
    if request.headers.get('Origin'):
        return request.headers.get('Origin')
    
    # Check if we're running on localhost
    if request.host.startswith('localhost') or request.host.startswith('127.0.0.1'):
        return f"http://{request.host}"
        
    # If running on an IP address, use that IP with the default port
    if any(x.isdigit() for x in request.host.split('.')):
        host_parts = request.host.split(':')
        if len(host_parts) > 1:
            # If port is in host, use it
            return f"http://{request.host}"
        else:
            # Default to the same host without a specific port
            return f"http://{request.host}"
    
    # Fallback to HTTP based on current host
    return f"http://{request.host}"

# Keycloak configuration
KEYCLOAK_CONFIG = {
    'auth_url': 'https://keycloak.sensorsreport.net/realms/sr/protocol/openid-connect/auth',
    'token_url': 'https://keycloak.sensorsreport.net/realms/sr/protocol/openid-connect/token',
    'userinfo_url': 'https://keycloak.sensorsreport.net/realms/sr/protocol/openid-connect/userinfo',
    'logout_url': 'https://keycloak.sensorsreport.net/realms/sr/protocol/openid-connect/logout',
    'client_id': 'ContextBroker',
    'client_secret': '',  # Set this if your Keycloak client has a secret
}

# Serve static files (for development)
@app.route('/', defaults={'path': 'index.html'})
@app.route('/<path:path>')
def serve_static(path):
    return app.send_static_file(path)

# Routes for authentication
@app.route('/api/auth/login')
def login():
    """
    Start the authentication flow by redirecting to Keycloak
    """
    logger.debug("Starting login flow")
    state = str(uuid.uuid4())
    session['oauth_state'] = state
    
    # Build the authorization URL
    auth_params = {
        'client_id': KEYCLOAK_CONFIG['client_id'],
        'redirect_uri': request.url_root.rstrip('/') + '/api/auth/callback',
        'response_type': 'code',
        'scope': 'openid profile email',
        'state': state
    }
    
    auth_url = f"{KEYCLOAK_CONFIG['auth_url']}?{urlencode(auth_params)}"
    logger.debug(f"Redirecting to auth URL: {auth_url}")
    return redirect(auth_url)

@app.route('/api/auth/callback')
def callback():
    """
    Handle the callback from Keycloak after authentication
    """
    logger.debug("Auth callback received")
    # Verify state to prevent CSRF
    state = request.args.get('state')
    stored_state = session.get('oauth_state')
    
    if not state or state != stored_state:
        logger.error(f"State mismatch: received {state}, stored {stored_state}")
        return jsonify({'error': 'Invalid state parameter'}), 400
    
    # Exchange code for tokens
    code = request.args.get('code')
    if not code:
        logger.error("No authorization code provided")
        return jsonify({'error': 'No authorization code provided'}), 400
    
    # Prepare token request
    token_data = {
        'grant_type': 'authorization_code',
        'client_id': KEYCLOAK_CONFIG['client_id'],
        'client_secret': KEYCLOAK_CONFIG['client_secret'],
        'code': code,
        'redirect_uri': request.url_root.rstrip('/') + '/api/auth/callback'
    }
    
    try:
        # Get tokens from Keycloak
        logger.debug(f"Exchanging code for token at: {KEYCLOAK_CONFIG['token_url']}")
        response = requests.post(KEYCLOAK_CONFIG['token_url'], data=token_data)
        
        if response.status_code != 200:
            logger.error(f"Token retrieval failed: {response.status_code} {response.text}")
            return jsonify({'error': f'Failed to retrieve token: {response.text}'}), 400
        
        tokens = response.json()
        logger.debug("Successfully retrieved tokens")
        
        # Store tokens in secure HTTP-only cookies
        resp = make_response(redirect(get_frontend_url()))
        
        # Clear any logged_out cookie if it exists
        resp.delete_cookie('logged_out', path='/')
        
        # Set access token in cookie
        resp.set_cookie(
            'access_token',
            tokens['access_token'],
            httponly=True,
            secure=False,  # Set to True in production
            max_age=tokens['expires_in'],
            samesite='Lax',
            path='/'
        )
        
        # Store refresh token in a cookie
        resp.set_cookie(
            'refresh_token',
            tokens['refresh_token'],
            httponly=True,
            secure=False,  # Set to True in production
            max_age=tokens['expires_in'] * 2,  # Longer expiry for refresh token
            samesite='Lax',
            path='/'
        )
        
        # Extract user info from token for session
        try:
            payload = tokens['access_token'].split('.')[1]
            # Add padding if needed
            payload += '=' * ((4 - len(payload) % 4) % 4)
            decoded_payload = base64.b64decode(payload)
            token_data = json.loads(decoded_payload)
            
            # Extract TenantId from token data with enhanced handling
            tenant = 'Default'
            
            # Log a sanitized version of the token data for debugging
            logger.debug("Token payload received and parsed successfully")
            logger.debug(f"Token contains fields: {', '.join(token_data.keys())}")
            
            # Check all possible variations of tenant field
            if 'TenantId' in token_data:
                if isinstance(token_data['TenantId'], list) and token_data['TenantId']:
                    tenant = token_data['TenantId'][0]
                    logger.debug(f"Using TenantId (array) from token: {tenant}")
                elif isinstance(token_data['TenantId'], str):
                    tenant = token_data['TenantId']
                    logger.debug(f"Using TenantId (string) from token: {tenant}")
            elif 'tenant_id' in token_data:
                tenant = token_data['tenant_id']
                logger.debug(f"Using tenant_id from token: {tenant}")
            elif 'tenantId' in token_data:
                tenant = token_data['tenantId']
                logger.debug(f"Using tenantId from token: {tenant}")
            elif 'Tenant' in token_data:
                tenant = token_data['Tenant']
                logger.debug(f"Using Tenant from token: {tenant}")
            elif 'tenant' in token_data:
                tenant = token_data['tenant']
                logger.debug(f"Using tenant from token: {tenant}")
            else:
                logger.debug("No tenant information found in token, using default")
            
            # Store user info in session
            session['user'] = {
                'username': token_data.get('preferred_username', 'unknown_user'),
                'tenant': tenant
            }
        except Exception as e:
            logger.exception("Error extracting user info from token")
        
        logger.debug(f"Redirecting to frontend: {get_frontend_url()}")
        return resp
    
    except Exception as e:
        logger.exception("Error in callback processing")
        return jsonify({'error': f'Error processing callback: {str(e)}'}), 500

@app.route('/api/auth/logout')
def logout():
    """
    Handle logout by clearing cookies and session, and invalidating the token on Keycloak
    """
    logger.debug("Processing logout")
    
    # Get the tokens from cookies
    access_token = request.cookies.get('access_token')
    refresh_token = request.cookies.get('refresh_token')
    
    # First invalidate the token on Keycloak (if we have a refresh token)
    if refresh_token:
        try:
            # Prepare logout request for Keycloak
            logout_data = {
                'client_id': KEYCLOAK_CONFIG['client_id'],
                'client_secret': KEYCLOAK_CONFIG['client_secret'],
                'refresh_token': refresh_token
            }
            
            # Send logout request to Keycloak
            logger.debug(f"Sending logout request to Keycloak at: {KEYCLOAK_CONFIG['logout_url']}")
            requests.post(KEYCLOAK_CONFIG['logout_url'], data=logout_data)
            logger.debug("Logout request sent to Keycloak")
        except Exception as e:
            logger.exception("Error during Keycloak logout")
    
    # Clear session data
    session.clear()
    
    # Get the frontend URL and append parameters to prevent automatic login
    frontend_url = get_frontend_url()
    # Add a timestamp to prevent caching and ensure redirect always picks up the parameter
    redirect_url = f"{frontend_url}?logout=success&no_auto_login=true&t={int(time.time())}"
    logger.debug(f"Redirecting to: {redirect_url}")
    
    resp = make_response(redirect(redirect_url))
    
    # Clear cookies with proper expiration and path settings to ensure they're actually cleared
    # Use multiple approaches to maximize compatibility across browsers
    resp.set_cookie('access_token', '', expires=0, path='/', domain=None, secure=False, httponly=True, max_age=0)
    resp.set_cookie('refresh_token', '', expires=0, path='/', domain=None, secure=False, httponly=True, max_age=0)
    resp.delete_cookie('access_token', path='/')
    resp.delete_cookie('refresh_token', path='/')
    
    # Set headers to prevent caching which could cause auth state persistence issues
    resp.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    resp.headers['Pragma'] = 'no-cache'
    resp.headers['Expires'] = '0'
    
    # Set a special cookie to indicate logout status that will persist through redirects
    # Make this cookie accessible to JavaScript so the frontend can detect logout status
    resp.set_cookie('logged_out', 'true', max_age=60, path='/', secure=False, httponly=False, samesite='Lax')
    
    return resp

@app.route('/api/auth/refresh')
def refresh_token():
    """
    Refresh the access token using the refresh token
    """
    logger.debug("Processing token refresh")
    refresh_token = request.cookies.get('refresh_token')
    
    if not refresh_token:
        logger.warning("Refresh token missing in request")
        return jsonify({'error': 'No refresh token available'}), 401
    
    # Prepare refresh request
    refresh_data = {
        'grant_type': 'refresh_token',
        'client_id': KEYCLOAK_CONFIG['client_id'],
        'client_secret': KEYCLOAK_CONFIG['client_secret'],
        'refresh_token': refresh_token
    }
    
    try:
        # Get new tokens from Keycloak
        logger.debug("Requesting new tokens with refresh token")
        response = requests.post(KEYCLOAK_CONFIG['token_url'], data=refresh_data)
        
        if response.status_code != 200:
            logger.error(f"Token refresh failed: {response.status_code} {response.text}")
            return jsonify({'error': 'Failed to refresh token'}), 401
        
        tokens = response.json()
        logger.debug("Successfully refreshed tokens")
            
        # Update tokens in cookies
        resp = make_response(jsonify({'success': True}))
        resp.set_cookie(
            'access_token',
            tokens['access_token'],
            httponly=True,
            secure=False,  # Set to True in production
            max_age=tokens['expires_in'],
            samesite='Lax',
            path='/'
        )
        
        # Update refresh token
        resp.set_cookie(
            'refresh_token',
            tokens['refresh_token'],
            httponly=True,
            secure=False,  # Set to True in production
            max_age=tokens['expires_in'] * 2,  # Longer expiry for refresh token
            samesite='Lax',
            path='/'
        )
        
        # Extract user info from token for session
        try:
            payload = tokens['access_token'].split('.')[1]
            # Add padding if needed
            payload += '=' * ((4 - len(payload) % 4) % 4)
            decoded_payload = base64.b64decode(payload)
            token_data = json.loads(decoded_payload)
            
            # Extract TenantId from token data with enhanced handling
            tenant = 'Default'
            
            # Log a sanitized version of the token data for debugging
            logger.debug(f"Token payload in refresh: Token received and parsed successfully")
            logger.debug(f"Token contains fields: {', '.join(token_data.keys())}")
            
            # Check all possible variations of tenant field
            if 'TenantId' in token_data:
                if isinstance(token_data['TenantId'], list) and token_data['TenantId']:
                    tenant = token_data['TenantId'][0]
                    logger.debug(f"Using TenantId (array) from token: {tenant}")
                elif isinstance(token_data['TenantId'], str):
                    tenant = token_data['TenantId']
                    logger.debug(f"Using TenantId (string) from token: {tenant}")
            elif 'tenant_id' in token_data:
                tenant = token_data['tenant_id']
                logger.debug(f"Using tenant_id from token: {tenant}")
            elif 'tenantId' in token_data:
                tenant = token_data['tenantId']
                logger.debug(f"Using tenantId from token: {tenant}")
            elif 'Tenant' in token_data:
                tenant = token_data['Tenant']
                logger.debug(f"Using Tenant from token: {tenant}")
            elif 'tenant' in token_data:
                tenant = token_data['tenant']
                logger.debug(f"Using tenant from token: {tenant}")
            else:
                logger.debug("No tenant information found in token, using default")
            
            # Store user info in session
            session['user'] = {
                'username': token_data.get('preferred_username', 'unknown_user'),
                'tenant': tenant
            }
        except Exception as e:
            logger.exception("Error extracting user info from token")
        
        return resp
        
    except Exception as e:
        logger.exception("Error refreshing token")
        return jsonify({'error': f'Error refreshing token: {str(e)}'}), 500

@app.route('/api/auth/user')
def get_user_info():
    """
    Return the current user's information from the access token
    """
    logger.debug("Getting user info")
    access_token = request.cookies.get('access_token')
    if not access_token:
        logger.debug("No access token in cookies")
        return jsonify({'authenticated': False})
    
    try:
        # Extract user info from token
        payload = access_token.split('.')[1]
        # Add padding if needed
        payload += '=' * ((4 - len(payload) % 4) % 4)
        decoded_payload = base64.b64decode(payload)
        token_data = json.loads(decoded_payload)
        
        username = token_data.get('preferred_username', 'unknown_user')
        
        # Extract TenantId from token data with enhanced handling
        tenant = 'Default'
        
        # Log a sanitized version of the token data for debugging
        logger.debug("Token payload received and parsed successfully")
        logger.debug(f"Token contains fields: {', '.join(token_data.keys())}")
        
        # Check all possible variations of tenant field
        if 'TenantId' in token_data:
            if isinstance(token_data['TenantId'], list) and token_data['TenantId']:
                tenant = token_data['TenantId'][0]
                logger.debug(f"Using TenantId (array) from token: {tenant}")
            elif isinstance(token_data['TenantId'], str):
                tenant = token_data['TenantId']
                logger.debug(f"Using TenantId (string) from token: {tenant}")
        elif 'tenant_id' in token_data:
            tenant = token_data['tenant_id']
            logger.debug(f"Using tenant_id from token: {tenant}")
        elif 'tenantId' in token_data:
            tenant = token_data['tenantId']
            logger.debug(f"Using tenantId from token: {tenant}")
        elif 'Tenant' in token_data:
            tenant = token_data['Tenant']
            logger.debug(f"Using Tenant from token: {tenant}")
        elif 'tenant' in token_data:
            tenant = token_data['tenant']
            logger.debug(f"Using tenant from token: {tenant}")
        else:
            # Fall back to session tenant if available
            tenant = session.get('tenant', 'Default')
            logger.debug(f"No tenant information found in token, using session value or default: {tenant}")
        
        # Update session with the tenant from token
        session['tenant'] = tenant
        
        logger.debug(f"User authenticated: {username}, tenant: {tenant}")
        return jsonify({
            'authenticated': True,
            'user': {
                'username': username,
                'tenant': tenant
            }
        })
    except Exception as e:
        logger.exception("Error decoding token")
        return jsonify({'authenticated': False, 'error': str(e)})

@app.route('/api/auth/tenant', methods=['POST'])
def set_tenant():
    """
    Set the current tenant for the user
    """
    logger.debug("Setting tenant")
    data = request.json
    tenant = data.get('tenant')
    
    if not tenant:
        logger.warning("No tenant provided in request")
        return jsonify({'error': 'No tenant provided'}), 400
    
    session['tenant'] = tenant
    logger.debug(f"Tenant set to: {tenant}")
    return jsonify({'success': True, 'tenant': tenant})

@app.route('/api/auth/verify-token', methods=['POST'])
def verify_token():
    """
    Verify a token sent from the frontend and establish backend session
    """
    logger.debug("Verifying token from frontend")
    
    try:
        data = request.json
        if not data or 'access_token' not in data:
            logger.error("No access token provided in request")
            return jsonify({'error': 'No access token provided'}), 400
            
        access_token = data['access_token']
            
        # Parse the JWT directly
        try:
            token_parts = access_token.split('.')
            if len(token_parts) != 3:
                logger.warning("Invalid token format")
                return jsonify({'error': 'Invalid token format'}), 400
                
            # Decode the payload part
            payload = token_parts[1]
            payload += '=' * ((4 - len(payload) % 4) % 4)
            decoded_payload = base64.b64decode(payload)
            token_data = json.loads(decoded_payload)
            
            # Extract user data
            username = token_data.get('preferred_username', 'unknown_user')
            
            # Extract TenantId from token data with enhanced handling
            tenant = 'Default'
            
            # Log a sanitized version of the token data for debugging
            logger.debug("Token payload received and parsed successfully")
            logger.debug(f"Token contains fields: {', '.join(token_data.keys())}")
            
            # Check all possible variations of tenant field
            if 'TenantId' in token_data:
                if isinstance(token_data['TenantId'], list) and token_data['TenantId']:
                    tenant = token_data['TenantId'][0]
                    logger.debug(f"Using TenantId (array) from token: {tenant}")
                elif isinstance(token_data['TenantId'], str):
                    tenant = token_data['TenantId']
                    logger.debug(f"Using TenantId (string) from token: {tenant}")
            elif 'tenant_id' in token_data:
                tenant = token_data['tenant_id']
                logger.debug(f"Using tenant_id from token: {tenant}")
            elif 'tenantId' in token_data:
                tenant = token_data['tenantId']
                logger.debug(f"Using tenantId from token: {tenant}")
            elif 'Tenant' in token_data:
                tenant = token_data['Tenant']
                logger.debug(f"Using Tenant from token: {tenant}")
            elif 'tenant' in token_data:
                tenant = token_data['tenant']
                logger.debug(f"Using tenant from token: {tenant}")
            else:
                logger.debug("No tenant information found in token, using default")
            
            # Store in session
            session['user'] = {
                'username': username,
                'tenant': tenant
            }
            
            # Set up cookies for subsequent requests
            resp = make_response(jsonify({'success': True, 'user': session['user']}))
            
            # Set access token in cookie
            resp.set_cookie(
                'access_token',
                access_token,
                httponly=True,
                secure=False,  # Set to True in production
                max_age=token_data.get('exp', 3600) - token_data.get('iat', 0),
                samesite='Lax',
                path='/'
            )
            
            logger.debug(f"Token verified successfully for user: {username}")
            return resp
            
        except Exception as e:
            logger.exception("Error parsing token")
            return jsonify({'error': f'Error parsing token: {str(e)}'}), 400
            
    except Exception as e:
        logger.exception("Error verifying token")
        return jsonify({'error': f'Error verifying token: {str(e)}'}), 500

@app.route('/api/auth/direct-token', methods=['POST'])
def get_direct_token():
    """
    Get a token directly from Keycloak using Resource Owner Password Credentials
    """
    logger.debug("Getting direct token from Keycloak")
    
    try:
        data = request.json
        if not data or 'username' not in data or 'password' not in data:
            logger.error("Missing credentials in request")
            return jsonify({'error': 'Username and password are required'}), 400
            
        # Prepare token request
        token_data = {
            'grant_type': 'password',
            'client_id': KEYCLOAK_CONFIG['client_id'],
            'client_secret': KEYCLOAK_CONFIG['client_secret'],
            'username': data['username'],
            'password': data['password'],
            'scope': 'openid profile email'
        }
        
        # Get token from Keycloak
        logger.debug(f"Requesting token from Keycloak at: {KEYCLOAK_CONFIG['token_url']}")
        response = requests.post(KEYCLOAK_CONFIG['token_url'], data=token_data)
        
        if response.status_code != 200:
            logger.error(f"Token retrieval failed: {response.status_code} {response.text}")
            return jsonify({'error': f'Authentication failed: {response.json().get("error_description", "Invalid credentials")}'}), 401
            
        tokens = response.json()
        logger.debug("Successfully retrieved tokens")
        
        # Set up session and cookies
        access_token = tokens['access_token']
        
        # Parse token to get user info
        try:
            token_parts = access_token.split('.')
            if len(token_parts) != 3:
                logger.warning("Invalid token format")
                return jsonify({'error': 'Invalid token format'}), 400
                
            # Decode the payload part
            payload = token_parts[1]
            payload += '=' * ((4 - len(payload) % 4) % 4)
            decoded_payload = base64.b64decode(payload)
            token_data = json.loads(decoded_payload)
            
            # Extract user data
            username = token_data.get('preferred_username', 'unknown_user')
            
            # Extract TenantId from token data with enhanced handling
            tenant = 'Default'
            
            # Log a sanitized version of the token data for debugging
            logger.debug("Token payload received and parsed successfully")
            logger.debug(f"Token contains fields: {', '.join(token_data.keys())}")
            
            # Check all possible variations of tenant field
            if 'TenantId' in token_data:
                if isinstance(token_data['TenantId'], list) and token_data['TenantId']:
                    tenant = token_data['TenantId'][0]
                    logger.debug(f"Using TenantId (array) from token: {tenant}")
                elif isinstance(token_data['TenantId'], str):
                    tenant = token_data['TenantId']
                    logger.debug(f"Using TenantId (string) from token: {tenant}")
            elif 'tenant_id' in token_data:
                tenant = token_data['tenant_id']
                logger.debug(f"Using tenant_id from token: {tenant}")
            elif 'tenantId' in token_data:
                tenant = token_data['tenantId']
                logger.debug(f"Using tenantId from token: {tenant}")
            elif 'Tenant' in token_data:
                tenant = token_data['Tenant']
                logger.debug(f"Using Tenant from token: {tenant}")
            elif 'tenant' in token_data:
                tenant = token_data['tenant']
                logger.debug(f"Using tenant from token: {tenant}")
            else:
                logger.debug("No tenant information found in token, using default")
            
            # Store in session
            session['user'] = {
                'username': username,
                'tenant': tenant
            }
            
            # Return tokens and user info to the frontend
            result = {
                'success': True,
                'user': session['user'],
                'access_token': access_token,
                'refresh_token': tokens.get('refresh_token'),
                'expires_in': tokens.get('expires_in'),
                'token_type': tokens.get('token_type')
            }
            
            # Set up response with cookies
            resp = make_response(jsonify(result))
            
            # Set access token in cookie (HTTP only)
            resp.set_cookie(
                'access_token',
                access_token,
                httponly=True,
                secure=False,  # Set to True in production
                max_age=tokens.get('expires_in', 3600),
                samesite='Lax',
                path='/'
            )
            
            # Store refresh token in a cookie as well
            if 'refresh_token' in tokens:
                resp.set_cookie(
                    'refresh_token',
                    tokens['refresh_token'],
                    httponly=True,
                    secure=False,  # Set to True in production
                    max_age=tokens.get('expires_in', 3600) * 2,  # Longer expiry for refresh token
                    samesite='Lax',
                    path='/'
                )
            
            logger.debug(f"Direct token retrieved for user: {username}")
            return resp
            
        except Exception as e:
            logger.exception("Error processing token")
            return jsonify({'error': f'Error processing token: {str(e)}'}), 500
            
    except Exception as e:
        logger.exception("Error getting direct token")
        return jsonify({'error': f'Error getting direct token: {str(e)}'}), 500

@app.route('/api/auth/token-details')
def get_token_details():
    """
    Return the decoded JWT token with all its claims in a prettified format
    """
    logger.debug("Getting token details")
    access_token = request.cookies.get('access_token')
    
    if not access_token:
        logger.debug("No access token in cookies")
        return jsonify({'authenticated': False, 'error': 'No token available'})
    
    try:
        # Parse the token parts
        token_parts = access_token.split('.')
        if len(token_parts) != 3:
            logger.error("Invalid token format")
            return jsonify({'error': 'Invalid token format'}), 400
            
        # Decode header
        header = token_parts[0]
        # Add padding if needed
        header += '=' * ((4 - len(header) % 4) % 4)
        decoded_header = json.loads(base64.b64decode(header))
        
        # Decode payload (claims)
        payload = token_parts[1]
        # Add padding if needed
        payload += '=' * ((4 - len(payload) % 4) % 4)
        decoded_payload = json.loads(base64.b64decode(payload))
        
        # Format expiration time as human readable
        if 'exp' in decoded_payload:
            import datetime
            exp_time = datetime.datetime.fromtimestamp(decoded_payload['exp'])
            decoded_payload['expiration_formatted'] = exp_time.strftime('%Y-%m-%d %H:%M:%S')
        
        # Format issue time as human readable
        if 'iat' in decoded_payload:
            import datetime
            iat_time = datetime.datetime.fromtimestamp(decoded_payload['iat'])
            decoded_payload['issued_at_formatted'] = iat_time.strftime('%Y-%m-%d %H:%M:%S')
        
        # Return the token details
        return jsonify({
            'authenticated': True,
            'token_preview': f"{access_token[:20]}...",
            'header': decoded_header,
            'payload': decoded_payload,
            'signature': f"{token_parts[2][:10]}..." # Just show part of the signature
        })
        
    except Exception as e:
        logger.exception("Error decoding token")
        return jsonify({'authenticated': False, 'error': str(e)})

# NGSI-LD API proxy route to handle entity requests
@app.route('/api/ngsi-ld/v1/<path:subpath>', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'])
def ngsi_ld_proxy(subpath):
    """
    Proxy requests to the NGSI-LD context broker
    """
    logger.debug(f"NGSI-LD proxy request: {request.method} {subpath}")
    
    # Log all incoming request headers for debugging
    logger.debug("Incoming request headers:")
    for header, value in request.headers.items():
        logger.debug(f"  {header}: {value}")
    
    # Handle OPTIONS requests for CORS preflight
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, NGSILD-Tenant')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
        return response
        
    # Check if user is authenticated
    access_token = request.cookies.get('access_token')
    if not access_token:
        logger.warning("Unauthorized access attempt to NGSI-LD API")
        return jsonify({'error': 'Unauthorized access. Please log in first.'}), 401
    
    # Extract tenant ID from request headers
    tenant_id = request.headers.get('NGSILD-Tenant', 'Default')
    
    try:
        # Forward the request to the actual NGSI-LD broker
        target_url = f"http://orion.sensorsreport.net:31026/ngsi-ld/v1/{subpath}"
        logger.debug(f"Forwarding request to: {target_url}")
        
        # Prepare headers for the forwarded request
        headers = {
            'Content-Type': request.headers.get('Content-Type', 'application/json'),
            'Accept': request.headers.get('Accept', 'application/json'),
        }
        
        # Only add tenant header if it's not default or Synchro
        tenant_id = request.headers.get('NGSILD-Tenant')
        if tenant_id and tenant_id.lower() != 'default' and tenant_id != 'Synchro':
            headers['NGSILD-Tenant'] = tenant_id
            logger.debug(f"Adding NGSILD-Tenant header: {tenant_id}")
        else:
            logger.debug(f"Not forwarding tenant header for: {tenant_id or 'none'}")
        
        # Add authorization if available
        if 'Authorization' in request.headers:
            headers['Authorization'] = request.headers['Authorization']
        
        # Log the outgoing request headers
        logger.debug("Outgoing request headers to Orion-LD:")
        for header, value in headers.items():
            logger.debug(f"  {header}: {value}")
        
        # Forward the request to the actual broker
        response = requests.request(
            method=request.method,
            url=target_url,
            headers=headers,
            params=request.args,
            data=request.data,
            timeout=30
        )
        
        logger.debug(f"Response from broker: {response.status_code}")
        
        # Log response headers
        logger.debug("Response headers from Orion-LD:")
        for header, value in response.headers.items():
            logger.debug(f"  {header}: {value}")
        
        # Create response with proper status code and content
        proxy_response = make_response(response.content, response.status_code)
        
        # Copy relevant headers from the broker's response
        for header, value in response.headers.items():
            if header.lower() in ('content-type', 'content-length', 'cache-control', 'etag', 'last-modified'):
                proxy_response.headers[header] = value
        
        # Add CORS headers to the response
        proxy_response.headers['Access-Control-Allow-Origin'] = '*'
        proxy_response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, NGSILD-Tenant'
        
        return proxy_response
        
    except requests.RequestException as e:
        logger.error(f"Error proxying request to NGSI-LD broker: {str(e)}")
        # Return a more detailed error response
        error_message = str(e)
        if "Connection refused" in error_message:
            return jsonify({
                'error': 'Unable to connect to the NGSI-LD broker. The service may be unavailable.',
                'technical_details': error_message
            }), 503
        else:
            return jsonify({
                'error': 'Error communicating with the NGSI-LD broker',
                'technical_details': error_message
            }), 500

# Health check endpoint
@app.route('/health')
def health_check():
    return jsonify({"status": "ok", "version": "1.0.0"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)