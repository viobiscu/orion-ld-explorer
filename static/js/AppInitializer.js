import apiClient from './api.js';
import { authManager } from './auth-backend.js';
import dataProductsModule from './dataProducts.js';

/**
 * Main application class to kick off initialization
 */
class AppInitializer {
    constructor() {
        console.log('Initializing app...');
        
        // Initialize tenant and user info from localStorage first
        this.initFromLocalStorage();
        
        // Start auth status check with a slight delay to ensure DOM is fully loaded
        setTimeout(() => {
            this.checkAndInitializeAuth();
        }, 500);
        
        // Add event listener for tenant input changes
        this.setupTenantChangeListener();
        
        // Initialize Data Products module
        this.initializeDataProducts();
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
        
        // Force authManager to check auth status and update UI
        authManager.checkAuthStatus().then(isAuthenticated => {
            console.log('Auth check completed, authenticated:', isAuthenticated);
            
            // Make a direct test request to see if connections work
            this.testApiConnection();
            
            // Initialize entity types loading after authentication check
            setTimeout(() => {
                if (window.loadEntityTypes && isAuthenticated) {
                    console.log('Loading entity types...');
                    window.loadEntityTypes();
                }
            }, 1000);
        });
    }
    
    /**
     * Test the API connection directly
     */
    async testApiConnection() {
        try {
            console.log('Testing direct API connection...');
            
            // First test the proxied connection through our backend
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
            } else {
                console.warn('Proxied API test failed:', await proxiedResponse.text());
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
                } else {
                    console.warn('Data Products API test failed:', await dataProductsResponse.text());
                }
            } catch (dataProductsError) {
                console.warn('Data Products API test failed:', dataProductsError.message);
            }
            
        } catch (error) {
            console.error('API connection test failed:', error);
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