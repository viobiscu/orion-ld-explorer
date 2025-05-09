/**
 * Authentication Manager for Backend Keycloak integration
 * Handles communication with backend auth endpoints
 */
class AuthManager {
    constructor() {
        // User state
        this.isUserAuthenticated = false;
        this.userInfo = null;
        this.tenant = localStorage.getItem('tenantName') || 'Default';
        
        // Backend base URL
        // Update this to match your actual backend URL (where the Python app is running)
        this.backendBaseUrl = 'http://localhost:5000';
        
        // Keycloak configuration - same as backend config
        this.keycloakConfig = {
            authUrl: 'https://keycloak.sensorsreport.net/realms/sr/protocol/openid-connect/auth',
            tokenUrl: 'https://keycloak.sensorsreport.net/realms/sr/protocol/openid-connect/token',
            logoutUrl: 'https://keycloak.sensorsreport.net/realms/sr/protocol/openid-connect/logout',
            clientId: 'ContextBroker',
            responseType: 'token id_token', // Using implicit flow for browser-based auth
        };
        
        // Check for authentication tokens in URL (after Keycloak redirect)
        this.checkAuthResponseInUrl();
        
        // Redirect loop protection
        this.checkRedirectLoopProtection();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Check authentication status on startup
        this.checkAuthStatus();
        
        // Make logout method available globally for direct access if needed
        window.doLogout = () => this.logout();
    }

    /**
     * Check for auth tokens in URL fragment after Keycloak redirect
     */
    checkAuthResponseInUrl() {
        console.log('Checking for auth tokens in URL: hash length =', window.location.hash.length);
        
        // First try the hash fragment (implicit flow)
        if (window.location.hash && window.location.hash.length > 1) {
            const params = new URLSearchParams(window.location.hash.substring(1));
            const accessToken = params.get('access_token');
            const idToken = params.get('id_token');
            
            if (accessToken) {
                console.log('Found access token in URL hash');
                // Store tokens in localStorage (more secure would be to use the backend still)
                localStorage.setItem('access_token', accessToken);
                if (idToken) localStorage.setItem('id_token', idToken);
                
                // Remove the hash from URL to prevent token exposure in browser history
                window.history.replaceState(null, '', window.location.pathname);
                
                // Store expiry time
                const expiresIn = params.get('expires_in');
                if (expiresIn) {
                    const expiresAt = Date.now() + parseInt(expiresIn) * 1000;
                    localStorage.setItem('expires_at', expiresAt);
                }
                
                // Parse the access token to get user info
                try {
                    this.parseToken(accessToken);
                } catch (error) {
                    console.error('Error parsing token:', error);
                }
                
                // Send token to backend for verification and session creation
                this.sendTokenToBackend(accessToken, idToken);
                return true;
            }
        }
        
        // Then check query parameters (authorization code flow)
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (code) {
            console.log('Found authorization code in URL query parameters');
            // Exchange code for token via backend
            fetch(`${this.backendBaseUrl}/api/auth/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ code, redirect_uri: window.location.origin + window.location.pathname })
            })
            .then(response => {
                if (response.ok) {
                    // Clean URL to remove the code
                    window.history.replaceState(null, '', window.location.pathname);
                    // Refresh authentication status
                    this.checkAuthStatus();
                }
            })
            .catch(error => {
                console.error('Error exchanging code for token:', error);
            });
            return true;
        }
        
        return false;
    }
    
    /**
     * Parse JWT token to extract user information
     */
    parseToken(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
                atob(base64)
                    .split('')
                    .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
            );
            
            const payload = JSON.parse(jsonPayload);
            this.isUserAuthenticated = true;
            
            // Remove full payload logging for security reasons
            console.log('Token received and parsed successfully');
            
            // Enhanced debugging for TenantId
            console.log('TenantId field detected in token');
            
            // Extract TenantId from token payload
            // Based on the exact token structure: TenantId is an array with a single string value "Synchro"
            let tenantId = 'Default';
            
            // Check all possible field names for tenant information
            if (payload.TenantId) {
                if (Array.isArray(payload.TenantId) && payload.TenantId.length > 0) {
                    tenantId = payload.TenantId[0];
                    console.log('Using TenantId (array) from token:', tenantId);
                } else if (typeof payload.TenantId === 'string') {
                    tenantId = payload.TenantId;
                    console.log('Using TenantId (string) from token:', tenantId);
                }
            } else if (payload.tenant_id) {
                tenantId = typeof payload.tenant_id === 'string' ? payload.tenant_id : JSON.stringify(payload.tenant_id);
                console.log('Using tenant_id from token:', tenantId);
            } else if (payload.tenantId) {
                tenantId = typeof payload.tenantId === 'string' ? payload.tenantId : JSON.stringify(payload.tenantId);
                console.log('Using tenantId from token:', tenantId);
            } else if (payload.Tenant) {
                tenantId = typeof payload.Tenant === 'string' ? payload.Tenant : JSON.stringify(payload.Tenant);
                console.log('Using Tenant from token:', tenantId);
            } else if (payload.tenant) {
                tenantId = typeof payload.tenant === 'string' ? payload.tenant : JSON.stringify(payload.tenant);
                console.log('Using tenant from token:', tenantId);
            } else {
                console.warn('No tenant information found in token payload, using default');
            }
            
            this.userInfo = {
                username: payload.preferred_username || payload.email || payload.sub,
                tenant: tenantId
            };
            
            // Save tenant info
            localStorage.setItem('tenantName', tenantId);
            this.tenant = tenantId;
            
            this.updateUIWithUserInfo();
        } catch (error) {
            console.error('Error parsing JWT token:', error);
            throw error;
        }
    }
    
    /**
     * Send token to backend for validation and session creation
     */
    async sendTokenToBackend(accessToken, idToken) {
        try {
            const response = await fetch(`${this.backendBaseUrl}/api/auth/verify-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    access_token: accessToken,
                    id_token: idToken || null
                })
            });
            
            if (response.ok) {
                console.log('Token verified with backend');
                return true;
            } else {
                console.error('Backend token verification failed:', await response.text());
                return false;
            }
        } catch (error) {
            console.error('Error sending token to backend:', error);
            return false;
        }
    }

    /**
     * Prevent infinite redirect loops
     */
    checkRedirectLoopProtection() {
        // Check for tokens in URL hash (implicit flow)
        if (window.location.hash && window.location.hash.includes('access_token=')) {
            console.log('Found tokens in URL hash, resetting redirect counter');
            sessionStorage.setItem('auth_redirect_count', '0');
            return true;
        }
        
        // Check for existing access token in localStorage (already authenticated)
        if (localStorage.getItem('access_token')) {
            console.log('Found existing access token, no need to redirect');
            sessionStorage.setItem('auth_redirect_count', '0');
            return true;
        }
        
        // Reset counter if we have just been redirected back from auth
        if (document.referrer.includes('keycloak.sensorsreport.net')) {
            console.log('Detected redirect from Keycloak, resetting redirect counter');
            sessionStorage.setItem('auth_redirect_count', '0');
            return true;
        }
        
        // Check and increment redirect counter
        const redirectCount = parseInt(sessionStorage.getItem('auth_redirect_count') || '0');
        if (redirectCount > 5) {
            console.error('Detected authentication redirect loop!');
            sessionStorage.setItem('auth_redirect_count', '0');
            
            // Show error message to user instead of redirecting again
            this.showAuthError('Authentication redirect loop detected. Please try clearing your cookies and refreshing the page.');
            return false;
        }
        
        // Increment counter
        sessionStorage.setItem('auth_redirect_count', redirectCount + 1);
        return true;
    }

    /**
     * Check if user is authenticated with the backend
     */
    async checkAuthStatus() {
        console.log('Checking authentication status...');
        // Check for active token in local storage first
        const token = localStorage.getItem('access_token');
        const expiresAt = localStorage.getItem('expires_at');
        
        // If we have a valid token in localStorage, we should trust that over logged_out cookie
        // This fixes the issue where a user may have just logged in but the logged_out cookie is still present
        if (token && expiresAt && Date.now() < parseInt(expiresAt)) {
            console.log('Found valid token in localStorage, clearing any stale logout indicators');
            // We have a valid token - make sure we clear any stale logout indicators
            this.clearLogoutIndicators();
            
            // Use the stored token
            this.isUserAuthenticated = true;
            
            try {
                // Parse the token to get user info
                this.parseToken(token);
                
                // Also verify with the backend
                await this.verifyTokenWithBackend();
                
                // Ensure UI is updated after a short delay to allow DOM to load
                setTimeout(() => this.updateUIWithUserInfo(true), 500);
                return true;
            } catch (error) {
                console.error('Error using stored token:', error);
                // Token might be invalid, continue with backend check
            }
        }
        
        // Check for logged_out cookie if we don't have a valid token
        const loggedOutCookie = document.cookie.split(';').find(c => c.trim().startsWith('logged_out='));
        if (loggedOutCookie) {
            console.log('Found logged_out cookie, user has explicitly logged out');
            // Clean up all authentication state
            this.clearAuthState();
            return false;
        }
        
        // Check if we've just logged out based on URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const noAutoLogin = urlParams.get('no_auto_login');
        
        if (noAutoLogin === 'true') {
            console.log('no_auto_login parameter detected, skipping auto-login');
            // Save the fact we've logged out in sessionStorage to persist across page refreshes
            sessionStorage.setItem('logged_out', 'true');
            
            // Clean the URL to remove the parameter
            const url = new URL(window.location);
            url.searchParams.delete('no_auto_login');
            url.searchParams.delete('t'); // Remove timestamp param too
            url.searchParams.delete('logout'); // Remove logout param too
            window.history.replaceState({}, '', url);
            
            // Clear all token data
            this.clearAuthState();
            return false;
        }
        
        // Check if we've logged out in this session (persists through refreshes)
        if (sessionStorage.getItem('logged_out') === 'true') {
            console.log('User has logged out in this session, not auto-redirecting to login');
            // Don't auto-redirect, but keep the state
            this.isUserAuthenticated = false;
            this.userInfo = null;
            return false;
        }
        
        // Check if we've just logged out
        if (sessionStorage.getItem('just_logged_out') === 'true') {
            console.log('Just logged out, clearing auth state');
            // Clear the flag
            sessionStorage.removeItem('just_logged_out');
            // Ensure we're showing as logged out
            this.isUserAuthenticated = false;
            this.userInfo = null;
            return false;
        }
        
        try {
            // Try to get auth status from backend
            const response = await fetch(`${this.backendBaseUrl}/api/auth/user`, {
                credentials: 'include' // Important to include cookies
            });
            
            if (response.ok) {
                const data = await response.json();
                
                // Debug output
                console.log('Auth status from backend:', data);
                
                this.isUserAuthenticated = data.authenticated;
                this.userInfo = data.user;
                
                // If we're authenticated through the backend, clear any logout indicators
                if (this.isUserAuthenticated) {
                    this.clearLogoutIndicators();
                }
                
                // Save tenant info if available
                if (data.user && data.user.tenant) {
                    localStorage.setItem('tenantName', data.user.tenant);
                    this.tenant = data.user.tenant;
                }
                
                // Update UI with user info if authenticated
                if (this.isUserAuthenticated) {
                    this.updateUIWithUserInfo();
                    return true;
                } else {
                    // Only redirect to login if:
                    // 1. We're on the main page
                    // 2. Redirect loop protection passes
                    // 3. User hasn't explicitly logged out this session
                    if ((window.location.pathname === '/' || 
                        window.location.pathname.endsWith('/') || 
                        window.location.pathname.endsWith('index.html')) && 
                        this.checkRedirectLoopProtection() &&
                        !sessionStorage.getItem('logged_out')) {
                        
                        console.log('User not authenticated on main page, redirecting to login');
                        this.redirectToKeycloak();
                    }
                    return false;
                }
            } else {
                console.warn('Auth check failed with status:', response.status);
                return false;
            }
        } catch (error) {
            console.error('Error checking authentication status:', error);
            this.handleAuthError(error);
            return false;
        }
    }
    
    /**
     * Clear all authentication state
     */
    clearAuthState() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('id_token');
        localStorage.removeItem('expires_at');
        localStorage.removeItem('oauth_state');
        
        // Don't redirect back to login
        this.isUserAuthenticated = false;
        this.userInfo = null;
    }
    
    /**
     * Clear all logout indicators when a user is successfully authenticated
     */
    clearLogoutIndicators() {
        // Clear any logout indicators in cookies by setting to expired
        document.cookie = "logged_out=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        document.cookie = "manual_logout=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        
        // Clear any logout indicators in session storage
        sessionStorage.removeItem('logged_out');
        sessionStorage.removeItem('just_logged_out');
    }

    /**
     * Verify the token with the backend
     */
    async verifyTokenWithBackend() {
        const token = localStorage.getItem('access_token');
        const idToken = localStorage.getItem('id_token');
        
        if (!token) {
            console.error('No token available to verify with backend');
            return false;
        }
        
        try {
            const response = await fetch(`${this.backendBaseUrl}/api/auth/verify-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    access_token: token,
                    id_token: idToken || null
                })
            });
            
            if (response.ok) {
                console.log('Token verified with backend');
                const data = await response.json();
                
                if (data.user) {
                    this.userInfo = data.user;
                    
                    // Save tenant info if available
                    if (data.user.tenant) {
                        localStorage.setItem('tenantName', data.user.tenant);
                        this.tenant = data.user.tenant;
                    }
                    
                    this.updateUIWithUserInfo();
                }
                
                return true;
            } else {
                console.error('Backend token verification failed:', await response.text());
                return false;
            }
        } catch (error) {
            console.error('Error verifying token with backend:', error);
            return false;
        }
    }

    /**
     * Redirect to backend login endpoint
     */
    login() {
        // Increment redirect counter
        const currentCount = parseInt(sessionStorage.getItem('auth_redirect_count') || '0');
        sessionStorage.setItem('auth_redirect_count', currentCount + 1);
        
        // Redirect to login
        window.location.href = `${this.backendBaseUrl}/api/auth/login`;
    }

    /**
     * Redirect directly to Keycloak for authentication
     * Uses the implicit flow for synchronous authentication
     */
    redirectToKeycloak() {
        // Generate a random state for CSRF protection
        const state = Math.random().toString(36).substring(2);
        localStorage.setItem('oauth_state', state);
        
        // Increment redirect counter
        const currentCount = parseInt(sessionStorage.getItem('auth_redirect_count') || '0');
        sessionStorage.setItem('auth_redirect_count', currentCount + 1);
        
        // Build the Keycloak authorization URL
        const authUrl = new URL(this.keycloakConfig.authUrl);
        
        // Set parameters for implicit flow (token direct in URL hash)
        authUrl.searchParams.append('client_id', this.keycloakConfig.clientId);
        authUrl.searchParams.append('redirect_uri', window.location.origin + window.location.pathname);
        authUrl.searchParams.append('response_type', this.keycloakConfig.responseType);
        authUrl.searchParams.append('scope', 'openid profile email');
        authUrl.searchParams.append('state', state);
        
        console.log('Redirecting to Keycloak with implicit flow:', authUrl.toString());
        
        // Redirect to Keycloak
        window.location.href = authUrl.toString();
    }

    /**
     * Call backend logout endpoint
     */
    logout() {
        console.log('Logout method called');
        
        // Clear all local storage items related to authentication
        localStorage.removeItem('access_token');
        localStorage.removeItem('id_token');
        localStorage.removeItem('expires_at');
        localStorage.removeItem('oauth_state');
        localStorage.removeItem('tenantName');
        
        // Reset instance variables
        this.isUserAuthenticated = false;
        this.userInfo = null;
        this.tenant = 'Default';
        
        // Clear any display of token data
        const jsonDisplay = document.getElementById('jsonDisplay');
        if (jsonDisplay) {
            jsonDisplay.value = '';
        }
        
        // Set flags to indicate we've just logged out
        // This prevents auto re-authentication after logout
        sessionStorage.setItem('just_logged_out', 'true');
        sessionStorage.setItem('logged_out', 'true');
        
        // Also set a cookie to persist through redirects in case the server-side cookie doesn't take effect immediately
        document.cookie = "manual_logout=true; path=/; max-age=30";
        
        // Navigate to the backend logout endpoint
        window.location.href = `${this.backendBaseUrl}/api/auth/logout`;
    }

    /**
     * Get the current access token (for API.js compatibility)
     * Not used directly with backend authentication as tokens are in HTTP-only cookies
     */
    getToken() {
        // This method exists for compatibility with API client
        // but returns null since we're using HTTP-only cookies
        return null;
    }
    
    /**
     * Update UI with user info
     * @param {boolean} forceRetry - Whether to force a retry if elements aren't found
     */
    updateUIWithUserInfo(forceRetry = false) {
        console.log('Updating UI with user info:', this.userInfo);
        
        // Update UI elements
        const userElement = document.getElementById("loginUser");
        const tenantElement = document.getElementById("tenantName");
        const tenantInput = document.getElementById("tenantname");
        
        // Debug DOM element availability
        console.log('DOM elements found:', { 
            userElement: !!userElement, 
            tenantElement: !!tenantElement, 
            tenantInput: !!tenantInput
        });
        
        // Check if any critical elements are missing and retry if needed
        if ((!userElement || !tenantElement) && (forceRetry || this.uiUpdateRetryCount < 3)) {
            // Set up retry count if not already set
            if (typeof this.uiUpdateRetryCount === 'undefined') {
                this.uiUpdateRetryCount = 0;
            }
            
            // Increment retry count
            this.uiUpdateRetryCount++;
            
            console.log(`UI elements not found, retrying update (${this.uiUpdateRetryCount}/3)...`);
            
            // Schedule a retry after a delay
            setTimeout(() => {
                this.updateUIWithUserInfo(true);
            }, 500 * this.uiUpdateRetryCount); // Increasing delay with each retry
            
            return;
        }
        
        // Reset retry count after a successful update or max retries
        this.uiUpdateRetryCount = 0;
        
        if (userElement && this.userInfo && this.userInfo.username) {
            userElement.textContent = `User: ${this.userInfo.username}`;
            console.log('Updated username display to:', this.userInfo.username);
        } else {
            console.warn('Cannot update user element:', {
                elementExists: !!userElement,
                userInfoExists: !!this.userInfo,
                username: this.userInfo?.username
            });
        }
        
        if (tenantElement) {
            tenantElement.textContent = `Tenant: ${this.tenant || 'Default'}`;
            console.log('Updated tenant display to:', this.tenant || 'Default');
        } else {
            console.warn('Tenant element not found');
        }
        
        // Set the value of the tenantname input field to the tenant from the token
        if (tenantInput && this.tenant) {
            tenantInput.value = this.tenant;
            console.log('Updated tenant input value to:', this.tenant);
        } else {
            console.warn('Cannot update tenant input:', {
                elementExists: !!tenantInput,
                tenantExists: !!this.tenant
            });
        }
    }

    /**
     * Set up event listeners for auth-related UI elements
     */
    setupEventListeners() {
        // Set up the show token button event listener
        const showTokenButton = document.getElementById('showTokenButton');
        if (showTokenButton) {
            showTokenButton.addEventListener('click', () => this.showToken());
        }
        
        // Set up logout button if it exists
        const logoutButton = document.getElementById('logoutButton');
        if (logoutButton) {
            logoutButton.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent any default action
                console.log('Logout button clicked');
                this.logout();
            });
        } else {
            console.warn('Logout button not found in the DOM');
            // Try to set up the listener again after a short delay
            setTimeout(() => {
                const delayedLogoutButton = document.getElementById('logoutButton');
                if (delayedLogoutButton) {
                    console.log('Found logout button after delay');
                    delayedLogoutButton.addEventListener('click', () => this.logout());
                }
            }, 1000);
        }
        
        // Set up tenant selection input
        const tenantSelect = document.getElementById('tenantname');
        if (tenantSelect) {
            tenantSelect.addEventListener('change', () => {
                const newTenant = tenantSelect.value;
                this.setTenant(newTenant);
            });
        }
    }
    
    /**
     * Set tenant on the backend
     */
    async setTenant(tenant) {
        try {
            const response = await fetch(`${this.backendBaseUrl}/api/auth/tenant`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ tenant })
            });
            
            if (response.ok) {
                localStorage.setItem('tenantName', tenant);
                this.tenant = tenant;
                console.log(`Tenant changed to: ${tenant}`);
                
                // Update UI
                const tenantElement = document.getElementById("tenantName");
                if (tenantElement) {
                    tenantElement.textContent = `Tenant: ${tenant}`;
                }
            } else {
                console.error('Failed to update tenant');
            }
        } catch (error) {
            console.error('Error setting tenant:', error);
        }
    }

    /**
     * Show token details in a prettified format
     */
    async showToken() {
        try {
            // // Force a check of authentication status with the backend first
            // await this.checkAuthStatus();
            
            // // First check if user is authenticated
            // if (!this.isUserAuthenticated) {
            //     // Display a message indicating the user is not logged in
            //     const jsonDisplay = document.getElementById('jsonDisplay');
            //     if (jsonDisplay) {
            //         jsonDisplay.value = JSON.stringify({
            //             error: "You are not logged in. No token is available.",
            //             status: "unauthenticated"
            //         }, null, 2);
            //     }
            //     return;
            // }
            
            // Use our new detailed token-details endpoint
            const response = await fetch(`${this.backendBaseUrl}/api/auth/token-details`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const tokenData = await response.json();
                
                // Check if response indicates authentication
                if (!tokenData.authenticated) {
                    // User is not authenticated even though we thought they were
                    this.isUserAuthenticated = false;
                    this.userInfo = null;
                    
                    const jsonDisplay = document.getElementById('jsonDisplay');
                    if (jsonDisplay) {
                        jsonDisplay.value = JSON.stringify({
                            error: "No token available. Please log in.",
                            status: "unauthenticated"
                        }, null, 2);
                    }
                    return;
                }
                
                // Display the detailed token info in the jsonDisplay area
                const jsonDisplay = document.getElementById('jsonDisplay');
                if (jsonDisplay) {
                    jsonDisplay.value = JSON.stringify(tokenData, null, 2);
                }
            } else {
                // If token-details endpoint fails, fall back to simpler user info
                const userResponse = await fetch(`${this.backendBaseUrl}/api/auth/user`, {
                    credentials: 'include'
                });
                
                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    
                    // Check if the user is authenticated according to the backend
                    if (!userData.authenticated) {
                        // Update our state to match backend
                        this.isUserAuthenticated = false;
                        this.userInfo = null;
                        
                        const jsonDisplay = document.getElementById('jsonDisplay');
                        if (jsonDisplay) {
                            jsonDisplay.value = JSON.stringify({
                                error: "No token available. Please log in.",
                                status: "unauthenticated"
                            }, null, 2);
                        }
                        return;
                    }
                    
                    // User is authenticated, update our state to match
                    this.isUserAuthenticated = true;
                    this.userInfo = userData.user;
                    
                    // Display the user info in the jsonDisplay area
                    const jsonDisplay = document.getElementById('jsonDisplay');
                    if (jsonDisplay) {
                        jsonDisplay.value = JSON.stringify({
                            authenticated: userData.authenticated,
                            user_info: userData.user,
                            tenant: this.tenant
                        }, null, 2);
                    }
                } else {
                    // Display error message in the jsonDisplay area
                    const jsonDisplay = document.getElementById('jsonDisplay');
                    if (jsonDisplay) {
                        jsonDisplay.value = JSON.stringify({
                            error: "No token available. Please log in.",
                            status: "unauthenticated"
                        }, null, 2);
                    }
                }
            }
        } catch (error) {
            console.error('Error displaying token info:', error);
            
            // Display error in the jsonDisplay area
            const jsonDisplay = document.getElementById('jsonDisplay');
            if (jsonDisplay) {
                jsonDisplay.value = JSON.stringify({
                    error: "Failed to retrieve token details: " + error.message,
                    status: "error"
                }, null, 2);
            }
        }
    }

    /**
     * Get user info from JWT token
     * @param {string} token - JWT token
     * @return {Object} User info from token payload
     */
    getUserInfoFromToken(token) {
        if (!token) return {};
        
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
                atob(base64)
                    .split('')
                    .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
            );
            
            return JSON.parse(jsonPayload);
        } catch (error) {
            console.error('Error decoding token:', error);
            return {};
        }
    }

    /**
     * Show an auth error message to the user
     */
    showAuthError(message) {
        // Display a friendly error message to the user
        const errorMessage = document.createElement('div');
        errorMessage.className = 'auth-error';
        errorMessage.style.position = 'fixed';
        errorMessage.style.top = '50%';
        errorMessage.style.left = '50%';
        errorMessage.style.transform = 'translate(-50%, -50%)';
        errorMessage.style.backgroundColor = '#fff';
        errorMessage.style.padding = '20px';
        errorMessage.style.borderRadius = '5px';
        errorMessage.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
        errorMessage.style.zIndex = '1000';
        
        errorMessage.innerHTML = `
            <h3>Authentication Error</h3>
            <p>${message}</p>
            <p>Possible causes:</p>
            <ul>
                <li>Session timeout</li>
                <li>Network connectivity issues</li>
                <li>Server configuration problems</li>
            </ul>
            <button id="retry-auth" style="padding: 8px 16px; margin-top: 10px; cursor: pointer;">Try Again</button>
            <button id="clear-auth-data" style="padding: 8px 16px; margin-top: 10px; margin-left: 10px; cursor: pointer;">Clear Auth Data</button>
        `;
        
        // Add to the document
        document.body.appendChild(errorMessage);
        
        // Add event listener to retry button
        document.getElementById('retry-auth')?.addEventListener('click', () => {
            errorMessage.remove();
            sessionStorage.setItem('auth_redirect_count', '0');
            this.login();
        });
        
        // Add event listener to clear auth data button
        document.getElementById('clear-auth-data')?.addEventListener('click', () => {
            errorMessage.remove();
            localStorage.clear();
            sessionStorage.clear();
            document.cookie.split(";").forEach(function(c) {
                document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
            });
            window.location.reload();
        });
    }

    /**
     * Handle authentication errors
     */
    handleAuthError(error) {
        console.error('Authentication error:', error);
        this.showAuthError('There was a problem authenticating with the server: ' + error.message);
    }
}

// Initialize auth manager
export const authManager = new AuthManager();

export default AuthManager;