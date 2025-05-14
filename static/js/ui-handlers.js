/**
 * UI handler utilities for the application
 * Complements the main UI manager with additional handlers
 */
import { appendToLogs } from './logging.js';
import { clearLogs } from './logging.js';
import { processGetData, processDeleteData } from './api.js';
import { OrionLDClient } from './api.js';  // Add this import

/**
 * Get a template for entity operations based on mode
 * @param {string} mode - The operation mode (get, post, put, patch)
 * @returns {Object} A template object for the specified mode
 */
function getEntityTemplate(mode) {
    switch (mode.toLowerCase()) {
        case 'post':
        case 'put':
            return {
                "id": "urn:ngsi-ld:Entity:001",
                "type": "Entity",
                "@context": ["https://ngsi-ld.sensorsreport.net/synchro-context.jsonld"]
            };
        case 'patch':
            return {
                "@context": ["https://ngsi-ld.sensorsreport.net/synchro-context.jsonld"],
                "value": "new value"
            };
        case 'get':
        default:
            return {
                message: "Enter an Entity ID and click GET",
                instructions: "Example ID: urn:ngsi-ld:Entity:001"
            };
    }
}

/**
 * Toggle a tree view element's expanded state
 * @param {HTMLElement} element - The tree view element to toggle
 */
export function toggleTreeView(element) {
    if (!element?.classList?.contains('expandable')) return;

    element.classList.toggle('active');
    const nestedList = element.nextElementSibling;
    
    if (nestedList && nestedList.classList.contains('nested')) {
        nestedList.style.display = 
            nestedList.style.display === 'block' ? 'none' : 'block';
    }
}

/**
 * Initialize all tree view elements in the document
 */
export function initTreeView() {
    document.querySelectorAll('.treeview-item').forEach(item => {
        item.addEventListener('click', (e) => toggleTreeView(e.currentTarget));
    });

    // Prevent event bubbling for nested items
    document.querySelectorAll('.nested li').forEach(item => {
        item.addEventListener('click', (e) => e.stopPropagation());
    });
}

/**
 * Initialize all UI elements and event listeners
 */
export function initializeUI() {
    document.addEventListener('DOMContentLoaded', () => {
        setupEventListeners();
        appendToLogs('UI initialized successfully');
    });
}

/**
 * Set up event listeners for UI elements
 */
function setupEventListeners() {
    // Set up tenant selection input
    const tenantSelect = document.getElementById('tenantname');
    if (tenantSelect) {
        tenantSelect.addEventListener('change', () => {
            localStorage.setItem('tenantName', tenantSelect.value);
            appendToLogs(`Tenant changed to: ${tenantSelect.value}`);
        });
    }
}

/**
 * Opens the entity editor in the specified mode
 * @param {string} mode - The mode to open the editor in (get, post, put, patch)
 */
export function openEntityEditor(mode) {
    console.log(`Opening JSON editor directly in ${mode} mode`);
    
    // Initialize TabManager if it doesn't exist yet
    if (!window.tabManager) {
        console.log('Initializing TabManager');
        window.tabManager = new TabManager('#displayArea');
    }
    
    // Initial entity templates based on mode
    const entityTemplate = getEntityTemplate(mode);
    
    // Get saved values if available
    let entityId = '';
    let initialValue = null;
    
    // Try to load saved values for the current mode
    const savedJson = localStorage.getItem(`entity${mode.charAt(0).toUpperCase() + mode.slice(1)}Json`);
    const savedEntityId = localStorage.getItem(`entity${mode.charAt(0).toUpperCase() + mode.slice(1)}Id`);
    
    if (savedJson) {
        try {
            initialValue = JSON.parse(savedJson);
        } catch (e) {
            console.warn('Could not parse saved JSON, using template instead', e);
            initialValue = entityTemplate;
        }
    } else {
        initialValue = entityTemplate;
    }
    
    // Use saved entity ID for all suitable modes
    if (savedEntityId && ['get', 'put', 'patch', 'delete'].includes(mode)) {
        entityId = savedEntityId;
    } else if (['put', 'patch'].includes(mode)) {
        // For PUT/PATCH, extract ID from template if no saved ID
        entityId = initialValue.id || '';
    }
    
    // Create tab title based on the mode
    const tabTitle = `${mode.toUpperCase()} Entity`;
    
    // Create editor options
    const editorOptions = {
        initialValue: JSON.stringify(initialValue, null, 2),
        height: 500,
        resize: true,
        mode: mode,
        entityId: entityId,
        operation: mode.toUpperCase(), // Explicitly set the operation type to trigger API buttons
        allowEntityIdEdit: true,       // Allow editing the entity ID
        onApiOperation: function(operation, entityId, data) {
            console.log(`API operation called: ${operation} on entity ${entityId}`);
            
            // Handler for different operations
            if (operation === 'GET') {
                if (typeof window.handleGetQuery === 'function') {
                    console.log(`Handling GET for ${entityId}`);
                    window.handleGetQuery(entityId);
                    return { success: true };
                }
            } else if (operation === 'POST') {
                if (typeof window.processPostQuery === 'function') {
                    return window.processPostQuery(JSON.stringify(data));
                }
            } else if (operation === 'PUT') {
                if (typeof window.processPutQuery === 'function') {
                    return window.processPutQuery(entityId, JSON.stringify(data));
                }
            } else if (operation === 'PATCH') {
                if (typeof window.processPatchQuery === 'function') {
                    return window.processPatchQuery(entityId, JSON.stringify(data));
                }
            } else if (operation === 'DELETE') {
                if (confirm(`Are you sure you want to delete entity "${entityId}"? This action cannot be undone.`)) {
                    if (typeof window.processDeleteQuery === 'function') {
                        return window.processDeleteQuery(entityId);
                    }
                }
            }
            
            console.error(`No handler for ${operation} operation`);
            return { error: true, message: `Handler for ${operation} not available` };
        },
        onSave: function(value) {
            try {
                const parsedValue = JSON.parse(value);
                // Save to localStorage for persistence
                localStorage.setItem(`entity${mode.charAt(0).toUpperCase() + mode.slice(1)}Json`, JSON.stringify(parsedValue));
                console.log(`Saved ${mode} JSON to localStorage`);
            } catch (e) {
                console.error('Error saving JSON to localStorage:', e);
            }
        }
    };
    
    // Create a new tab with the editor
    const tabId = window.tabManager.createEditorTab(tabTitle, editorOptions);
    console.log(`Created new tab with ID: ${tabId} for ${mode} mode`);
    
    // For backward compatibility, set window.entityEditor to the new editor
    const tab = window.tabManager.getTabById(tabId);
    if (tab && tab.editor) {
        window.entityEditor = tab.editor;
        
        // For GET mode, also set the getResultsEditor reference
        if (mode === 'get') {
            window.getResultsEditor = tab.editor;
        }
    }
    
    // Log the operation
    if (typeof appendToLogs === 'function') {
        appendToLogs(`Opened ${mode.toUpperCase()} Entity editor in a new tab`);
    }
}

/**
 * Opens a menu item in a new tab
 * @param {string} path - The path to the content HTML file
 * @param {string} title - The title for the tab
 */
export async function openMenuItemInTab(path, title) {
    console.log(`Opening ${title} in new tab`);
    
    // Initialize TabManager if it doesn't exist yet
    if (!window.tabManager) {
        console.log('Initializing TabManager');
        window.tabManager = new TabManager('#displayArea');
    }
    
    // Store current content for returning from color settings
    if (title === 'Color Settings') {
        const currentContent = document.getElementById('displayArea').innerHTML;
        localStorage.setItem('previousContent', currentContent);
    }
    
    try {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const content = await response.text();
        
        // Create a unique tab ID
        const tabId = `tab-${Date.now()}`;
        
        // Create the tab element
        const tab = window.tabManager.createTab(title, tabId);
        
        // Create content container
        const contentContainer = document.createElement('div');
        contentContainer.className = 'editor-tab-content';
        contentContainer.id = `${tabId}-content`;
        contentContainer.style.height = '100%';
        contentContainer.style.display = 'none';
        contentContainer.style.padding = '20px';
        contentContainer.style.overflow = 'auto';
        
        // Set the HTML content directly
        contentContainer.innerHTML = content;
        
        // Add to tabs array and DOM
        window.tabManager.contentArea.appendChild(contentContainer);
        window.tabManager.tabs.push({
            id: tabId,
            tabElement: tab,
            contentElement: contentContainer,
            mode: 'html'
        });
        
        // Activate the new tab
        window.tabManager.activateTab(tabId);
        
        // Initialize color settings if needed
        if (title === 'Color Settings' && typeof window.initColorSettings === 'function') {
            setTimeout(() => window.initColorSettings(), 100);
        }
        
        appendToLogs(`Opened ${title} in a new tab`);
    } catch (error) {
        console.error('Error opening menu item:', error);
        appendToLogs(`Error opening ${title}: ${error.message}`);
    }
}

/**
 * Handle entity GET operation
 * @param {string} path - The path to get content from
 */
export async function handleEntityGet(path) {
    console.log('Handling GET for path:', path);
    
    // Extract the title from the path
    const title = path.split('/').pop().replace('.html', '');
    const formattedTitle = title.split(/(?=[A-Z])/).join(' ');
    
    // Special handling for Queue, Resources and Color Settings
    if (path.includes('queue.html') || path.includes('resources.html') || path.includes('colorSettings.html')) {
        await openMenuItemInTab(path, formattedTitle);
        return;
    }
    
    // Original behavior for other items
    try {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const content = await response.text();
        
        // Update the display area
        const displayArea = document.getElementById('displayArea');
        if (displayArea) {
            displayArea.innerHTML = content;
        }
        
        appendToLogs(`Loaded ${formattedTitle} view`);
    } catch (error) {
        console.error('Error loading content:', error);
        appendToLogs(`Error loading ${formattedTitle}: ${error.message}`);
    }
}

/**
 * Process PATCH request for entity updates
 * @param {string} entityId - The ID of the entity to update
 * @param {string} jsonData - The JSON data containing the updates
 * @returns {Promise} Promise that resolves with the patch result
 */
export async function processPatchQuery(entityId, jsonData) {
    try {
        const client = new OrionLDClient();
        const entityData = JSON.parse(jsonData);
        
        // Call updateEntity on the client
        const result = await client.updateEntity(entityId, entityData);
        appendToLogs(`Successfully processed PATCH request for ${entityId}`);
        return result;
    } catch (error) {
        console.error('Error processing PATCH:', error);
        appendToLogs(`Error processing PATCH: ${error.message}`);
        throw error;
    }
}

/**
 * Process PUT request for entity replacement
 * @param {string} entityId - The ID of the entity to replace
 * @param {string} jsonData - The JSON data containing the full entity
 * @returns {Promise} Promise that resolves with the put result
 */
export async function processPutQuery(entityId, jsonData) {
    try {
        const client = new OrionLDClient();
        const entityData = JSON.parse(jsonData);
        
        // Call replaceEntity on the client
        const result = await client.replaceEntity(entityId, entityData);
        appendToLogs(`Successfully processed PUT request for ${entityId}`);
        return result;
    } catch (error) {
        console.error('Error processing PUT:', error);
        appendToLogs(`Error processing PUT: ${error.message}`);
        throw error;
    }
}

// Make functions available globally
window.initializeUI = initializeUI;
window.openEntityEditor = openEntityEditor;
window.handleEntityGet = handleEntityGet;
window.openMenuItemInTab = openMenuItemInTab;
window.processPatchQuery = processPatchQuery;
window.processPutQuery = processPutQuery;

export default {
    initializeUI,
    toggleTreeView,
    initTreeView,
    openEntityEditor,
    handleEntityGet,
    openMenuItemInTab,
    processPatchQuery,
    processPutQuery
};
