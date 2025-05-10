/**
 * API client for interacting with the Orion-LD Context Broker
 */
// Use try-catch to handle module import failures
let ErrorBoundary, errorBoundary, store, authManager;

try {
    // Import with relative paths
    import('./ErrorBoundary.js').then(module => {
        ErrorBoundary = module.default;
        errorBoundary = module.errorBoundary;
    }).catch(error => {
        console.error('Failed to load ErrorBoundary module:', error);
        // Provide fallback implementation
        ErrorBoundary = class ErrorBoundary {
            constructor() { this.errors = []; }
            wrap(fn) { return async (...args) => { try { return await fn(...args); } catch (e) { console.error(e); throw e; } }; }
            addError(error) { console.error('API Error:', error); }
            clearErrors() {}
            getErrors() { return []; }
        };
        errorBoundary = new ErrorBoundary();
    });

    import('./state/store.js').then(module => {
        store = module.store;
    }).catch(error => {
        console.error('Failed to load store module:', error);
        // Provide fallback implementation
        store = {
            setLoading: (loading) => console.log('Store: setLoading', loading),
            setError: (error) => console.error('Store error:', error),
            getState: () => ({ loading: false, error: null, data: null })
        };
    });

    import('./auth-backend.js').then(module => {
        authManager = module.authManager;
    }).catch(error => {
        console.error('Failed to load auth module:', error);
        // Provide fallback implementation
        authManager = {
            getToken: () => null,
            isAuthenticated: () => false,
            login: () => console.log('Auth: login called')
        };
    });
} catch (e) {
    console.error('Module import error:', e);
    // Ensure fallback implementations are created even if the entire try block fails
    if (!ErrorBoundary) {
        ErrorBoundary = class ErrorBoundary {
            constructor() { this.errors = []; }
            wrap(fn) { return async (...args) => { try { return await fn(...args); } catch (e) { console.error(e); throw e; } }; }
            addError(error) { console.error('API Error:', error); }
            clearErrors() {}
            getErrors() { return []; }
        };
        errorBoundary = new ErrorBoundary();
    }
    
    if (!store) {
        store = {
            setLoading: (loading) => console.log('Store: setLoading', loading),
            setError: (error) => console.error('Store error:', error),
            getState: () => ({ loading: false, error: null, data: null })
        };
    }
    
    if (!authManager) {
        authManager = {
            getToken: () => null,
            isAuthenticated: () => false,
            login: () => console.log('Auth: login called')
        };
    }
}

// JSON output utility function using window.mainEditor for consistency
function displayJSON(data) {
    // Check if the main editor is available
    if (window.mainEditor && typeof window.mainEditor.setValue === 'function') {
        try {
            // Use the main editor to display the JSON data
            window.mainEditor.setValue(JSON.stringify(data, null, 2));
            console.log('Updated main editor with JSON data');
        } catch (error) {
            console.error('Error updating main editor:', error);
            fallbackDisplayJSON(data);
        }
    } else {
        console.warn('Main JSON editor not available, using fallback display method');
        fallbackDisplayJSON(data);
    }
}

// Fallback display method if main editor is not available
function fallbackDisplayJSON(data) {
    const displayArea = document.getElementById('displayArea');
    if (displayArea) {
        // Create or get the pre element with code block
        let preElement = document.getElementById('jsonDisplay');
        if (!preElement || preElement.tagName !== 'PRE') {
            const oldElement = preElement;
            preElement = document.createElement('pre');
            preElement.id = 'jsonDisplay';
            const codeElement = document.createElement('code');
            codeElement.className = 'language-json hljs-custom';
            preElement.appendChild(codeElement);
            if (oldElement) {
                oldElement.parentNode.replaceChild(preElement, oldElement);
            } else {
                displayArea.appendChild(preElement);
            }
        }

        // Format and display the JSON
        const formattedJson = JSON.stringify(data, null, 2);
        const codeElement = preElement.querySelector('code');
        codeElement.textContent = formattedJson;
        
        // Apply syntax highlighting in a safer way
        if (hljs) {
            try {
                const result = hljs.highlight(formattedJson, {
                    language: 'json',
                    ignoreIllegals: true
                });
                codeElement.innerHTML = result.value;
                codeElement.classList.add('hljs-custom');
            } catch (error) {
                console.error('Error applying syntax highlighting:', error);
                codeElement.textContent = formattedJson;
            }
        }
    } else {
        console.error('No display element found for JSON output');
    }
}

export function appendToLogs(message) {
    const logsContainer = document.getElementById('request-logs');
    if (!logsContainer) return;
    
    const logElement = document.createElement('p');
    logElement.className = 'log-item';
    
    // Consistent date formatting for logs
    const timestamp = new Date().toLocaleTimeString();
    logElement.textContent = `[${timestamp}] ${message}`;
    
    // Prepend to show newest logs at the top
    logsContainer.insertBefore(logElement, logsContainer.firstChild);
    
    // Remove placeholder if present
    const placeholder = logsContainer.querySelector('.log-placeholder');
    if (placeholder) {
        placeholder.remove();
    }
}

/**
 * Main client for Orion-LD Context Broker
 */
class OrionLDClient {
    constructor(baseURL = null, contextURL = null) {
        // Use the local backend to proxy requests instead of direct connection
        // This solves CORS issues by routing through our backend
        this.backendBaseUrl = window.location.origin;
        
        // Set base URL with fallback to proxy path
        this.baseURL = baseURL || `${this.backendBaseUrl}/api/ngsi-ld/v1`;
        
        // Set context URL with fallback
        this.context = contextURL || '/context/synchro-context.jsonld';
        
        // Set default headers
        this.headers = {
            "Content-Type": "application/ld+json",
            "Accept": "application/json",
            // Add cache control to prevent caching issues with auth
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache"
        };
        
        // Add Authorization header if token is available (for APIs that need it)
        const token = localStorage.getItem('auth_token') || localStorage.getItem('access_token');
        if (token) {
            this.headers['Authorization'] = `Bearer ${token}`;
            console.log('Added Authorization header with token');
        } else {
            console.log('No token available for Authorization header');
        }
        
        // Add tenant header if available and not "default" or "Synchro"
        const tenantInputValue = document.getElementById('tenantname')?.value;
        const tenantName = tenantInputValue || localStorage.getItem('tenantName');
        
        // Only add NGSILD-Tenant header if it's not "default" or "Synchro"
        if (tenantName && tenantName.toLowerCase() !== "default" && tenantName !== "Synchro") {
            this.headers['NGSILD-Tenant'] = tenantName;
            console.log(`Setting NGSILD-Tenant header to: ${tenantName}`);
        } else {
            console.log(`Not sending NGSILD-Tenant header for tenant: ${tenantName || 'none'}`);
        }
        
        console.log("OrionLDClient initialized with headers:", this.headers);
        console.log("Using base URL:", this.baseURL);
    }

    // Core request method
    async makeRequest(endpoint, method, body = null) {
        // Safely access store with fallback if it's not initialized yet
        if (store) {
            store.setLoading(true);
            store.setError(null);
        } else {
            console.log('Store not initialized yet, skipping loading state update');
        }

        try {
            console.log(`Making ${method} request to: ${endpoint}`);
            console.log("Request headers:", this.headers);
            
            appendToLogs(`Request: ${method} ${endpoint}`);
            
            if (body) {
                console.log("Request body:", body);
                appendToLogs(`Request body: ${JSON.stringify(body).substring(0, 100)}${JSON.stringify(body).length > 100 ? '...' : ''}`);
            }

            // Before making the request, check if we need to refresh the token from localStorage
            this.refreshHeadersFromLocalStorage();
            
            const response = await fetch(endpoint, {
                method,
                headers: this.headers,
                body: body ? JSON.stringify(body) : null,
                credentials: 'include', // Include cookies for auth with SameSite=Lax settings
                cache: 'no-store' // Prevent caching to avoid stale auth state
            });
            
            console.log(`Response status: ${response.status} ${response.statusText}`);
            
            // Log response headers for debugging
            console.log("Response headers:");
            response.headers.forEach((value, key) => {
                console.log(`  ${key}: ${value}`);
            });
            
            appendToLogs(`Response: ${response.status} ${response.statusText}`);
            
            // Handle 401 Unauthorized
            if (response.status === 401) {
                appendToLogs('Authentication error, trying to refresh token');
                
                try {
                    const refreshResponse = await fetch('/api/auth/refresh', {
                        credentials: 'include',
                        cache: 'no-store',
                        headers: {
                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                            'Pragma': 'no-cache'
                        }
                    });
                    
                    if (refreshResponse.ok) {
                        // Try to get the new token from the response
                        try {
                            const refreshData = await refreshResponse.json();
                            if (refreshData.access_token) {
                                // Store the refreshed token
                                localStorage.setItem('access_token', refreshData.access_token);
                                localStorage.setItem('auth_token', refreshData.access_token);
                                
                                // Update Authorization header
                                this.headers['Authorization'] = `Bearer ${refreshData.access_token}`;
                            }
                        } catch (e) {
                            console.log('Token refresh succeeded but did not return a new token');
                        }
                        
                        appendToLogs('Token refreshed, retrying request');
                        return this.makeRequest(endpoint, method, body);
                    } else {
                        appendToLogs('Token refresh failed, redirecting to login');
                        if (authManager && typeof authManager.login === 'function') {
                            authManager.login();
                        }
                        throw new Error('Authentication failed. Please log in again.');
                    }
                } catch (refreshError) {
                    appendToLogs(`Token refresh error: ${refreshError.message}`);
                    if (authManager && typeof authManager.login === 'function') {
                        authManager.login();
                    }
                    throw new Error('Authentication failed. Please log in again.');
                }
            }

            // Read the response body text once
            const responseText = await response.text();
            
            // Handle empty responses
            if (!responseText.trim()) {
                if (response.ok) {
                    // Some successful operations (like DELETE) may return empty responses
                    console.log("Empty response received with successful status code");
                    appendToLogs("Operation completed successfully (empty response)");
                    if (store) store.setLoading(false);
                    return { status: 'success', message: 'Operation completed successfully' };
                } else {
                    // Empty error response
                    const errorMessage = `Server responded with status ${response.status} (empty response)`;
                    console.error(errorMessage);
                    appendToLogs(`Error: ${errorMessage}`);
                    this.showErrorMessage(errorMessage);
                    throw new Error(errorMessage);
                }
            }

            // Handle error responses
            if (!response.ok) {
                try {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        try {
                            const errorData = JSON.parse(responseText);
                            console.log("Error response data:", errorData);
                            appendToLogs(`Error data: ${JSON.stringify(errorData)}`);
                            this.showErrorMessage(`Request failed: ${response.status} ${response.statusText}`);
                            return errorData;
                        } catch (parseError) {
                            console.error("Failed to parse error response as JSON:", parseError);
                        }
                    }
                    
                    console.log(`Error response text: ${responseText.substring(0, 500)}`);
                    appendToLogs(`Error: Non-JSON response. Status: ${response.status}. Text: ${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}`);
                    this.showErrorMessage(`Server error (${response.status}): ${responseText.substring(0, 100) || 'No response details'}`);
                    throw new Error(`Server responded with status ${response.status}: ${responseText.substring(0, 100) || 'Non-JSON response'}`);
                } catch (parseError) {
                    console.error("Parse error:", parseError);
                    appendToLogs(`Parse error: ${parseError.message}`);
                    this.showErrorMessage(`Error processing response: ${parseError.message}`);
                    throw new Error(`Server responded with status ${response.status}: ${parseError.message}`);
                }
            }

            // Try to parse the response as JSON
            try {
                const data = JSON.parse(responseText);
                console.log("Response data:", data);
                if (store) store.setLoading(false);
                return data;
            } catch (parseError) {
                // If response is not valid JSON, log the actual response content for debugging
                console.error("Failed to parse JSON response. Response content:", responseText);
                appendToLogs(`Error: Failed to parse JSON. Response: ${responseText.substring(0, 100)}...`);
                this.showErrorMessage(`Failed to parse server response. The response was not valid JSON. Check the console for details.`);
                throw new Error(`Failed to parse JSON response: The server returned invalid JSON data`);
            }
        } catch (error) {
            const errorMessage = error.message || 'Unknown error';
            console.error("Request error:", errorMessage);
            
            const isNetworkError = errorMessage.includes('NetworkError') || 
                               errorMessage.includes('Failed to fetch') ||
                               errorMessage.includes('Network request failed') ||
                               errorMessage.includes('Cross-Origin Request Blocked');
            
            if (isNetworkError) {
                appendToLogs(`Network error accessing ${endpoint}: ${errorMessage}`);
                if (store) store.setError(`Network error: Unable to connect to the server. Check your connection and CORS settings.`);
                this.showErrorMessage(`Network error: Unable to connect to the server. The service may be unavailable or there might be a connectivity issue.`);
            } else {
                appendToLogs(`Error in request: ${errorMessage}`);
                if (store) store.setError(errorMessage);
                this.showErrorMessage(`Error: ${errorMessage}`);
            }
            
            return { error: errorMessage, status: 'error' };
        } finally {
            if (store) store.setLoading(false);
        }
    }
    
    // Helper method to refresh headers from localStorage
    refreshHeadersFromLocalStorage() {
        // Update Authorization header if token is available
        const token = localStorage.getItem('auth_token') || localStorage.getItem('access_token');
        if (token) {
            this.headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Update tenant header if needed
        const tenantInputValue = document.getElementById('tenantname')?.value;
        const tenantName = tenantInputValue || localStorage.getItem('tenantName');
        
        if (tenantName && tenantName.toLowerCase() !== "default" && tenantName !== "Synchro") {
            this.headers['NGSILD-Tenant'] = tenantName;
        } else if (this.headers['NGSILD-Tenant']) {
            delete this.headers['NGSILD-Tenant'];
        }
    }
    
    // Helper method to show error messages in the UI
    showErrorMessage(message) {
        // Always use the main editor for displaying error information with timestamp
        if (window.mainEditor && typeof window.mainEditor.setValue === 'function') {
            window.mainEditor.setValue(JSON.stringify({
                error: message,
                timestamp: new Date().toISOString(),
                hint: "Check browser console (F12) for more details"
            }, null, 2));
            
            // Also log the error in the request logs
            appendToLogs(`Error: ${message}`);
        } else {
            // Fallback display methods if main editor is not available
            const jsonDisplay = document.getElementById('jsonDisplay');
            if (jsonDisplay) {
                jsonDisplay.value = JSON.stringify({
                    error: message,
                    timestamp: new Date().toISOString(),
                    hint: "Check browser console (F12) for more details"
                }, null, 2);
            }
            
            // Also try to display in the fallbackUI element if available
            const fallbackUI = document.getElementById('fallbackUI');
            if (fallbackUI) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'network-error';
                errorDiv.innerHTML = `<strong>Error:</strong> ${message}<br><small>Check browser console (F12) for technical details.</small>`;
                
                // Clear previous error messages
                fallbackUI.innerHTML = '';
                fallbackUI.appendChild(errorDiv);
                
                // Auto-remove after 15 seconds
                setTimeout(() => {
                    if (fallbackUI.contains(errorDiv)) {
                        errorDiv.remove();
                    }
                }, 15000);
            }
            
            // Make sure it also appears in logs
            appendToLogs(`Error: ${message}`);
        }
    }

    // Entity operations
    async createEntity(entity) {
        const endpoint = `${this.baseURL}/entities`;
        return await this.makeRequest(endpoint, "POST", entity);
    }

    async getEntity(entityId) {
        const endpoint = `${this.baseURL}/entities/${encodeURIComponent(entityId)}`;
        return await this.makeRequest(endpoint, "GET");
    }

    async getAttribute(entityId, attributeName) {
        // Use query parameter approach instead of direct attribute endpoint
        const endpoint = `${this.baseURL}/entities/${encodeURIComponent(entityId)}?attrs=${encodeURIComponent(attributeName)}`;
        
        // Save current headers
        const originalHeaders = { ...this.headers };
        
        // Update headers for NGSI-LD context
        this.headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Link': '<https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
        };
        
        try {
            const response = await this.makeRequest(endpoint, "GET");
            // Extract just the attribute data from the response
            return response[attributeName];
        } finally {
            // Restore original headers
            this.headers = originalHeaders;
        }
    }

    async updateAttribute(entityId, attributeName, attributeValue) {
        // Use query parameter approach for attribute updates
        const endpoint = `${this.baseURL}/entities/${encodeURIComponent(entityId)}`;
        
        // Save current headers
        const originalHeaders = { ...this.headers };
        
        // Update headers for NGSI-LD context
        this.headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Link': '<https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
        };
        
        try {
            // Create a patch object that only updates the specified attribute
            const patchData = {
                [attributeName]: attributeValue
            };
            return await this.makeRequest(endpoint, "PATCH", patchData);
        } finally {
            // Restore original headers
            this.headers = originalHeaders;
        }
    }

    async replaceEntity(entityId, entity) {
        return errorBoundary.wrap(async () => {
            const endpoint = `${this.baseURL}/entities/${encodeURIComponent(entityId)}`;
            return await this.makeRequest(endpoint, "PUT", entity);
        });
    }

    async updateEntity(entityId, attributes) {
        // If it's a single attribute update, use the attribute-specific endpoint
        if (Object.keys(attributes).length === 1) {
            const [attributeName] = Object.keys(attributes);
            return await this.updateAttribute(entityId, attributeName, attributes[attributeName]);
        }
        
        // Otherwise update all attributes
        const endpoint = `${this.baseURL}/entities/${encodeURIComponent(entityId)}`;
        return await this.makeRequest(endpoint, "PATCH", attributes);
    }

    async deleteEntity(entityId) {
        const endpoint = `${this.baseURL}/entities/${encodeURIComponent(entityId)}`;
        return await this.makeRequest(endpoint, "DELETE");
    }

    async deleteAttribute(entityId, attributeName) {
        const endpoint = `${this.baseURL}/entities/${encodeURIComponent(entityId)}/attrs/${encodeURIComponent(attributeName)}`;
        return await this.makeRequest(endpoint, "DELETE");
    }

    // Batch operations
    async batchCreate(entities) {
        return errorBoundary.wrap(async () => {
            const endpoint = `${this.baseURL}/entityOperations/create`;
            return await this.makeRequest(endpoint, "POST", entities);
        });
    }

    async batchUpsert(entities) {
        return errorBoundary.wrap(async () => {
            const endpoint = `${this.baseURL}/entityOperations/upsert`;
            return await this.makeRequest(endpoint, "POST", entities);
        });
    }

    async batchDelete(entityIds) {
        return errorBoundary.wrap(async () => {
            const endpoint = `${this.baseURL}/entityOperations/delete`;
            return await this.makeRequest(endpoint, "POST", entityIds);
        });
    }
}

/**
 * Extended client with search capabilities
 */
export class OrionLDSearchClient extends OrionLDClient {
    constructor(baseURL = null, contextURL = null, pageSize = 100) {
        super(baseURL, contextURL);
        this.pageSize = pageSize;
    }

    async getAllEntities(limit = this.pageSize, offset = 0) {
        // Add local=true parameter as the NGSI-LD broker requires at least one filter
        const endpoint = `${this.baseURL}/entities?limit=${limit}&offset=${offset}&local=true`;
        return await this.makeRequest(endpoint, "GET");
    }

    async getEntitiesByType(type, limit = this.pageSize, offset = 0) {
        const endpoint = `${this.baseURL}/entities?type=${encodeURIComponent(type)}&limit=${limit}&offset=${offset}&local=true`;
        return await this.makeRequest(endpoint, "GET");
    }

    async getSubscriptions() {
        const endpoint = `${this.baseURL}/subscriptions`;
        return await this.makeRequest(endpoint, "GET");
    }

    async getAllTypes() {
        try {
            const allEntities = await this.fetchAllEntitiesWithPagination();
            const types = new Set();
            allEntities.forEach(entity => {
                if (entity.type) types.add(entity.type);
            });
            return Array.from(types);
        } catch (error) {
            appendToLogs(`Error fetching entity types: ${error.message}`);
            throw error;
        }
    }

    async getAllAttributes() {
        try {
            const allEntities = await this.fetchAllEntitiesWithPagination();
            const attributes = new Set();
            allEntities.forEach(entity => {
                Object.keys(entity).forEach(key => {
                    if (key !== 'id' && key !== 'type' && !key.startsWith('@')) {
                        attributes.add(key);
                    }
                });
            });
            return Array.from(attributes);
        } catch (error) {
            appendToLogs(`Error fetching attributes: ${error.message}`);
            throw error;
        }
    }

    async getAllRelationships() {
        try {
            const allEntities = await this.fetchAllEntitiesWithPagination();
            const relationships = new Set();
            allEntities.forEach(entity => {
                Object.entries(entity).forEach(([key, value]) => {
                    if (typeof value === 'object' && value !== null &&
                        (value.object || value.type === 'Relationship' ||
                        (Array.isArray(value) && value.some(item => item.object)))) {
                        relationships.add(key);
                    }
                });
            });
            return Array.from(relationships);
        } catch (error) {
            appendToLogs(`Error fetching relationships: ${error.message}`);
            throw error;
        }
    }

    async fetchAllEntitiesWithPagination() {
        const allEntities = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
            const response = await this.getAllEntities(this.pageSize, offset);
            if (Array.isArray(response) && response.length > 0) {
                allEntities.push(...response);
                offset += response.length;
                hasMore = response.length >= this.pageSize;
            } else {
                hasMore = false;
            }
        }
        return allEntities;
    }

    async getAllEntityInformation() {
        try {
            if (store) store.setLoading(true);
            const [types, attributes, subscriptions, relationships] = await Promise.all([
                this.getAllTypes(),
                this.getAllAttributes(),
                this.getSubscriptions(),
                this.getAllRelationships()
            ]);
            return { types, attributes, subscriptions, relationships };
        } catch (error) {
            appendToLogs(`Error fetching entity information: ${error.message}`);
            throw error;
        } finally {
            if (store) store.setLoading(false);
        }
    }
}

/**
 * User-facing API functions for UI integration
 */
// GET data with user prompt
export async function processGetData(endpoint, defaultId) {
    try {
        let entityId = prompt('Enter the Entity ID:', localStorage.getItem('GetEntityID') || defaultId);
        if (!entityId) return;

        // Store the entity ID for future use
        if (entityId !== defaultId) {
            localStorage.setItem('GetEntityID', entityId);
        }

        const client = new OrionLDClient();
        let data;

        // Check if we're getting an attribute
        if (endpoint.includes('attributes')) {
            const attributeName = prompt('Enter the Attribute Name:');
            if (!attributeName) return;

            data = await client.getAttribute(entityId, attributeName);
            appendToLogs(`Successfully retrieved attribute "${attributeName}" from entity ${entityId}`);
        } else {
            data = await client.getEntity(entityId);
            appendToLogs(`Successfully retrieved entity ${entityId}`);
        }

        // Use the main JSON editor to display results if available
        if (window.mainEditor) {
            window.mainEditor.setValue(JSON.stringify(data, null, 2));
            console.log('Updated main editor with GET response data');
        } else {
            // Fallback to displayJSON if mainEditor is not available
            displayJSON(data);
            console.warn('mainEditor not available, using fallback displayJSON function');
        }
    } catch (error) {
        console.error('Error:', error);
        appendToLogs(`Error: ${error.message}`);
        
        // Display error in main editor if available
        if (window.mainEditor) {
            window.mainEditor.setValue(JSON.stringify({
                error: error.message,
                timestamp: new Date().toISOString()
            }, null, 2));
        }
    }
}

// DELETE data with user prompt
export async function processDeleteData(endpoint, defaultId) {
    try {
        let entityId = prompt('Enter the Entity ID:', localStorage.getItem('DeleteEntityID') || defaultId);
        if (!entityId) return;

        // Store the entity ID for future use
        if (entityId !== defaultId) {
            localStorage.setItem('DeleteEntityID', entityId);
        }

        const client = new OrionLDClient();
        let data;

        // Check if we're deleting an attribute
        if (endpoint.includes('attributes')) {
            const attributeName = prompt('Enter the Attribute Name:');
            if (!attributeName) return;

            data = await client.deleteAttribute(entityId, attributeName);
            appendToLogs(`Successfully deleted attribute "${attributeName}" from entity ${entityId}`);
        } else {
            data = await client.deleteEntity(entityId);
            appendToLogs(`Successfully deleted entity ${entityId}`);
        }

        displayJSON(data);
    } catch (error) {
        console.error('Error:', error);
        appendToLogs(`Error: ${error.message}`);
    }
}

// POST data from form
export async function processPostQuery(dataPost) {
    try {
        const client = new OrionLDClient();
        const dataJson = JSON.parse(dataPost);
        const data = await client.createEntity(dataJson);
        displayJSON(data);
        appendToLogs(`Successfully created entity with ID: ${dataJson.id}`);
    } catch (error) {
        console.error('Error:', error);
        appendToLogs(`Error: ${error.message}`);
    }
}

// PATCH or PUT data
export async function handlePatchQuery(endpoint, jsonData) {
    try {
        // Always save the entity ID when attempting a PATCH
        localStorage.setItem('entityPatchInputText', endpoint);
        localStorage.setItem('jsonDisplay', jsonData);

        const client = new OrionLDClient();
        let data;
        const entityData = JSON.parse(jsonData);
        let entityId = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;

        if (entityData.type && entityData.id) {
            data = await client.replaceEntity(entityId, entityData);
            appendToLogs(`Successfully processed PUT request for ${entityId}`);
        } else {
            data = await client.updateEntity(entityId, entityData);
            appendToLogs(`Successfully processed PATCH request for ${entityId}`);
        }

        displayJSON(data);
    } catch (error) {
        console.error('Error:', error);
        appendToLogs(`Error: ${error.message}`);
    }
}

// Search all entities
export async function searchEntities() {
    try {
        const searchClient = new OrionLDSearchClient();
        const data = await searchClient.getAllEntityInformation();
        displayJSON(data);
        appendToLogs('Successfully retrieved entity information');
        return data;
    } catch (error) {
        console.error('Error:', error);
        appendToLogs(`Error: ${error.message}`);
    }
}

// Load entity types into UI
export async function loadEntityTypes() {
    try {
        const searchClient = new OrionLDSearchClient();
        const types = await searchClient.getAllTypes();
        const typesList = document.getElementById('entity-types-list');
        
        if (typesList) {
            typesList.innerHTML = '';
            types.forEach(type => {
                const listItem = document.createElement('li');
                const icon = document.createElement('i');
                icon.className = 'fa-regular fa-file custom-icon';
                const span = document.createElement('span');
                span.textContent = type;
                const button = document.createElement('button');
                button.className = 'method-button get-button';
                button.textContent = 'GET';
                // Direct call to filterEntitiesByType without parameters
                button.onclick = () => filterEntitiesByType(type);
                
                listItem.appendChild(icon);
                listItem.appendChild(span);
                listItem.appendChild(button);
                typesList.appendChild(listItem);
            });
            
            appendToLogs(`Loaded ${types.length} entity types`);
        }
    } catch (error) {
        console.error('Error loading entity types:', error);
        appendToLogs(`Error loading entity types: ${error.message}`);
    }
}

// Filter entities by type
export async function filterEntitiesByType(type) {
    try {
        console.log(`filterEntitiesByType called in api.js with type: ${type}`);
        const searchClient = new OrionLDSearchClient();
        const entities = await searchClient.getEntitiesByType(type);
        
        // Make sure we're using the correct display method with a more explicit approach
        if (window.mainEditor && typeof window.mainEditor.setValue === 'function') {
            // First convert to string with proper formatting
            const jsonString = JSON.stringify(entities, null, 2);
            // Then set the value in the editor
            window.mainEditor.setValue(jsonString);
            console.log(`Successfully displayed ${entities.length} entities of type "${type}" in mainEditor`);
        } else {
            // Fallback to the utility function if mainEditor is not available
            displayJSON(entities);
            console.warn('mainEditor not available in filterEntitiesByType, using fallback displayJSON');
        }
        
        // Also update the entity GET results editor if it exists (for consistency)
        if (window.getResultsEditor && typeof window.getResultsEditor.setValue === 'function') {
            window.getResultsEditor.setValue(JSON.stringify(entities, null, 2));
            console.log('Updated getResultsEditor with entity data');
        }
        
        appendToLogs(`Retrieved ${entities.length} entities of type "${type}"`);
        return entities;
    } catch (error) {
        console.error('Error fetching entities by type:', error);
        appendToLogs(`Error: ${error.message}`);
        
        // Display error in editor
        if (window.mainEditor) {
            window.mainEditor.setValue(JSON.stringify({
                error: error.message,
                timestamp: new Date().toISOString(),
                entityType: type
            }, null, 2));
        }
        
        throw error;
    }
}

// Expose utility functions for global use
if (typeof window !== 'undefined') {
    window.processGetData = processGetData;
    window.processDeleteData = processDeleteData;
    window.processPostQuery = processPostQuery;
    window.handlePatchQuery = handlePatchQuery;
    window.searchEntities = searchEntities;
    window.loadEntityTypes = loadEntityTypes;
    window.filterEntitiesByType = filterEntitiesByType;
    
    // Only set handleEntityGet if it's not already defined
    // This prevents overriding the version in index.html
    if (typeof window.handleEntityGet !== 'function') {
        window.handleEntityGet = function(templatePath) {
            if (!templatePath || typeof templatePath !== 'string') {
                console.error('API handleEntityGet: Invalid template path:', templatePath);
                return;
            }
            
            console.log('API handleEntityGet called with:', templatePath);
            
            fetch(templatePath)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to fetch ${templatePath}: ${response.status} ${response.statusText}`);
                    }
                    return response.text();
                })
                .then(data => {
                    const displayArea = document.getElementById('displayArea');
                    if (displayArea) {
                        displayArea.innerHTML = data;
                    } else {
                        console.error('Display area element not found');
                    }
                })
                .catch(error => {
                    console.error('Error loading template:', error);
                    const displayArea = document.getElementById('displayArea');
                    if (displayArea) {
                        displayArea.innerHTML = `<p>Error loading content: ${error.message}</p>`;
                    }
                });
        };
    } else {
        console.log('handleEntityGet already defined, skipping definition in api.js');
    }

    // Check if handleGetQuery is already defined globally before defining it
    if (typeof window.handleGetQuery !== 'function') {
        console.log('handleGetQuery defined in api.js will not be used since it exists in index.html');
        // Do not define a placeholder implementation here to avoid conflicts
    } else {
        console.log('handleGetQuery already defined in index.html, skipping definition in api.js');
    }
}

export default OrionLDClient;