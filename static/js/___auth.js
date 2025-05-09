/**
 * Authentication Manager for Keycloak integration
 * Handles authentication flow, token management, and user info
 */
class AuthManager {
    constructor() {
        // Token storage keys
        this.accessTokenKey = 'accessToken';
        this.refreshTokenKey = 'refreshToken';
        this.tokenExpiresAtKey = 'tokenExpiresAt';
        this.refreshTimerID = null;
        
        // Keycloak configuration
        this.keycloakConfig = {
            authUrl: 'https://keycloak.sensorsreport.net/realms/sr/protocol/openid-connect/auth',
            tokenUrl: 'https://keycloak.sensorsreport.net/realms/sr/protocol/openid-connect/token',
            logoutUrl: 'https://keycloak.sensorsreport.net/realms/sr/protocol/openid-connect/logout',
            realm: 'sr',
            clientId: 'ContextBroker',
            redirectUri: window.location.origin + window.location.pathname,
            responseType: 'token id_token',
            scope: 'openid profile email'
        };
        
        // Backend API base URL - detect based on current location
        this.backendBaseUrl = this.detectBackendUrl();
        
        // Initialize the component
        this.init();
        
        // Make logout method available globally for direct access if needed
        window.doLogout = () => this.logout();
    }

    /**
     * Detect backend URL based on current window location
     * @returns {string} The detected backend URL
     */
    detectBackendUrl() {
        // Use the same host but with the backend port
        const currentHost = window.location.hostname;
        
        // Check if we're running on localhost
        if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
            return 'http://localhost:5000';
        }
        
        // If running on an IP address, use that IP with the backend port
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(currentHost)) {
            return `http://${currentHost}:5000`;
        }
        
        // Default to the current hostname with the backend port
        return `http://${currentHost}:5000`;
    }

    /**
     * Initialize the authentication component
     */
    init() {
        // Check if already authenticated
        if (!this.isAuthenticated()) {
            // Show login form if not authenticated
            this.showLoginForm();
        } else {
            // Update UI with user info if authenticated
            this.updateUIWithUserInfo();
            
            // Set up token renewal
            this.setupTokenRenewal();
        }
        
        // Set up event listeners
        this.setupEventListeners();
    }

    /**
     * Set up event listeners for auth-related UI elements
     */
    setupEventListeners() {
        // Set up the login form submit event
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLoginFormSubmit();
            });
        }
        
        // Set up the show token button event listener
        const showTokenButton = document.getElementById('showTokenButton');
        if (showTokenButton) {
            showTokenButton.addEventListener('click', () => this.showToken());
        }
        
        // Set up logout button if it exists
        const logoutButton = document.getElementById('logoutButton');
        if (logoutButton) {
            logoutButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }
    }

    /**
     * Handle login form submission
     */
    async handleLoginFormSubmit() {
        const usernameField = document.getElementById('username');
        const passwordField = document.getElementById('password');
        const errorMsgEl = document.getElementById('loginError');
        
        if (!usernameField || !passwordField) {
            console.error('Login form fields not found');
            return;
        }
        
        const username = usernameField.value.trim();
        const password = passwordField.value;
        
        if (!username || !password) {
            this.showLoginError('Please enter both username and password');
            return;
        }
        
        try {
            // Show loading state
            const submitButton = document.getElementById('loginSubmit');
            if (submitButton) {
                submitButton.textContent = 'Logging in...';
                submitButton.disabled = true;
            }
            
            // Clear any previous errors
            if (errorMsgEl) {
                errorMsgEl.style.display = 'none';
                errorMsgEl.textContent = '';
            }
            
            // Perform login request
            const response = await fetch(`${this.backendBaseUrl}/api/auth/direct-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    username,
                    password
                })
            });
            
            // Reset button state
            if (submitButton) {
                submitButton.textContent = 'Login';
                submitButton.disabled = false;
            }
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Login failed: ${response.status} ${errorText}`);
            }
            
            const data = await response.json();
            
            // Store tokens in localStorage for client-side use
            if (data.access_token) {
                localStorage.setItem(this.accessTokenKey, data.access_token);
                
                // Store expiry time
                if (data.expires_in) {
                    localStorage.setItem(this.tokenExpiresAtKey, String(Date.now() + data.expires_in * 1000));
                }
                
                // Store refresh token if available
                if (data.refresh_token) {
                    localStorage.setItem(this.refreshTokenKey, data.refresh_token);
                }
                
                // Store user info
                if (data.user && data.user.tenant) {
                    localStorage.setItem('tenantName', data.user.tenant);
                }
                
                // Hide login form
                this.hideLoginForm();
                
                // Update UI with user info
                this.updateUIWithUserInfo();
                
                // Set up token renewal
                this.setupTokenRenewal();
            } else {
                throw new Error('No access token received');
            }
            
        } catch (error) {
            console.error('Login failed:', error);
            this.showLoginError(error.message || 'Login failed. Please check your credentials and try again.');
        }
    }
    
    /**
     * Show error message in login form
     * @param {string} message - Error message to show
     */
    showLoginError(message) {
        const errorMsgEl = document.getElementById('loginError');
        if (errorMsgEl) {
            errorMsgEl.textContent = message;
            errorMsgEl.style.display = 'block';
        }
    }

    /**
     * Show the login form
     */
    showLoginForm() {
        const loginFormContainer = document.getElementById('loginFormContainer');
        if (loginFormContainer) {
            loginFormContainer.style.display = 'flex';
        }
    }
    
    /**
     * Hide the login form
     */
    hideLoginForm() {
        const loginFormContainer = document.getElementById('loginFormContainer');
        if (loginFormContainer) {
            loginFormContainer.style.display = 'none';
        }
    }

    /**
     * Check if user is authenticated
     * @return {boolean} Whether user is authenticated
     */
    isAuthenticated() {
        const token = localStorage.getItem(this.accessTokenKey);
        const expiresAt = localStorage.getItem(this.tokenExpiresAtKey);
        
        return token && expiresAt && Date.now() < parseInt(expiresAt);
    }

    /**
     * Update UI with user info
     */
    updateUIWithUserInfo() {
        // Get user info from token
        const userInfo = this.getUserInfo();
        
        // Update UI elements
        const userElement = document.getElementById("loginUser");
        const tenantElement = document.getElementById("tenantName");
        
        if (userElement && userInfo.preferred_username) {
            userElement.textContent = `User: ${userInfo.preferred_username}`;
        }
        
        if (tenantElement) {
            tenantElement.textContent = `Tenant: ${localStorage.getItem('tenantName') || 'Default'}`;
        }
    }

    /**
     * Get user info from current token
     * @return {Object} User info
     */
    getUserInfo() {
        return this.getUserInfoFromToken(this.getToken());
    }

    /**
     * Extract user info from JWT token
     * @param {string} token - JWT token
     * @return {Object} User info from token payload
     */
    getUserInfoFromToken(token) {
        if (!token) return {};
        
        try {
            const payload = token.split('.')[1];
            const decodedPayload = atob(payload);
            return JSON.parse(decodedPayload);
        } catch (error) {
            console.error('Error decoding token:', error);
            return {};
        }
    }

    /**
     * Set up token renewal timer
     */
    setupTokenRenewal() {
        // Clear any existing timer
        if (this.refreshTimerID) {
            clearTimeout(this.refreshTimerID);
        }
        
        // Get token expiration time
        const expiresAt = localStorage.getItem(this.tokenExpiresAtKey);
        if (!expiresAt) return;
        
        // Calculate time to renew (1 minute before expiration)
        const expiresAtMs = parseInt(expiresAt);
        const now = Date.now();
        const timeToRenew = Math.max(0, expiresAtMs - now - 60000); // 1 minute buffer
        
        // Schedule token renewal
        this.refreshTimerID = setTimeout(() => {
            this.renewToken();
        }, timeToRenew);
    }

    /**
     * Renew token using refresh token
     */
    async renewToken() {
        const refreshToken = localStorage.getItem(this.refreshTokenKey);
        
        if (!refreshToken) {
            // If no refresh token, show login form
            this.showLoginForm();
            return;
        }
        
        try {
            // Try to use backend refresh endpoint first
            const response = await fetch(`${this.backendBaseUrl}/api/auth/refresh`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.success) {
                    // Setup next renewal (the actual tokens are stored in HTTP-only cookies)
                    this.setupTokenRenewal();
                    return;
                }
            }
            
            // If backend refresh fails, fall back to direct refresh
            await this.directTokenRefresh(refreshToken);
            
        } catch (error) {
            console.error('Error renewing token:', error);
            // If token renewal fails, show login form
            this.showLoginForm();
        }
    }
    
    /**
     * Direct token refresh with Keycloak
     * @param {string} refreshToken - Refresh token to use
     */
    async directTokenRefresh(refreshToken) {
        try {
            const params = new URLSearchParams();
            params.append('grant_type', 'refresh_token');
            params.append('client_id', this.keycloakConfig.clientId);
            params.append('refresh_token', refreshToken);
            
            const response = await fetch(this.keycloakConfig.tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params
            });
            
            if (!response.ok) {
                throw new Error(`Token renewal failed: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Save new tokens
            localStorage.setItem(this.accessTokenKey, data.access_token);
            localStorage.setItem(this.refreshTokenKey, data.refresh_token);
            localStorage.setItem(this.tokenExpiresAtKey, String(Date.now() + data.expires_in * 1000));
            
            // Send token to backend for HTTP-only cookie storage
            await this.sendTokenToBackend(data.access_token);
            
            // Setup next renewal
            this.setupTokenRenewal();
            
        } catch (error) {
            console.error('Direct token refresh failed:', error);
            throw error;
        }
    }

    /**
     * Send token to backend for session creation
     * @param {string} accessToken - Access token
     */
    async sendTokenToBackend(accessToken) {
        try {
            const response = await fetch(`${this.backendBaseUrl}/api/auth/verify-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    access_token: accessToken
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
     * Show token details in a prettified format
     */
    showToken() {
        const token = this.getToken();
        const expiresAt = localStorage.getItem(this.tokenExpiresAtKey);
        const expirationDate = new Date(parseInt(expiresAt || '0'));
        
        if (token) {
            // Parse token payload
            const tokenInfo = this.getUserInfoFromToken(token);
            
            // Create a display object with token information
            const displayObj = {
                token_preview: token.substring(0, 20) + '...',
                expires_at: expirationDate.toLocaleString(),
                user_info: tokenInfo
            };
            
            // Display the token in the jsonDisplay area
            const jsonDisplay = document.getElementById('jsonDisplay');
            if (jsonDisplay) {
                jsonDisplay.value = JSON.stringify(displayObj, null, 2);
            }
        } else {
            // Display error message in the jsonDisplay area
            const jsonDisplay = document.getElementById('jsonDisplay');
            if (jsonDisplay) {
                jsonDisplay.value = JSON.stringify({
                    error: "No token available. Please login.",
                    status: "unauthenticated"
                }, null, 2);
            }
        }
    }

    /**
     * Logout user
     */
    async logout() {
        console.log('Logout method called');
        
        try {
            // Try to call backend logout first
            await fetch(`${this.backendBaseUrl}/api/auth/logout`, {
                method: 'GET',
                credentials: 'include'
            });
        } catch (e) {
            console.warn('Backend logout failed:', e);
        }
        
        // Clear stored tokens
        localStorage.removeItem(this.accessTokenKey);
        localStorage.removeItem(this.refreshTokenKey);
        localStorage.removeItem(this.tokenExpiresAtKey);
        localStorage.removeItem('oauth_state');
        
        // Show login form
        this.showLoginForm();
    }

    /**
     * Get the current access token
     * @return {string|null} Access token or null
     */
    getToken() {
        return localStorage.getItem(this.accessTokenKey);
    }
}

// Initialize auth manager
export const authManager = new AuthManager();

export default AuthManager;
