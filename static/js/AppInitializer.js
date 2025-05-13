import apiClient from './api.js';
import { authManager } from './auth-backend.js';
import dataProductsModule from './dataProducts.js';
import { initializeUI } from './ui.js';
import { clearAuthData, clearAllData } from './auth-utils.js';

/**
 * Main application class to kick off initialization
 */
class AppInitializer {
    constructor() {
        console.log('Initializing app...');
        
        // Initialize tenant and user info from localStorage first
        this.initFromLocalStorage();
        
        // Initialize the JSON editor
        this.initializeMainEditor();
        
        // Start auth status check with a slight delay to ensure DOM is fully loaded
        setTimeout(() => {
            this.checkAndInitializeAuth();
        }, 500);
        
        // Add auth state check as part of initialization
        // This ensures we detect third-party cookie issues early
        setTimeout(() => {
            if (authManager) {
                console.log('Checking for cookie blocking after initialization');
                authManager.checkForCookieBlockingAfterAuth();
            }
        }, 2000); // Delay to ensure cookies have time to settle
        
        // Add event listener for tenant input changes
        this.setupTenantChangeListener();
        
        // Initialize Data Products module
        this.initializeDataProducts();
        
        // Initialize UI components
        this.initializeUIComponents();
    }
    
    /**
     * Initialize from localStorage values first if available
     */
    initFromLocalStorage() {
        const tenant = localStorage.getItem('tenantName');
        const tenantInput = document.getElementById('tenantname');
        const tenantName = document.getElementById('tenantName');
        
        if (tenant && tenantInput) {
            console.log('Setting tenant input from localStorage:', tenant);
            tenantInput.value = tenant;
        }
        
        if (tenant && tenantName) {
            console.log('Setting tenant display from localStorage:', tenant);
            tenantName.textContent = `Tenant: ${tenant}`;
        }
    }
    
    /**
     * Initialize the main JSON editor instance
     * This ensures we have a single editor instance used throughout the application
     */
    initializeMainEditor() {
        console.log('Initializing main JSON editor...');
        
        // Check if JsonEditor class is available
        if (typeof JsonEditor !== 'function') {
            console.error('JsonEditor not available. Please reload the page.');
            return;
        }
        
        try {
            // Only create the main editor if it doesn't already exist
            if (!window.mainEditor) {
                // Create the main editor instance
                window.mainEditor = new JsonEditor({
                    containerId: 'mainJsonEditorContainer',
                    initialValue: JSON.stringify({ 
                        message: "Welcome to Orion-LD Explorer",
                        instructions: "Select an operation from the sidebar to get started."
                    }, null, 2),
                    height: 500,
                    resize: true
                });
                
                console.log('Main JSON editor initialized successfully');
            } else {
                console.log('Main JSON editor already exists, skipping initialization');
            }
        } catch (error) {
            console.error('Error initializing main JSON editor:', error);
        }
    }
    
    /**
     * Initialize the Data Products module
     */
    initializeDataProducts() {
        console.log('Initializing Data Products module...');
        // Ensure the dataProductsModule is properly loaded
        if (dataProductsModule) {
            console.log('Data Products module loaded successfully');
        } else {
            console.error('Failed to load Data Products module');
        }
    }
    
    /**
     * Set up listener for tenant input changes
     */
    setupTenantChangeListener() {
        const tenantInput = document.getElementById('tenantname');
        if (tenantInput) {
            tenantInput.addEventListener('change', (event) => {
                const newTenant = event.target.value;
                console.log('Tenant input changed to:', newTenant);
                
                // Update localStorage
                localStorage.setItem('tenantName', newTenant);
                
                // Update display
                const tenantName = document.getElementById('tenantName');
                if (tenantName) {
                    tenantName.textContent = `Tenant: ${newTenant}`;
                }
                
                // Reload entity types with new tenant
                if (window.loadEntityTypes) {
                    console.log('Reloading entity types with new tenant...');
                    window.loadEntityTypes();
                }
            });
        }
    }
    
    /**
     * Check authentication status and initialize app accordingly
     */
    checkAndInitializeAuth() {
        console.log('Checking auth status on app init...');
        
        // Clear any stale logout cookie if we have a valid token
        if (localStorage.getItem('access_token')) {
            console.log('Found token in localStorage, clearing any stale logout cookie');
            document.cookie = "logged_out=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        }
        
        // Update UI based on current auth state
        const loginUser = document.getElementById('loginUser');
        const tenantName = document.getElementById('tenantName');
        const tenantInput = document.getElementById('tenantname');
        
        // First check if localStorage has the auth_token (direct implementation)
        const localToken = localStorage.getItem('auth_token');
        if (localToken) {
            console.log('Found auth_token in localStorage, validating...');
            try {
                // Parse the JWT token to check its validity
                const tokenParts = localToken.split('.');
                if (tokenParts.length === 3) {
                    const base64Url = tokenParts[1];
                    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                    const jsonPayload = decodeURIComponent(
                        atob(base64)
                            .split('')
                            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                            .join('')
                    );
                    
                    const payload = JSON.parse(jsonPayload);
                    const expirationTime = payload.exp * 1000; // Convert to milliseconds
                    
                    // Check if token is expired
                    if (expirationTime > Date.now()) {
                        console.log('Token is valid and not expired');
                        
                        // Extract user info directly from token
                        let username = payload.preferred_username || payload.email || payload.sub || 'Unknown User';
                        
                        // Try to extract tenant from token
                        let tenant = 'Default';
                        
                        // Check all possible field names for tenant
                        if (payload.TenantId) {
                            tenant = Array.isArray(payload.TenantId) ? payload.TenantId[0] : payload.TenantId;
                        } else if (payload.tenant_id) {
                            tenant = payload.tenant_id;
                        } else if (payload.tenantId) {
                            tenant = payload.tenantId;
                        } else if (payload.Tenant) {
                            tenant = payload.Tenant;
                        } else if (payload.tenant) {
                            tenant = payload.tenant;
                        }
                        
                        console.log(`User info from token: ${username}, Tenant: ${tenant}`);
                        
                        // Update UI directly from token data
                        if (loginUser) {
                            loginUser.textContent = `User: ${username}`;
                            console.log('Updated user display from token');
                        }
                        
                        if (tenantName) {
                            tenantName.textContent = `Tenant: ${tenant}`;
                            console.log('Updated tenant display from token');
                        }
                        
                        if (tenantInput) {
                            tenantInput.value = tenant;
                            localStorage.setItem('tenantName', tenant);
                            console.log('Updated tenant input from token');
                        }
                        
                        // Set tenant in localStorage to ensure consistency
                        localStorage.setItem('tenantName', tenant);
                    } else {
                        console.warn('Token is expired, clearing it');
                        localStorage.removeItem('auth_token');
                    }
                } else {
                    console.warn('Invalid token format (not a JWT)');
                }
            } catch (error) {
                console.error('Error parsing token:', error);
            }
        }
        
        // Continue with authManager check as a fallback
        if (loginUser && authManager.userInfo && authManager.userInfo.username) {
            console.log('Setting user display from stored user info:', authManager.userInfo.username);
            loginUser.textContent = `User: ${authManager.userInfo.username}`;
        }
        
        if (tenantName && authManager.tenant) {
            console.log('Setting tenant display from stored tenant:', authManager.tenant);
            tenantName.textContent = `Tenant: ${authManager.tenant}`;
        }
        
        if (tenantInput && authManager.tenant) {
            console.log('Setting tenant input from stored tenant:', authManager.tenant);
            tenantInput.value = authManager.tenant;
        }
        
        // Force authManager to check auth status with the backend
        // and update UI again if needed
        authManager.checkAuthStatus().then(isAuthenticated => {
            console.log('Auth check completed, authenticated:', isAuthenticated);
            
            // If authentication succeeded, ensure UI is updated with latest info
            if (isAuthenticated && authManager.userInfo) {
                console.log('Forcing UI update with latest user info after backend check');
                authManager.updateUIWithUserInfo(true);
                
                // Re-validate token to ensure it's still valid
                const token = localStorage.getItem('auth_token');
                if (token) {
                    // Ensure auth_token is updated in global store for API usage
                    window.authToken = token;
                    console.log('Updated global auth token for API usage');
                }
            }
            
            // Make a direct test request to see if connections work
            this.testApiConnection();
            
            // Initialize entity types loading after authentication check
            setTimeout(() => {
                if (window.loadEntityTypes && isAuthenticated) {
                    console.log('Loading entity types...');
                    window.loadEntityTypes();
                }
            }, 1000);
        }).catch(error => {
            console.error('Auth check failed:', error);
            // Clear potentially bad token data if auth check fails
            if (error.message && error.message.includes('token')) {
                console.warn('Auth error mentions token, clearing stored token data');
                localStorage.removeItem('auth_token');
            }
        });
    }
    
    /**
     * Test the API connection directly
     */
    async testApiConnection() {
        try {
            console.log('Testing direct API connection...');
            let apiStatus = {
                proxy: false,
                direct: false,
                dataProducts: false
            };
            
            // Update the UI with connection status
            this.updateConnectionStatusUI(apiStatus);
            
            // First test the proxied connection through our backend
            try {
                const proxiedResponse = await fetch('/api/ngsi-ld/v1/entities?limit=1&offset=0&local=true', {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'NGSILD-Tenant': localStorage.getItem('tenantName') || 'Default'
                    },
                    credentials: 'include'
                });
                
                console.log('Proxied API test response:', proxiedResponse.status, proxiedResponse.statusText);
                console.log('Proxied API response headers:');
                proxiedResponse.headers.forEach((value, key) => {
                    console.log(`  ${key}: ${value}`);
                });
                
                if (proxiedResponse.ok) {
                    const data = await proxiedResponse.json();
                    console.log('Proxied API test successful, data:', data);
                    apiStatus.proxy = true;
                } else {
                    console.warn('Proxied API test failed:', await proxiedResponse.text());
                }
            } catch (proxyError) {
                console.warn('Proxied API test failed:', proxyError.message);
            }
            
            // Now try a direct connection (will likely fail due to CORS but useful for diagnosis)
            try {
                console.log('Testing direct API connection to Orion-LD...');
                const directResponse = await fetch('http://orion.sensorsreport.net:31026/ngsi-ld/v1/entities?limit=1&offset=0&local=true', {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'NGSILD-Tenant': localStorage.getItem('tenantName') || 'Default'
                    },
                    mode: 'cors' // This will likely fail due to CORS, but we're testing it anyway
                });
                
                console.log('Direct API test response:', directResponse.status, directResponse.statusText);
                apiStatus.direct = true;
            } catch (directError) {
                console.warn('Direct API test failed (expected due to CORS):', directError.message);
            }
            
            // Test Data Products API connection
            try {
                console.log('Testing Data Products API connection...');
                const dataProductsResponse = await fetch('http://localhost:8000/api/data-products?limit=1', {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    },
                    credentials: 'include'
                });
                
                console.log('Data Products API test response:', dataProductsResponse.status, dataProductsResponse.statusText);
                
                if (dataProductsResponse.ok) {
                    const data = await dataProductsResponse.json();
                    console.log('Data Products API test successful, data:', data);
                    apiStatus.dataProducts = true;
                } else {
                    console.warn('Data Products API test failed:', await dataProductsResponse.text());
                }
            } catch (dataProductsError) {
                console.warn('Data Products API test failed:', dataProductsError.message);
            }
            
            // Update the UI with final connection status
            this.updateConnectionStatusUI(apiStatus);
            
        } catch (error) {
            console.error('API connection test failed:', error);
        }
    }
    
    /**
     * Update the UI with connection status
     */
    updateConnectionStatusUI(apiStatus) {
        // Get or create the status container
        let statusContainer = document.getElementById('api-status-container');
        if (!statusContainer) {
            statusContainer = document.createElement('div');
            statusContainer.id = 'api-status-container';
            statusContainer.style.position = 'fixed';
            statusContainer.style.bottom = '10px';
            statusContainer.style.right = '10px';
            statusContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            statusContainer.style.color = 'white';
            statusContainer.style.padding = '10px';
            statusContainer.style.borderRadius = '5px';
            statusContainer.style.fontSize = '12px';
            statusContainer.style.zIndex = '1000';
            statusContainer.style.display = 'flex';
            statusContainer.style.flexDirection = 'column';
            statusContainer.style.gap = '5px';
            document.body.appendChild(statusContainer);
        }
        
        // Create the status indicators
        statusContainer.innerHTML = `
            <div>API Status:</div>
            <div>
                <span style="color: ${apiStatus.proxy ? '#4CAF50' : '#F44336'}">●</span> 
                Proxy API: ${apiStatus.proxy ? 'Connected' : 'Disconnected'}
            </div>
            <div>
                <span style="color: ${apiStatus.direct ? '#4CAF50' : '#F44336'}">●</span> 
                Direct API: ${apiStatus.direct ? 'Connected' : 'Disconnected'}
            </div>
            <div>
                <span style="color: ${apiStatus.dataProducts ? '#4CAF50' : '#F44336'}">●</span> 
                Data Products: ${apiStatus.dataProducts ? 'Connected' : 'Disconnected'}
            </div>
            <div style="font-size: 10px; margin-top: 5px;">
                <span style="color: ${apiStatus.proxy ? '#4CAF50' : '#F44336'}">
                    ${apiStatus.proxy ? 'Your application is working as expected.' : 'Problem with proxy API connection!'}
                </span>
            </div>
        `;
        
        // Add a close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'X';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '5px';
        closeButton.style.right = '5px';
        closeButton.style.backgroundColor = 'transparent';
        closeButton.style.border = 'none';
        closeButton.style.color = 'white';
        closeButton.style.cursor = 'pointer';
        closeButton.onclick = () => {
            statusContainer.style.display = 'none';
        };
        statusContainer.appendChild(closeButton);
    }
    
    /**
     * Initialize UI components and set up clear buttons
     */
    initializeUIComponents() {
        initializeUI();
        
        // Only set up clear buttons if they haven't been set up already
        const clearAuthButton = document.getElementById('clearAuthButton');
        if (clearAuthButton && !clearAuthButton.hasListener) {
            console.debug('Setting up Clear Auth button from AppInitializer');
            clearAuthButton.addEventListener('click', clearAuthData);
            clearAuthButton.hasListener = true;
        }
        
        const clearAllButton = document.getElementById('clearAllButton');
        if (clearAllButton && !clearAllButton.hasListener) {
            console.debug('Setting up Clear All button from AppInitializer');
            clearAllButton.addEventListener('click', clearAllData);
            clearAllButton.hasListener = true;
        }
    }
}

// Create and export app initializer
const appInitializer = new AppInitializer();

// Make functions available globally
window.setTenant = function(tenant) {
    const tenantInput = document.getElementById('tenantname');
    if (tenantInput) {
        tenantInput.value = tenant;
        // Trigger the change event
        const event = new Event('change');
        tenantInput.dispatchEvent(event);
    }
};

export default appInitializer;