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
        
        // IMPORTANT: Expose this instance to window.AuthBackend for global access
        window.AuthBackend = this;
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
                // Also store as auth_token for compatibility with other parts of the app
                localStorage.setItem('auth_token', accessToken);
                
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
                    
                    // Also try to extract the token from the response if available
                    return response.json().catch(() => null);
                }
            })
            .then(data => {
                if (data && data.access_token) {
                    // Store tokens in localStorage
                    localStorage.setItem('access_token', data.access_token);
                    // Also store as auth_token for compatibility with other parts of the app
                    localStorage.setItem('auth_token', data.access_token);
                    
                    if (data.id_token) localStorage.setItem('id_token', data.id_token);
                    console.log('Stored tokens from code exchange');
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
        const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
        const expiresAt = localStorage.getItem('expires_at');
        
        // Synchronize tokens if they're not in sync
        if (localStorage.getItem('access_token') && !localStorage.getItem('auth_token')) {
            localStorage.setItem('auth_token', localStorage.getItem('access_token'));
            console.log('Synchronized access_token to auth_token');
        } else if (!localStorage.getItem('access_token') && localStorage.getItem('auth_token')) {
            localStorage.setItem('access_token', localStorage.getItem('auth_token'));
            console.log('Synchronized auth_token to access_token');
        }
        
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
        
        // Check for logged_out cookie if we don't have a valid token - but use SameSite cookies
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
                credentials: 'include', // Important to include cookies
                headers: {
                    // Add cache control to prevent caching of auth status
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
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
                    
                    // If authenticated but no token in localStorage, attempt to get one
                    if (!localStorage.getItem('access_token') && !localStorage.getItem('auth_token')) {
                        console.log('Authenticated but no token in localStorage, attempting to retrieve token');
                        await this.retrieveTokenFromBackend();
                    }
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
                    // Show warning about third-party cookies if we have a manual_logout cookie
                    // but not a logged_out cookie (indicates possible cookie blocking)
                    const manualLogoutCookie = document.cookie.split(';').find(c => c.trim().startsWith('manual_logout='));
                    if (manualLogoutCookie && !loggedOutCookie && !sessionStorage.getItem('shown_cookie_warning')) {
                        // This suggests cookies might be blocked
                        console.warn('Possible cookie blocking detected - manual logout cookie found but not reflected in auth state');
                        this.showCookieWarning();
                        sessionStorage.setItem('shown_cookie_warning', 'true');
                    }
                    
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
        localStorage.removeItem('auth_token'); // Also clear auth_token
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
     * Retrieve token from the backend when authenticated via cookies but no token in localStorage
     * This helps with Chrome's new cookie policies by providing a fallback
     */
    async retrieveTokenFromBackend() {
        try {
            console.log('Attempting to retrieve token from backend');
            const response = await fetch(`${this.backendBaseUrl}/api/auth/retrieve-token`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                },
                credentials: 'include' // Important to include cookies
            });
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.success && data.access_token) {
                    console.log('Successfully retrieved token from backend');
                    
                    // Store tokens in localStorage
                    localStorage.setItem('access_token', data.access_token);
                    localStorage.setItem('auth_token', data.access_token); // Keep both in sync
                    
                    if (data.id_token) {
                        localStorage.setItem('id_token', data.id_token);
                    }
                    
                    if (data.expires_in) {
                        const expiresAt = Date.now() + (parseInt(data.expires_in) * 1000);
                        localStorage.setItem('expires_at', expiresAt.toString());
                    }
                    
                    // Update authentication state
                    this.isUserAuthenticated = true;
                    
                    // Update user info if available
                    if (data.user) {
                        this.userInfo = data.user;
                        
                        // Also update tenant if available
                        if (data.user.tenant) {
                            this.tenant = data.user.tenant;
                            localStorage.setItem('tenantName', data.user.tenant);
                        }
                    }
                    
                    // Update UI with new auth state
                    this.updateUIWithUserInfo();
                    
                    return true;
                } else {
                    console.warn('Backend did not return a valid token:', data.error || 'Unknown error');
                    return false;
                }
            } else {
                // If we got a 401, the user is not authenticated
                if (response.status === 401) {
                    console.warn('Failed to retrieve token - user not authenticated');
                    this.isUserAuthenticated = false;
                    this.userInfo = null;
                } else {
                    console.warn('Failed to retrieve token from backend:', response.status);
                }
                return false;
            }
        } catch (error) {
            console.error('Error retrieving token from backend:', error);
            return false;
        }
    }

    /**
     * Call backend login endpoint
     */
    login() {
        // Increment redirect counter
        const currentCount = parseInt(sessionStorage.getItem('auth_redirect_count') || '0');
        sessionStorage.setItem('auth_redirect_count', currentCount + 1);
        
        // Clear any existing cookie detection flags
        sessionStorage.removeItem('cookies_already_checked');
        
        // Set a test cookie for third-party cookie detection
        this.setCookieCheckCookie();
        
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
        localStorage.removeItem('auth_token'); // Also clear auth_token for consistent cleanup
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
        
        // Update the username display
        if (userElement && this.userInfo && this.userInfo.username) {
            userElement.textContent = `User: ${this.userInfo.username}`;
            console.log('Updated username display to:', this.userInfo.username);
        } else if (userElement) {
            // Ensure we show "Not logged in" if no user info is available
            userElement.textContent = 'User: Not logged in';
            console.log('Reset username display to "Not logged in"');
        }
        
        // Update the tenant name display
        if (tenantElement) {
            const displayTenant = this.tenant || 'Default';
            tenantElement.textContent = `Tenant: ${displayTenant}`;
            console.log('Updated tenant display to:', displayTenant);
        }
        
        // Set the value of the tenant input field to the tenant from the token
        if (tenantInput && this.tenant) {
            tenantInput.value = this.tenant;
            console.log('Updated tenant input value to:', this.tenant);
        } else if (tenantInput) {
            // Default to "Default" if no tenant is specified
            if (!tenantInput.value) {
                tenantInput.value = 'Default';
                console.log('Set default tenant value');
            }
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
     * Show token details in a modal dialog with enhanced information and formatting
     */
    async showToken() {
        try {
            console.log('Showing token details');
            
            // Check for tokens in both locations
            const accessToken = localStorage.getItem('access_token');
            const authToken = localStorage.getItem('auth_token');
            const idToken = localStorage.getItem('id_token');
            
            // Ensure both token variables are in sync - if one exists but not the other, sync them
            if (accessToken && !authToken) {
                console.log('Syncing access_token to auth_token');
                localStorage.setItem('auth_token', accessToken);
            } else if (!accessToken && authToken) {
                console.log('Syncing auth_token to access_token');
                localStorage.setItem('access_token', authToken);
            }
            
            // Get token details from backend or localStorage
            let tokenDetails = null;
            let userInfo = null;
            let cookieTokenAvailable = false;
            let localTokenAvailable = !!(accessToken || authToken);
            let tokenSource = 'unknown';
            
            // First try to get token details from backend (which has access to HTTP-only cookies)
            try {
                const response = await fetch(`${this.backendBaseUrl}/api/auth/token-details`, {
                    credentials: 'include',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.authenticated && data.token) {
                        tokenDetails = data;
                        cookieTokenAvailable = true;
                        tokenSource = 'http-only cookie';
                        console.log('Retrieved token details from backend HTTP-only cookies');
                    }
                }
            } catch (backendError) {
                console.warn('Error fetching token details from backend:', backendError);
            }
            
            // If no token from backend, try parsing the local token
            if (!tokenDetails && (accessToken || authToken)) {
                const token = accessToken || authToken;
                try {
                    const decodedToken = this.getUserInfoFromToken(token);
                    tokenDetails = {
                        authenticated: true,
                        token: decodedToken,
                        user: this.userInfo || {
                            username: decodedToken.preferred_username || decodedToken.email || decodedToken.sub,
                            tenant: this.tenant
                        },
                        source: 'localStorage'
                    };
                    tokenSource = 'localStorage';
                    console.log('Retrieved token details from localStorage');
                } catch (parseError) {
                    console.warn('Error parsing token from localStorage:', parseError);
                }
            }
            
            // If still no token details, try getting at least user info from backend
            if (!tokenDetails) {
                try {
                    const userResponse = await fetch(`${this.backendBaseUrl}/api/auth/user`, {
                        credentials: 'include',
                        headers: {
                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                            'Pragma': 'no-cache'
                        }
                    });
                    
                    if (userResponse.ok) {
                        const userData = await userResponse.json();
                        if (userData.authenticated) {
                            userInfo = userData.user;
                            cookieTokenAvailable = true;
                            tokenSource = 'backend session';
                            console.log('Retrieved user info from backend session');
                        }
                    }
                } catch (userError) {
                    console.warn('Error fetching user info from backend:', userError);
                }
            }
            
            // Create and show modal dialog for token information
            this.createTokenInfoModal(tokenDetails, userInfo, tokenSource, cookieTokenAvailable, localTokenAvailable);
            
        } catch (error) {
            console.error('Error showing token details:', error);
            this.showAuthError('Could not display token details: ' + error.message);
        }
    }

    /**
     * Create modal dialog to display token information in a user-friendly format
     */
    createTokenInfoModal(tokenDetails, userInfo, tokenSource, cookieTokenAvailable, localTokenAvailable) {
        // Remove any existing token modal
        const existingModal = document.getElementById('token-info-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal container
        const modal = document.createElement('div');
        modal.id = 'token-info-modal';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.zIndex = '2000';
        
        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.style.backgroundColor = 'white';
        modalContent.style.borderRadius = '8px';
        modalContent.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
        modalContent.style.width = '90%';
        modalContent.style.maxWidth = '800px';
        modalContent.style.maxHeight = '90vh';
        modalContent.style.overflow = 'auto';
        modalContent.style.position = 'relative';
        modalContent.style.padding = '20px';
        
        // Create close button
        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '10px';
        closeButton.style.right = '10px';
        closeButton.style.border = 'none';
        closeButton.style.background = 'none';
        closeButton.style.fontSize = '24px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.color = '#666';
        closeButton.addEventListener('click', () => {
            modal.remove();
        });
        
        // Create header
        const header = document.createElement('div');
        header.style.borderBottom = '1px solid #eee';
        header.style.marginBottom = '15px';
        header.style.paddingBottom = '10px';
        
        const title = document.createElement('h2');
        title.textContent = 'Authentication Details';
        title.style.margin = '0 0 5px 0';
        title.style.color = '#333';
        
        // Add authentication status badge
        const isAuthenticated = (tokenDetails && tokenDetails.authenticated) || (userInfo !== null);
        const authStatusBadge = document.createElement('span');
        authStatusBadge.textContent = isAuthenticated ? 'Authenticated' : 'Not Authenticated';
        authStatusBadge.style.display = 'inline-block';
        authStatusBadge.style.padding = '3px 8px';
        authStatusBadge.style.borderRadius = '12px';
        authStatusBadge.style.fontSize = '12px';
        authStatusBadge.style.fontWeight = 'bold';
        authStatusBadge.style.marginLeft = '10px';
        
        if (isAuthenticated) {
            authStatusBadge.style.backgroundColor = '#d4edda';
            authStatusBadge.style.color = '#155724';
        } else {
            authStatusBadge.style.backgroundColor = '#f8d7da';
            authStatusBadge.style.color = '#721c24';
        }
        
        title.appendChild(authStatusBadge);
        header.appendChild(title);
        
        // Add token source information
        if (isAuthenticated) {
            const sourceInfo = document.createElement('p');
            sourceInfo.textContent = `Authentication source: ${tokenSource}`;
            sourceInfo.style.margin = '5px 0';
            sourceInfo.style.color = '#666';
            header.appendChild(sourceInfo);
        }
        
        // Create content sections
        const content = document.createElement('div');
        
        // Create tabs for different sections
        const tabContainer = document.createElement('div');
        tabContainer.style.display = 'flex';
        tabContainer.style.borderBottom = '1px solid #ddd';
        tabContainer.style.marginBottom = '15px';
        
        const tabContents = document.createElement('div');
        
        // Create tab buttons and content sections
        const tabs = [
            { id: 'summary', label: 'Summary', active: true },
            { id: 'details', label: 'Token Details', active: false },
            { id: 'debug', label: 'Debug Info', active: false }
        ];
        
        tabs.forEach(tab => {
            // Create tab button
            const tabButton = document.createElement('button');
            tabButton.textContent = tab.label;
            tabButton.dataset.tabId = tab.id;
            tabButton.style.padding = '10px 15px';
            tabButton.style.border = 'none';
            tabButton.style.backgroundColor = tab.active ? '#f8f9fa' : 'transparent';
            tabButton.style.borderBottom = tab.active ? '2px solid #007bff' : '2px solid transparent';
            tabButton.style.color = tab.active ? '#007bff' : '#333';
            tabButton.style.cursor = 'pointer';
            tabButton.style.fontWeight = tab.active ? 'bold' : 'normal';
            
            // Add click event to switch tabs
            tabButton.addEventListener('click', () => {
                // Update tab buttons
                tabContainer.querySelectorAll('button').forEach(btn => {
                    btn.style.backgroundColor = 'transparent';
                    btn.style.borderBottom = '2px solid transparent';
                    btn.style.color = '#333';
                    btn.style.fontWeight = 'normal';
                });
                tabButton.style.backgroundColor = '#f8f9fa';
                tabButton.style.borderBottom = '2px solid #007bff';
                tabButton.style.color = '#007bff';
                tabButton.style.fontWeight = 'bold';
                
                // Update tab contents
                tabContents.querySelectorAll('[data-tab-content]').forEach(content => {
                    content.style.display = 'none';
                });
                const tabContent = tabContents.querySelector(`[data-tab-content="${tab.id}"]`);
                if (tabContent) {
                    tabContent.style.display = 'block';
                }
            });
            
            tabContainer.appendChild(tabButton);
            
            // Create tab content section
            const tabContent = document.createElement('div');
            tabContent.dataset.tabContent = tab.id;
            tabContent.style.display = tab.active ? 'block' : 'none';
            
            if (tab.id === 'summary') {
                this.createSummaryTabContent(tabContent, tokenDetails, userInfo, cookieTokenAvailable, localTokenAvailable);
            } else if (tab.id === 'details') {
                this.createDetailsTabContent(tabContent, tokenDetails);
            } else if (tab.id === 'debug') {
                this.createDebugTabContent(tabContent, tokenDetails, userInfo);
            }
            
            tabContents.appendChild(tabContent);
        });
        
        // Add tabs and content to main content
        content.appendChild(tabContainer);
        content.appendChild(tabContents);
        
        // Add header and content to modal
        modalContent.appendChild(closeButton);
        modalContent.appendChild(header);
        modalContent.appendChild(content);
        modal.appendChild(modalContent);
        
        // Add keyboard handler to close on Escape
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escHandler);
            }
        });
        
        // Add click handler to close when clicking outside the modal
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // Add modal to document
        document.body.appendChild(modal);
    }

    /**
     * Create the content for the Summary tab in the token info modal
     */
    createSummaryTabContent(container, tokenDetails, userInfo, cookieTokenAvailable, localTokenAvailable) {
        container.style.padding = '10px';
        
        // Use token details or user info, depending on what's available
        const isAuthenticated = (tokenDetails && tokenDetails.authenticated) || (userInfo !== null);
        const user = (tokenDetails && tokenDetails.user) || userInfo;
        const token = tokenDetails && tokenDetails.token;
        
        if (!isAuthenticated) {
            // Not authenticated section
            const notAuthMessage = document.createElement('div');
            notAuthMessage.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 48px; color: #dc3545; margin-bottom: 10px;">⚠️</div>
                    <h3 style="color: #dc3545; margin-bottom: 10px;">Not Authenticated</h3>
                    <p>You are not currently authenticated. Please log in to access token details.</p>
                    <button id="login-button" style="
                        padding: 8px 16px;
                        background-color: #007bff;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        margin-top: 10px;
                    ">Log In</button>
                </div>
            `;
            container.appendChild(notAuthMessage);
            
            // Add click handler for login button
            setTimeout(() => {
                const loginButton = document.getElementById('login-button');
                if (loginButton) {
                    loginButton.addEventListener('click', () => {
                        document.getElementById('token-info-modal').remove();
                        this.login();
                    });
                }
            }, 0);
            
            return;
        }
        
        // User information section
        const userInfoSection = document.createElement('div');
        userInfoSection.style.marginBottom = '20px';
        userInfoSection.style.padding = '15px';
        userInfoSection.style.backgroundColor = '#f8f9fa';
        userInfoSection.style.borderRadius = '4px';
        userInfoSection.style.border = '1px solid #dee2e6';
        
        const userTitle = document.createElement('h3');
        userTitle.textContent = 'User Information';
        userTitle.style.marginTop = '0';
        userTitle.style.marginBottom = '10px';
        userTitle.style.color = '#495057';
        
        userInfoSection.appendChild(userTitle);
        
        // Add user details
        if (user) {
            const userTable = document.createElement('table');
            userTable.style.width = '100%';
            userTable.style.borderCollapse = 'collapse';
            
            // Add rows for user information
            const userFields = [
                { label: 'Username', value: user.username || 'N/A' },
                { label: 'Tenant', value: user.tenant || this.tenant || 'Default' }
            ];
            
            // Add additional fields from token if available
            if (token) {
                if (token.email) userFields.push({ label: 'Email', value: token.email });
                if (token.name) userFields.push({ label: 'Full Name', value: token.name });
                if (token.given_name && token.family_name) {
                    userFields.push({ label: 'Given Name', value: token.given_name });
                    userFields.push({ label: 'Family Name', value: token.family_name });
                }
            }
            
            userFields.forEach(field => {
                const row = userTable.insertRow();
                const labelCell = row.insertCell(0);
                const valueCell = row.insertCell(1);
                
                labelCell.textContent = field.label;
                valueCell.textContent = field.value;
                
                labelCell.style.padding = '5px 10px 5px 0';
                labelCell.style.fontWeight = 'bold';
                labelCell.style.width = '30%';
                valueCell.style.padding = '5px 0';
            });
            
            userInfoSection.appendChild(userTable);
        } else {
            const noUserInfo = document.createElement('p');
            noUserInfo.textContent = 'No user information available.';
            userInfoSection.appendChild(noUserInfo);
        }
        
        // Token status section
        const tokenStatusSection = document.createElement('div');
        tokenStatusSection.style.marginBottom = '20px';
        tokenStatusSection.style.padding = '15px';
        tokenStatusSection.style.backgroundColor = '#f8f9fa';
        tokenStatusSection.style.borderRadius = '4px';
        tokenStatusSection.style.border = '1px solid #dee2e6';
        
        const tokenTitle = document.createElement('h3');
        tokenTitle.textContent = 'Token Status';
        tokenTitle.style.marginTop = '0';
        tokenTitle.style.marginBottom = '10px';
        tokenTitle.style.color = '#495057';
        
        tokenStatusSection.appendChild(tokenTitle);
        
        // Create table for token status
        const tokenTable = document.createElement('table');
        tokenTable.style.width = '100%';
        tokenTable.style.borderCollapse = 'collapse';
        
        // Add token status rows
        const tokenStatusFields = [
            { 
                label: 'Backend HTTP-only cookie', 
                value: cookieTokenAvailable ? 'Available ✓' : 'Not found ✗',
                style: cookieTokenAvailable ? 'color: #28a745;' : 'color: #dc3545;'
            },
            { 
                label: 'Browser localStorage token', 
                value: localTokenAvailable ? 'Available ✓' : 'Not found ✗',
                style: localTokenAvailable ? 'color: #28a745;' : 'color: #dc3545;'
            }
        ];
        
        // Add expiration info if available
        if (token && token.exp) {
            const expirationTime = new Date(token.exp * 1000);
            const now = new Date();
            const isExpired = expirationTime < now;
            const timeRemaining = isExpired ? 'Expired' : this.formatTimeRemaining(expirationTime - now);
            
            tokenStatusFields.push({ 
                label: 'Expiration Time', 
                value: expirationTime.toLocaleString(),
                style: ''
            });
            tokenStatusFields.push({ 
                label: 'Status', 
                value: isExpired ? 'Expired ✗' : `Valid (${timeRemaining} remaining) ✓`,
                style: isExpired ? 'color: #dc3545; font-weight: bold;' : 'color: #28a745; font-weight: bold;'
            });
        }
        
        tokenStatusFields.forEach(field => {
            const row = tokenTable.insertRow();
            const labelCell = row.insertCell(0);
            const valueCell = row.insertCell(1);
            
            labelCell.textContent = field.label;
            valueCell.innerHTML = field.value;
            
            labelCell.style.padding = '5px 10px 5px 0';
            labelCell.style.fontWeight = 'bold';
            labelCell.style.width = '40%';
            valueCell.style.padding = '5px 0';
            
            if (field.style) {
                valueCell.style = field.style;
            }
        });
        
        tokenStatusSection.appendChild(tokenTable);
        
        // Add refresh button if token is valid
        if (token && token.exp && new Date(token.exp * 1000) > new Date()) {
            const buttonRow = document.createElement('div');
            buttonRow.style.marginTop = '15px';
            buttonRow.style.textAlign = 'right';
            
            const refreshButton = document.createElement('button');
            refreshButton.textContent = 'Refresh Token';
            refreshButton.style.padding = '8px 16px';
            refreshButton.style.backgroundColor = '#007bff';
            refreshButton.style.color = 'white';
            refreshButton.style.border = 'none';
            refreshButton.style.borderRadius = '4px';
            refreshButton.style.cursor = 'pointer';
            
            refreshButton.addEventListener('click', async () => {
                try {
                    // Try to refresh the token through the backend
                    const response = await fetch(`${this.backendBaseUrl}/api/auth/refresh`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                            'Pragma': 'no-cache'
                        }
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success) {
                            // Update localStorage tokens if provided
                            if (data.access_token) {
                                localStorage.setItem('access_token', data.access_token);
                                localStorage.setItem('auth_token', data.access_token);
                            }
                            
                            // Update UI
                            document.getElementById('token-info-modal').remove();
                            this.showToken(); // Re-open with fresh data
                            
                            // Show success message
                            const successNotification = document.createElement('div');
                            successNotification.style.position = 'fixed';
                            successNotification.style.bottom = '20px';
                            successNotification.style.right = '20px';
                            successNotification.style.backgroundColor = '#d4edda';
                            successNotification.style.color = '#155724';
                            successNotification.style.padding = '10px 15px';
                            successNotification.style.borderRadius = '4px';
                            successNotification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
                            successNotification.textContent = 'Token refreshed successfully';
                            
                            document.body.appendChild(successNotification);
                            setTimeout(() => {
                                successNotification.remove();
                            }, 3000);
                        } else {
                            throw new Error(data.error || 'Token refresh failed');
                        }
                    } else {
                        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                    }
                } catch (error) {
                    console.error('Error refreshing token:', error);
                    
                    // Show error message
                    const errorNotification = document.createElement('div');
                    errorNotification.style.position = 'fixed';
                    errorNotification.style.bottom = '20px';
                    errorNotification.style.right = '20px';
                    errorNotification.style.backgroundColor = '#f8d7da';
                    errorNotification.style.color = '#721c24';
                    errorNotification.style.padding = '10px 15px';
                    errorNotification.style.borderRadius = '4px';
                    errorNotification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
                    errorNotification.textContent = `Token refresh failed: ${error.message}`;
                    
                    document.body.appendChild(errorNotification);
                    setTimeout(() => {
                        errorNotification.remove();
                    }, 5000);
                }
            });
            
            buttonRow.appendChild(refreshButton);
            tokenStatusSection.appendChild(buttonRow);
        }
        
        // Add sections to container
        container.appendChild(userInfoSection);
        container.appendChild(tokenStatusSection);
    }

    /**
     * Create the content for the Details tab in the token info modal
     */
    createDetailsTabContent(container, tokenDetails) {
        container.style.padding = '10px';
        
        if (!tokenDetails || !tokenDetails.token) {
            const noDetailsMessage = document.createElement('div');
            noDetailsMessage.style.padding = '20px';
            noDetailsMessage.style.textAlign = 'center';
            noDetailsMessage.style.color = '#666';
            noDetailsMessage.textContent = 'No token details available.';
            container.appendChild(noDetailsMessage);
            return;
        }
        
        const token = tokenDetails.token;
        
        // Create collapsible sections for each token component
        const sections = [
            { title: 'Claims', content: this.formatTokenClaims(token) },
            { title: 'Roles & Permissions', content: this.formatRolesAndPermissions(token) },
            { title: 'Issuer Information', content: this.formatIssuerInfo(token) }
        ];
        
        sections.forEach((section, index) => {
            // Skip if content is empty
            if (!section.content) return;
            
            const sectionDiv = document.createElement('div');
            sectionDiv.style.marginBottom = '15px';
            
            // Create header
            const header = document.createElement('div');
            header.style.padding = '10px 15px';
            header.style.backgroundColor = '#f8f9fa';
            header.style.borderTop = index === 0 ? '1px solid #dee2e6' : 'none';
            header.style.borderBottom = '1px solid #dee2e6';
            header.style.borderLeft = '1px solid #dee2e6';
            header.style.borderRight = '1px solid #dee2e6';
            header.style.cursor = 'pointer';
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            
            const headerTitle = document.createElement('h3');
            headerTitle.textContent = section.title;
            headerTitle.style.margin = '0';
            headerTitle.style.fontSize = '16px';
            
            const toggleIcon = document.createElement('span');
            toggleIcon.textContent = '▼';
            toggleIcon.style.transition = 'transform 0.3s';
            
            header.appendChild(headerTitle);
            header.appendChild(toggleIcon);
            
            // Create content
            const content = document.createElement('div');
            content.style.padding = '15px';
            content.style.border = '1px solid #dee2e6';
            content.style.borderTop = 'none';
            content.innerHTML = section.content;
            
            // Toggle functionality
            header.addEventListener('click', () => {
                const isVisible = content.style.display !== 'none';
                content.style.display = isVisible ? 'none' : 'block';
                toggleIcon.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
            });
            
            // Default open for first section
            content.style.display = index === 0 ? 'block' : 'none';
            toggleIcon.style.transform = index === 0 ? 'rotate(180deg)' : 'rotate(0deg)';
            
            sectionDiv.appendChild(header);
            sectionDiv.appendChild(content);
            container.appendChild(sectionDiv);
        });
    }

    /**
     * Create the content for the Debug tab in the token info modal
     */
    createDebugTabContent(container, tokenDetails, userInfo) {
        container.style.padding = '10px';
        
        // Create raw JSON view
        const debugInfo = document.createElement('div');
        debugInfo.style.marginBottom = '20px';
        
        // Title
        const title = document.createElement('h3');
        title.textContent = 'Raw Token Data';
        title.style.marginTop = '0';
        title.style.color = '#495057';
        debugInfo.appendChild(title);
        
        // Description
        const description = document.createElement('p');
        description.textContent = 'This is the raw token data for debugging purposes.';
        description.style.marginBottom = '15px';
        description.style.color = '#6c757d';
        debugInfo.appendChild(description);
        
        // JSON display
        const jsonDisplay = document.createElement('pre');
        jsonDisplay.style.backgroundColor = '#272822';
        jsonDisplay.style.color = '#f8f8f2';
        jsonDisplay.style.padding = '15px';
        jsonDisplay.style.borderRadius = '4px';
        jsonDisplay.style.overflowX = 'auto';
        jsonDisplay.style.whiteSpace = 'pre-wrap';
        jsonDisplay.style.fontSize = '13px';
        jsonDisplay.style.fontFamily = 'monospace';
        
        // Combine all available data
        const debugData = {
            tokenDetails: tokenDetails || null,
            userInfo: userInfo || null,
            localStorage: {
                access_token: localStorage.getItem('access_token') ? '[REDACTED]' : null,
                auth_token: localStorage.getItem('auth_token') ? '[REDACTED]' : null,
                id_token: localStorage.getItem('id_token') ? '[REDACTED]' : null,
                expires_at: localStorage.getItem('expires_at'),
                tenantName: localStorage.getItem('tenantName')
            },
            sessionStorage: {
                logged_out: sessionStorage.getItem('logged_out'),
                just_logged_out: sessionStorage.getItem('just_logged_out'),
                auth_redirect_count: sessionStorage.getItem('auth_redirect_count')
            },
            cookies: {
                access_token: document.cookie.includes('access_token=') ? '[PRESENT]' : '[NOT FOUND]',
                refresh_token: document.cookie.includes('refresh_token=') ? '[PRESENT]' : '[NOT FOUND]',
                logged_out: document.cookie.includes('logged_out=') ? '[PRESENT]' : '[NOT FOUND]',
                manual_logout: document.cookie.includes('manual_logout=') ? '[PRESENT]' : '[NOT FOUND]'
            },
            authState: {
                isUserAuthenticated: this.isUserAuthenticated,
                tenant: this.tenant
            }
        };
        
        jsonDisplay.textContent = JSON.stringify(debugData, null, 2);
        debugInfo.appendChild(jsonDisplay);
        
        // Copy button
        const copyButton = document.createElement('button');
        copyButton.textContent = 'Copy to Clipboard';
        copyButton.style.marginTop = '10px';
        copyButton.style.padding = '8px 16px';
        copyButton.style.backgroundColor = '#6c757d';
        copyButton.style.color = 'white';
        copyButton.style.border = 'none';
        copyButton.style.borderRadius = '4px';
        copyButton.style.cursor = 'pointer';
        
        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(JSON.stringify(debugData, null, 2)).then(() => {
                copyButton.textContent = 'Copied!';
                setTimeout(() => {
                    copyButton.textContent = 'Copy to Clipboard';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy debug info:', err);
                copyButton.textContent = 'Copy failed';
                setTimeout(() => {
                    copyButton.textContent = 'Copy to Clipboard';
                }, 2000);
            });
        });
        
        debugInfo.appendChild(copyButton);
        container.appendChild(debugInfo);
    }

    /**
     * Format token claims for display
     */
    formatTokenClaims(token) {
        if (!token) return null;
        
        // Extract standard claims
        const standardClaims = [
            { name: 'sub', label: 'Subject' },
            { name: 'name', label: 'Full Name' },
            { name: 'given_name', label: 'Given Name' },
            { name: 'family_name', label: 'Family Name' },
            { name: 'preferred_username', label: 'Preferred Username' },
            { name: 'email', label: 'Email' },
            { name: 'email_verified', label: 'Email Verified' },
            { name: 'iss', label: 'Issuer' },
            { name: 'aud', label: 'Audience' },
            { name: 'azp', label: 'Authorized Party' },
            { name: 'exp', label: 'Expires At' },
            { name: 'iat', label: 'Issued At' },
            { name: 'auth_time', label: 'Authentication Time' },
            { name: 'jti', label: 'JWT ID' },
            { name: 'TenantId', label: 'Tenant ID' },
            { name: 'scope', label: 'Scope' }
        ];
        
        let tableHtml = `
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
                <thead>
                    <tr>
                        <th style="text-align: left; padding: 8px; border-bottom: 2px solid #dee2e6;">Claim</th>
                        <th style="text-align: left; padding: 8px; border-bottom: 2px solid #dee2e6;">Value</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Add standard claims if they exist
        standardClaims.forEach(claim => {
            if (token[claim.name] !== undefined) {
                let value = token[claim.name];
                
                // Format timestamps
                if (claim.name === 'exp' || claim.name === 'iat' || claim.name === 'auth_time') {
                    value = new Date(value * 1000).toLocaleString();
                }
                
                // Format arrays
                if (Array.isArray(value)) {
                    value = value.join(', ');
                }
                
                // Format objects
                if (typeof value === 'object' && value !== null) {
                    value = JSON.stringify(value);
                }
                
                // Format booleans
                if (typeof value === 'boolean') {
                    value = value ? 'Yes' : 'No';
                }
                
                tableHtml += `
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #dee2e6; font-weight: bold;">${claim.label}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #dee2e6; word-break: break-all;">${value}</td>
                    </tr>
                `;
            }
        });
        
        // Add any additional non-standard claims
        const standardClaimNames = standardClaims.map(c => c.name);
        Object.keys(token).forEach(claimName => {
            if (!standardClaimNames.includes(claimName) && 
                claimName !== 'realm_access' && 
                claimName !== 'resource_access') {
                
                let value = token[claimName];
                
                // Format arrays
                if (Array.isArray(value)) {
                    value = value.join(', ');
                }
                
                // Format objects
                if (typeof value === 'object' && value !== null) {
                    value = JSON.stringify(value);
                }
                
                // Format booleans
                if (typeof value === 'boolean') {
                    value = value ? 'Yes' : 'No';
                }
                
                tableHtml += `
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #dee2e6; font-weight: bold;">${claimName}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #dee2e6; word-break: break-all;">${value}</td>
                    </tr>
                `;
            }
        });
        
        tableHtml += `
                </tbody>
            </table>
        `;
        
        return tableHtml;
    }

    /**
     * Format roles and permissions from token
     */
    formatRolesAndPermissions(token) {
        if (!token || (!token.realm_access && !token.resource_access)) {
            return null;
        }
        
        let html = '';
        
        // Realm roles
        if (token.realm_access && token.realm_access.roles && token.realm_access.roles.length > 0) {
            html += `
                <h4 style="margin-top: 0; margin-bottom: 10px;">Realm Roles</h4>
                <ul style="margin-top: 0; margin-bottom: 15px; padding-left: 20px;">
            `;
            
            token.realm_access.roles.forEach(role => {
                html += `<li>${role}</li>`;
            });
            
            html += `</ul>`;
        }
        
        // Resource access/client roles
        if (token.resource_access && Object.keys(token.resource_access).length > 0) {
            html += `<h4 style="margin-bottom: 10px;">Client Roles</h4>`;
            
            Object.keys(token.resource_access).forEach(client => {
                if (token.resource_access[client].roles && token.resource_access[client].roles.length > 0) {
                    html += `
                        <h5 style="margin-top: 10px; margin-bottom: 5px;">Client: ${client}</h5>
                        <ul style="margin-top: 0; margin-bottom: 15px; padding-left: 20px;">
                    `;
                    
                    token.resource_access[client].roles.forEach(role => {
                        html += `<li>${role}</li>`;
                    });
                    
                    html += `</ul>`;
                }
            });
        }
        
        // Scopes
        if (token.scope) {
            html += `
                <h4 style="margin-top: 15px; margin-bottom: 10px;">OAuth Scopes</h4>
                <p>${token.scope.split(' ').join(', ')}</p>
            `;
        }
        
        return html || '<p>No roles or permissions found in the token.</p>';
    }

    /**
     * Format issuer information from token
     */
    formatIssuerInfo(token) {
        if (!token || (!token.iss && !token.aud && !token.azp)) {
            return null;
        }
        
        let html = '<table style="width: 100%; border-collapse: collapse;">';
        
        if (token.iss) {
            html += `
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #dee2e6; font-weight: bold;">Issuer</td>
                    <td style="padding: 8px; border-bottom: 1px solid #dee2e6; word-break: break-all;">${token.iss}</td>
                </tr>
            `;
        }
        
        if (token.aud) {
            const audience = Array.isArray(token.aud) ? token.aud.join(', ') : token.aud;
            html += `
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #dee2e6; font-weight: bold;">Audience</td>
                    <td style="padding: 8px; border-bottom: 1px solid #dee2e6; word-break: break-all;">${audience}</td>
                </tr>
            `;
        }
        
        if (token.azp) {
            html += `
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #dee2e6; font-weight: bold;">Authorized Party</td>
                    <td style="padding: 8px; border-bottom: 1px solid #dee2e6; word-break: break-all;">${token.azp}</td>
                </tr>
            `;
        }
        
        // Add any additional OIDC/OAuth related fields
        const additionalFields = [
            { name: 'typ', label: 'Token Type' },
            { name: 'acr', label: 'Authentication Context Class Reference' },
            { name: 'amr', label: 'Authentication Methods References' },
            { name: 'sid', label: 'Session ID' }
        ];
        
        additionalFields.forEach(field => {
            if (token[field.name]) {
                html += `
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #dee2e6; font-weight: bold;">${field.label}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #dee2e6; word-break: break-all;">${token[field.name]}</td>
                    </tr>
                `;
            }
        });
        
        html += '</table>';
        
        return html;
    }

    /**
     * Format time remaining in a human-readable format
     */
    formatTimeRemaining(ms) {
        if (ms <= 0) return 'Expired';
        
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days}d ${hours % 24}h`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Check for cookie blocking after authentication attempts
     * This should be called after the app initializes to detect Chrome's third-party cookie restrictions
     */
    checkForCookieBlockingAfterAuth() {
        console.log('Checking for third-party cookie blocking...');

        // If we've already detected blocking and shown a warning, don't repeat
        if (sessionStorage.getItem('cookies_already_checked') === 'true') {
            console.log('Cookie check already performed, skipping');
            return false;
        }

        // Check if we previously set a cookie_check cookie
        const hasCookieCheckSet = sessionStorage.getItem('cookie_check_set') === 'true';
        if (!hasCookieCheckSet) {
            console.log('No cookie check was previously attempted, setting test cookie now');
            this.setCookieCheckCookie();
            return false; // We haven't done the cookie check yet
        }

        // Check if the cookie_check cookie exists
        const cookieCheckExists = document.cookie.split(';').some(c => 
            c.trim().startsWith('cookie_check='));
        
        // Mark that we've checked cookies
        sessionStorage.setItem('cookies_already_checked', 'true');
        
        // If sessionStorage has the flag but cookie is missing, cookies are likely being blocked
        if (!cookieCheckExists) {
            console.warn('DETECTED: Third-party cookie blocking is active - cookie check cookie not found after setting it');
            
            // Set flag to show cookie warning
            sessionStorage.setItem('cookies_being_blocked', 'true');
            
            // Show the cookie warning
            this.showCookieWarning();
            
            // Also check if we need to manually retrieve the token
            if (!localStorage.getItem('access_token') && !localStorage.getItem('auth_token')) {
                console.log('No tokens in localStorage with cookie blocking active, trying to use alternate methods');
                this.retrieveTokenFromBackend().then(success => {
                    if (success) {
                        console.log('Successfully retrieved token despite cookie blocking');
                    } else {
                        console.warn('Failed to retrieve token with cookie blocking active');
                    }
                });
            }
            
            return true;
        }
        
        console.log('Cookie check passed - third-party cookies appear to be working correctly');
        return false;
    }

    /**
     * Set a test cookie for third-party cookie detection
     * This adds a specific cookie that we can check later to determine if cookies are being blocked
     */
    setCookieCheckCookie() {
        try {
            // Set a test cookie with appropriate attributes to detect third-party cookie blocking
            const cookieDate = new Date();
            cookieDate.setTime(cookieDate.getTime() + (5 * 60 * 1000)); // 5 minutes
            const expires = "expires=" + cookieDate.toUTCString();
            
            // Try setting cookies with different SameSite attributes to test what works
            document.cookie = "cookie_check=enabled; " + expires + "; path=/; SameSite=Lax";
            document.cookie = "cookie_check_strict=enabled; " + expires + "; path=/; SameSite=Strict";
            document.cookie = "cookie_check_none=enabled; " + expires + "; path=/; SameSite=None; Secure";
            
            console.log('Set test cookies for third-party cookie detection with various SameSite attributes');
            
            // Also set a flag in sessionStorage to compare later (will work even if cookies don't)
            sessionStorage.setItem('cookie_check_set', 'true');
            sessionStorage.setItem('cookie_check_time', Date.now().toString());
        } catch (error) {
            console.error('Error setting cookie detection cookie:', error);
        }
    }

    /**
     * Show an enhanced warning about Chrome's third-party cookie restrictions
     * This provides clear guidance to users about the cookie policy changes
     */
    showCookieWarning() {
        console.log('Displaying Chrome cookie restriction warning');
        
        // Check if notification container exists, create it if not
        let notificationContainer = document.getElementById('cookie-notification-container');
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'cookie-notification-container';
            notificationContainer.style.position = 'fixed';
            notificationContainer.style.top = '20px';
            notificationContainer.style.left = '50%';
            notificationContainer.style.transform = 'translateX(-50%)';
            notificationContainer.style.maxWidth = '600px';
            notificationContainer.style.width = '90%';
            notificationContainer.style.zIndex = '1000';
            document.body.appendChild(notificationContainer);
        }
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'cookie-notification';
        notification.style.backgroundColor = '#fff3cd';
        notification.style.color = '#664d03';
        notification.style.padding = '16px';
        notification.style.marginBottom = '10px';
        notification.style.borderRadius = '6px';
        notification.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
        notification.style.display = 'flex';
        notification.style.flexDirection = 'column';
        notification.style.transition = 'opacity 0.5s ease-in-out';
        notification.style.border = '1px solid #ffecb5';
        
        // Create message content with more specific Chrome information
        const messageContent = document.createElement('div');
        messageContent.innerHTML = `
            <div style="display: flex; align-items: flex-start; margin-bottom: 10px;">
                <div style="margin-right: 10px; font-size: 24px;">⚠️</div>
                <div>
                    <strong>Chrome Third-Party Cookie Restrictions Detected</strong>
                    <p>Chrome is transitioning to a new experience that blocks third-party cookies by default, which affects this application's authentication system.</p>
                    <p>To ensure the application works correctly with your browser settings:</p>
                    <ol style="margin-top: 8px; margin-bottom: 8px; padding-left: 20px;">
                        <li>Allow cookies for this site: Click the "cookie" icon in your address bar and select "Allow cookies"</li>
                        <li>Or click the "Cookie Settings" button below to open Chrome settings</li>
                        <li>The application will use alternative authentication methods when possible</li>
                    </ol>
                    <p style="font-size: 12px; margin-top: 5px;">Note: This is part of Chrome's Privacy Sandbox initiative to phase out third-party cookies.</p>
                </div>
            </div>
        `;
        
        // Create buttons container
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.justifyContent = 'flex-end';
        buttonsContainer.style.gap = '10px';
        buttonsContainer.style.marginTop = '10px';
        
        // Create Cookie Settings button to direct users to Chrome settings
        const settingsButton = document.createElement('button');
        settingsButton.textContent = 'Cookie Settings';
        settingsButton.style.padding = '8px 12px';
        settingsButton.style.backgroundColor = '#fff3cd';
        settingsButton.style.border = '1px solid #ffecb5';
        settingsButton.style.borderRadius = '4px';
        settingsButton.style.color = '#664d03';
        settingsButton.style.fontWeight = 'bold';
        settingsButton.style.cursor = 'pointer';
        
        // Add click handler for settings button
        settingsButton.addEventListener('click', () => {
            // Open Chrome cookie settings
            window.open('chrome://settings/cookies', '_blank');
        });
        
        // Create dismiss button
        const dismissButton = document.createElement('button');
        dismissButton.textContent = 'Dismiss';
        dismissButton.style.padding = '8px 12px';
        dismissButton.style.backgroundColor = '#fff3cd';
        dismissButton.style.border = '1px solid #ffecb5';
        dismissButton.style.borderRadius = '4px';
        dismissButton.style.color = '#664d03';
        dismissButton.style.cursor = 'pointer';
        
        // Add click handler for dismiss button
        dismissButton.addEventListener('click', () => {
            notification.style.opacity = '0';
            setTimeout(() => {
                notification.remove();
                // Remove the container if it's empty
                if (notificationContainer.children.length === 0) {
                    notificationContainer.remove();
                }
            }, 500);
        });
        
        // Add buttons to container
        buttonsContainer.appendChild(settingsButton);
        buttonsContainer.appendChild(dismissButton);
        
        // Add content and buttons to notification
        notification.appendChild(messageContent);
        notification.appendChild(buttonsContainer);
        
        // Add notification to container
        notificationContainer.appendChild(notification);
        
        // Auto-remove after 2 minutes
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                        // Remove the container if it's empty
                        if (notificationContainer.children.length === 0) {
                            notificationContainer.remove();
                        }
                    }
                }, 500);
            }
        }, 120000);
        
        // Store that we've shown the warning
        sessionStorage.setItem('shown_cookie_warning', 'true');
    }

    /**
     * Parse and extract user information from a JWT token
     * @param {string} token - The JWT token to parse
     * @returns {Object} - The decoded token payload
     */
    getUserInfoFromToken(token) {
        if (!token) {
            throw new Error('No token provided');
        }
        
        try {
            // Split the token into parts
            const tokenParts = token.split('.');
            if (tokenParts.length !== 3) {
                throw new Error('Invalid token format (not a JWT)');
            }
            
            // Decode the payload (middle part)
            const base64Url = tokenParts[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
                atob(base64)
                    .split('')
                    .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
            );
            
            // Parse the JSON payload
            const payload = JSON.parse(jsonPayload);
            
            // Return the decoded token payload
            return payload;
        } catch (error) {
            console.error('Error decoding token:', error);
            throw new Error('Failed to decode token: ' + error.message);
        }
    }
}

// Initialize auth manager
export const authManager = new AuthManager();

export default AuthManager;