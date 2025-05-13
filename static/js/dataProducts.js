/**
 * API client for interacting with Data Products
 * This module extends the API functionality to handle Data Products
 */

import { appendToLogs } from './logging.js';

// JSON output utility function - using window.mainEditor for consistency
function displayJSON(data) {
    // Check if the main editor is available
    if (window.mainEditor && typeof window.mainEditor.setValue === 'function') {
        try {
            // Use the main editor to display the JSON data
            window.mainEditor.setValue(JSON.stringify(data, null, 2));
            console.log('Updated main editor with data product data');
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
            // Use textContent to automatically escape HTML
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
        // Use textContent instead of innerHTML to automatically escape HTML
        const codeElement = preElement.querySelector('code');
        codeElement.textContent = formattedJson;
        
        // Apply syntax highlighting in a safer way
        if (hljs) {
            try {
                const result = hljs.highlight(formattedJson, {
                    language: 'json',
                    ignoreIllegals: true
                });
                // Use innerHTML only after highlight.js has processed the content
                codeElement.innerHTML = result.value;
                codeElement.classList.add('hljs-custom');
            } catch (error) {
                console.error('Error applying syntax highlighting:', error);
                // Fallback to plain text if highlighting fails
                codeElement.textContent = formattedJson;
            }
        }
    } else {
        console.error('No display element found for JSON output');
    }
}

/**
 * Data Product Client for handling data product operations
 */
class DataProductClient {
    constructor() {
        // Use the backend proxy URL instead of direct access
        // This will route through our backend-sr-explorer.py proxy
        this.baseURL = '/api/data-products';
        
        // Set default headers
        this.headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        };
        
        console.log("DataProductClient initialized with proxy URL:", this.baseURL);
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
            appendToLogs(`Response: ${response.status} ${response.statusText}`);
            
            // Read the response body text once
            const responseText = await response.text();
            
            // Handle empty responses
            if (!responseText.trim()) {
                if (response.ok) {
                    console.log("Empty response received with successful status code");
                    appendToLogs("Operation completed successfully (empty response)");
                    return { status: 'success', message: 'Operation completed successfully' };
                } else {
                    // Empty error response
                    const errorMessage = `Server responded with status ${response.status} (empty response)`;
                    console.error(errorMessage);
                    appendToLogs(`Error: ${errorMessage}`);
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
                            return errorData;
                        } catch (parseError) {
                            console.error("Failed to parse error response as JSON:", parseError);
                        }
                    }
                    
                    console.log(`Error response text: ${responseText.substring(0, 500)}`);
                    appendToLogs(`Error: Non-JSON response. Status: ${response.status}. Text: ${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}`);
                    throw new Error(`Server responded with status ${response.status}: ${responseText.substring(0, 100) || 'Non-JSON response'}`);
                } catch (parseError) {
                    console.error("Parse error:", parseError);
                    appendToLogs(`Parse error: ${parseError.message}`);
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
            } else {
                appendToLogs(`Error in request: ${errorMessage}`);
            }
            
            return { error: errorMessage, status: 'error' };
        }
    }

    // Data Product operations
    async getAllDataProducts() {
        const endpoint = `${this.baseURL}`;
        return await this.makeRequest(endpoint, "GET");
    }

    async getDataProductById(dataProductId) {
        const endpoint = `${this.baseURL}/${encodeURIComponent(dataProductId)}`;
        return await this.makeRequest(endpoint, "GET");
    }

    async createDataProduct(dataProduct) {
        const endpoint = `${this.baseURL}`;
        return await this.makeRequest(endpoint, "POST", dataProduct);
    }

    async updateDataProduct(dataProductId, updates) {
        const endpoint = `${this.baseURL}/${encodeURIComponent(dataProductId)}`;
        return await this.makeRequest(endpoint, "PATCH", updates);
    }

    async deleteDataProduct(dataProductId) {
        const endpoint = `${this.baseURL}/${encodeURIComponent(dataProductId)}`;
        return await this.makeRequest(endpoint, "DELETE");
    }
}

// Create a singleton instance of the client
const dataProductClient = new DataProductClient();

// Fetch all data products
export async function fetchAllDataProducts() {
    try {
        const data = await dataProductClient.getAllDataProducts();
        displayJSON(data);
        appendToLogs(`Successfully retrieved all data products`);
    } catch (error) {
        console.error('Error:', error);
        appendToLogs(`Error: ${error.message}`);
    }
}

// Fetch data product by ID
export async function fetchDataProductById() {
    try {
        let dataProductId = prompt('Enter the Data Product ID:');
        if (!dataProductId) return;

        const data = await dataProductClient.getDataProductById(dataProductId);
        displayJSON(data);
        appendToLogs(`Successfully retrieved data product with ID: ${dataProductId}`);
    } catch (error) {
        console.error('Error:', error);
        appendToLogs(`Error: ${error.message}`);
    }
}

// Create a new data product
export async function createDataProduct(dataProductJson) {
    try {
        const dataProduct = JSON.parse(dataProductJson);
        const data = await dataProductClient.createDataProduct(dataProduct);
        displayJSON(data);
        appendToLogs(`Successfully created data product with ID: ${dataProduct.id}`);
    } catch (error) {
        console.error('Error:', error);
        appendToLogs(`Error: ${error.message}`);
    }
}

// Update an existing data product
export async function updateDataProduct(dataProductId, updatesJson) {
    try {
        const updates = JSON.parse(updatesJson);
        const data = await dataProductClient.updateDataProduct(dataProductId, updates);
        displayJSON(data);
        appendToLogs(`Successfully updated data product with ID: ${dataProductId}`);
    } catch (error) {
        console.error('Error:', error);
        appendToLogs(`Error: ${error.message}`);
    }
}

// Delete a data product
export async function deleteDataProduct() {
    try {
        let dataProductId = prompt('Enter the Data Product ID to delete:');
        if (!dataProductId) return;

        // Add confirmation prompt
        const confirmed = confirm(`Are you sure you want to delete data product with ID: ${dataProductId}?`);
        if (!confirmed) {
            appendToLogs(`Delete operation canceled for data product: ${dataProductId}`);
            return;
        }

        const data = await dataProductClient.deleteDataProduct(dataProductId);
        displayJSON(data);
        appendToLogs(`Successfully deleted data product with ID: ${dataProductId}`);
    } catch (error) {
        console.error('Error:', error);
        appendToLogs(`Error: ${error.message}`);
    }
}

// Expose functions to global scope
if (typeof window !== 'undefined') {
    window.fetchAllDataProducts = fetchAllDataProducts;
    window.fetchDataProductById = fetchDataProductById;
    window.createDataProduct = createDataProduct;
    window.updateDataProduct = updateDataProduct;
    window.deleteDataProduct = deleteDataProduct;
}

export default {
    fetchAllDataProducts,
    fetchDataProductById,
    createDataProduct,
    updateDataProduct,
    deleteDataProduct
};