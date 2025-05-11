/**
 * Global (non-module) version of the OrionLDClient
 * This file is meant to be loaded directly via a script tag
 */

// Simple logger for debugging
function appendToLogs(message) {
    const logsContainer = document.getElementById('request-logs');
    if (!logsContainer) return;
    
    const logElement = document.createElement('p');
    logElement.textContent = `${new Date().toISOString()} - ${message}`;
    logsContainer.insertBefore(logElement, logsContainer.firstChild);
}

// Basic error boundary implementation
class SimpleErrorBoundary {
    constructor() { 
        this.errors = []; 
    }
    
    wrap(fn) { 
        return async (...args) => { 
            try { 
                return await fn(...args); 
            } catch (e) { 
                console.error(e); 
                throw e; 
            } 
        }; 
    }
    
    addError(error) { 
        console.error('API Error:', error); 
    }
    
    clearErrors() {}
    
    getErrors() { 
        return []; 
    }
}

// Global error boundary instance
const errorBoundary = new SimpleErrorBoundary();

/**
 * Main client for Orion-LD Context Broker
 * This is a simplified version of the client that can be loaded directly
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
            "Accept": "application/json"
        };
        
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
        try {
            console.log(`Making ${method} request to: ${endpoint}`);
            console.log("Request headers:", this.headers);
            
            appendToLogs(`Request: ${method} ${endpoint}`);
            
            if (body) {
                console.log("Request body:", body);
                appendToLogs(`Request body: ${JSON.stringify(body).substring(0, 100)}${JSON.stringify(body).length > 100 ? '...' : ''}`);
            }
            
            const response = await fetch(endpoint, {
                method,
                headers: this.headers,
                body: body ? JSON.stringify(body) : null,
                credentials: 'include'
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
                        credentials: 'include'
                    });
                    
                    if (refreshResponse.ok) {
                        appendToLogs('Token refreshed, retrying request');
                        return this.makeRequest(endpoint, method, body);
                    } else {
                        appendToLogs('Token refresh failed, redirecting to login');
                        throw new Error('Authentication failed. Please log in again.');
                    }
                } catch (refreshError) {
                    appendToLogs(`Token refresh error: ${refreshError.message}`);
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
                this.showErrorMessage(`Network error: Unable to connect to the server. The service may be unavailable or there might be a connectivity issue.`);
            } else {
                appendToLogs(`Error in request: ${errorMessage}`);
                this.showErrorMessage(`Error: ${errorMessage}`);
            }
            
            return { error: errorMessage, status: 'error' };
        }
    }
    
    // Helper method to show error messages in the UI
    showErrorMessage(message) {
        // Display in JSON display area
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
        const endpoint = `${this.baseURL}/entities/${encodeURIComponent(entityId)}`;
        return await this.makeRequest(endpoint, "PUT", entity);
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
}

/**
 * Handle GET query results display
 * @param {string} query The query string that was executed
 * @param {Object|Array} data The data to display
 */
window.handleGetQuery = function(query) {
    console.log('Executing GET query:', query);
    
    // Create the API client
    const client = new OrionLDClient();
    
    // Show loading state in the editor if available
    if (window.getResultsEditor) {
        window.getResultsEditor.setValue(JSON.stringify({
            status: "loading",
            query: query,
            message: "Fetching data..."
        }, null, 2));
    }
    
    // Handle different query formats
    let endpoint = '';
    if (query.startsWith('?')) {
        // Query parameters format
        endpoint = `${client.baseURL}/entities${query}`;
    } else if (query.startsWith('/')) {
        // Path format with leading slash
        endpoint = `${client.baseURL}${query}`;
    } else if (query.startsWith('urn:')) {
        // URN format without leading slash
        endpoint = `${client.baseURL}/entities/${encodeURIComponent(query)}`;
    } else {
        // Default to entities endpoint with the query as a parameter
        endpoint = `${client.baseURL}/entities/${encodeURIComponent(query)}`;
    }
    
    // Execute the query
    fetch(endpoint, {
        method: 'GET',
        headers: client.headers,
        credentials: 'include'
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                try {
                    // Try to parse as JSON
                    return JSON.parse(text);
                } catch (e) {
                    // Return as plain text error
                    throw new Error(`${response.status} ${response.statusText}: ${text}`);
                }
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('GET query result:', data);
        
        // Set the data in the GET results editor
        if (window.getResultsEditor) {
            window.getResultsEditor.setValue(JSON.stringify(data, null, 2));
            
            // Log the operation
            appendToLogs(`GET query executed: ${query}`);
        } else {
            console.error('GET results editor not available');
            
            // Try setting in main editor as fallback
            if (window.mainEditor) {
                window.mainEditor.setValue(JSON.stringify(data, null, 2));
                appendToLogs(`GET query executed (main editor): ${query}`);
            }
        }
    })
    .catch(error => {
        console.error('GET query error:', error);
        
        // Display error in the GET results editor
        if (window.getResultsEditor) {
            window.getResultsEditor.setValue(JSON.stringify({
                error: error.message,
                query: query,
                timestamp: new Date().toISOString()
            }, null, 2));
            
            // Log the error
            appendToLogs(`GET query error: ${error.message}`);
        } else {
            console.error('GET results editor not available for error display');
        }
    });
};

// Make OrionLDClient globally available
window.OrionLDClient = OrionLDClient;

// Log that this file loaded
console.log("Global (non-module) OrionLDClient loaded successfully!");