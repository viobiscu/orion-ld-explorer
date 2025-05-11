/* Tab Manager for JsonEditor instances */
class TabManager {
    constructor(containerSelector) {
        // Store tab data - Initialize these first before calling init()
        this.tabs = [];
        this.activeTabId = null;
        this.tabCounter = 0;
        
        this.container = document.querySelector(containerSelector);
        if (!this.container) {
            throw new Error(`Container element not found: ${containerSelector}`);
        }
        
        // Initialize the tab container structure
        this.init();
    }
    
    /**
     * Shorten an entity ID for tab display
     * @param {string} id - The full entity ID
     * @returns {string} - Shortened ID
     */
    shortenId(id) {
        if (!id) return id;
        
        // If it's a URN, extract the last part
        if (id.includes(':')) {
            const parts = id.split(':');
            return parts[parts.length - 1];
        }
        
        // If it's too long, truncate it
        if (id.length > 15) {
            return id.substring(0, 12) + '...';
        }
        
        return id;
    }
    
    /**
     * Detect and abbreviate entity ID in title
     * @param {string} title - The original title
     * @returns {string} - Title with abbreviated entity ID
     */
    abbreviateEntityId(title) {
        // Check if title contains an entity ID (typically in format "OPERATION urn:ngsi-ld:...")
        if (title && title.includes('urn:ngsi-ld:')) {
            // Extract entity ID by finding the URN pattern
            const match = title.match(/(urn:ngsi-ld:[^:]+:[^:\s]+)/i);
            if (match && match[1]) {
                const fullId = match[1];
                const shortId = this.shortenId(fullId);
                // Replace full ID with short ID in the title
                return title.replace(fullId, shortId);
            }
        }
        return title;
    }
    
    init() {
        // Create tab bar and content container
        this.tabsContainer = document.createElement('div');
        this.tabsContainer.className = 'editor-tabs-container';
        this.tabsContainer.style.display = 'flex';
        this.tabsContainer.style.flexDirection = 'column';
        this.tabsContainer.style.height = '100%';
        this.tabsContainer.style.overflow = 'hidden';
        
        // Tab header bar
        this.tabBar = document.createElement('div');
        this.tabBar.className = 'editor-tabs-bar';
        this.tabBar.style.display = 'flex';
        this.tabBar.style.backgroundColor = '#f0f0f0';
        this.tabBar.style.borderBottom = '1px solid #ddd';
        this.tabBar.style.overflowX = 'auto';
        this.tabBar.style.overflowY = 'hidden';
        this.tabBar.style.whiteSpace = 'nowrap';
        
        // Tab content area
        this.contentArea = document.createElement('div');
        this.contentArea.className = 'editor-tabs-content';
        this.contentArea.style.flexGrow = '1';
        this.contentArea.style.overflow = 'hidden';
        this.contentArea.style.position = 'relative';
        
        // Assemble the components
        this.tabsContainer.appendChild(this.tabBar);
        this.tabsContainer.appendChild(this.contentArea);
        
        // Replace the container's contents with our tab structure
        this.container.innerHTML = '';
        this.container.appendChild(this.tabsContainer);
        
        // Create a GET tab with JsonEditor instead of the welcome message
        const tabId = 'get-editor-tab';
        const tabTitle = 'GET Entities';
        const tab = this.createTab(tabTitle, tabId);
        
        // Create content container for the editor
        const contentContainer = document.createElement('div');
        contentContainer.className = 'editor-tab-content';
        contentContainer.id = `${tabId}-content`;
        contentContainer.style.height = '100%';
        contentContainer.style.display = 'block'; // Initially visible
        
        // Check URL for entity ID query
        let initialQuery = '';
        try {
            // Get the URL path and extract any entity ID
            const pathParts = window.location.pathname.split('/');
            const hash = window.location.hash;
            
            // If there's a hash with an entity ID, extract it
            if (hash && hash.startsWith('#/')) {
                initialQuery = hash.substring(1);
            } 
            // If there's a path parameter that looks like an entity ID
            else if (pathParts.length > 1 && pathParts[1].startsWith('urn:')) {
                initialQuery = '/' + pathParts[1];
            }
            // Check query string for entity parameters
            else if (window.location.search) {
                initialQuery = window.location.search;
            }
            
            console.log('Initial query from URL:', initialQuery);
        } catch (e) {
            console.error('Error extracting initial query from URL:', e);
        }
        
        // Create editor container inside the content - now taking full height
        const editorContainer = document.createElement('div');
        editorContainer.id = `${tabId}-editor`;
        editorContainer.style.height = '100%'; // Changed to full height
        contentContainer.appendChild(editorContainer);
        
        // Add the content to the content area
        this.contentArea.appendChild(contentContainer);
        
        // Create the editor with initial template with examples moved into the edit window
        const editorOptions = {
            containerId: editorContainer.id,
            initialValue: JSON.stringify({
                message: "Ready to query entities",
                instructions: "Use the GET field in the toolbar to query entities",
                examples: {
                    queryByType: "?type=Device - Get all entities of type Device",
                    queryById: "/urn:ngsi-ld:Device:001 - Get a specific entity by ID",
                    queryWithFilter: "?q=temperature>20 - Query with a filter"
                }
            }, null, 2),
            height: '100%',
            resize: true,
            mode: 'get',
            // Custom toolbar with GET functionality
            showToolbar: true,
            onCustomToolbar: (toolbar) => {
                // Add GET section to toolbar instead of a separate form
                const querySection = document.createElement('div');
                querySection.style.display = 'flex';
                querySection.style.alignItems = 'center';
                querySection.style.marginLeft = '15px';
                querySection.style.flex = '1';
                
                // Create a label for the query
                const queryLabel = document.createElement('span');
                queryLabel.textContent = 'GET:';
                queryLabel.style.fontWeight = 'bold';
                queryLabel.style.marginRight = '5px';
                querySection.appendChild(queryLabel);
                
                // Create the query input
                const queryInput = document.createElement('input');
                queryInput.type = 'text';
                queryInput.id = 'entityQueryInput';
                queryInput.placeholder = '?type=Device or /urn:ngsi-ld:Device:001';
                queryInput.value = initialQuery; // Set initial value from URL if available
                queryInput.style.flex = '1';
                queryInput.style.padding = '4px 8px';
                queryInput.style.margin = '0 10px';
                queryInput.style.border = '1px solid #ccc';
                queryInput.style.borderRadius = '4px';
                querySection.appendChild(queryInput);
                
                // Create the GET button
                const getButton = document.createElement('button');
                getButton.innerHTML = '<i class="fas fa-search"></i> GET';
                getButton.className = 'method-button get-button';
                getButton.style.padding = '4px 12px';
                getButton.style.border = 'none';
                getButton.style.borderRadius = '4px';
                getButton.style.backgroundColor = '#5cb85c'; // Green color for GET
                getButton.style.color = 'white';
                getButton.style.cursor = 'pointer';
                getButton.style.fontWeight = 'bold';
                querySection.appendChild(getButton);
                
                // Function to execute the query
                const executeQuery = function() {
                    const query = queryInput.value.trim();
                    if (query) {
                        // Store a reference to our editor for later
                        window.getResultsEditor = window.mainEditor;
                        
                        // Show loading state
                        window.mainEditor.setValue(JSON.stringify({
                            message: "Loading...",
                            query: query
                        }, null, 2));
                        
                        // Call the handleGetQuery function
                        if (typeof window.handleGetQuery === 'function') {
                            window.handleGetQuery(query);
                        } else {
                            window.mainEditor.setValue(JSON.stringify({
                                error: "handleGetQuery function is not available",
                                message: "The API query handler is not yet loaded. Please try again in a few moments."
                            }, null, 2));
                        }
                    }
                };
                
                // Add event listener to the GET button
                getButton.addEventListener('click', executeQuery);
                
                // Add event listener for Enter key on the input
                queryInput.addEventListener('keypress', function(event) {
                    if (event.key === 'Enter') {
                        executeQuery();
                    }
                });
                
                // Add the query section to the toolbar
                toolbar.appendChild(querySection);
            }
        };
        
        // Initialize the JsonEditor
        const editor = new JsonEditor(editorOptions);
        
        // Store tab information
        this.tabs.push({
            id: tabId,
            tabElement: tab,
            contentElement: contentContainer,
            editor: editor,
            mode: 'get'
        });
        
        // Activate the tab
        this.activeTabId = tabId;
        tab.classList.add('active');
        
        // Set as main editor for backward compatibility
        window.mainEditor = editor;
        window.getResultsEditor = editor; // Store for use in handleGetQuery
        
        // If there was an initial query, execute it after a short delay
        // to allow all scripts to load
        if (initialQuery) {
            setTimeout(() => {
                const queryInput = document.getElementById('entityQueryInput');
                if (queryInput) {
                    queryInput.value = initialQuery;
                    const getButton = queryInput.nextElementSibling;
                    if (getButton) getButton.click();
                }
            }, 500);
        }
    }
    
    createTab(title, id = null) {
        // Generate a unique ID if not provided
        const tabId = id || `tab-${++this.tabCounter}`;
        
        // Abbreviate entity ID in title
        const abbreviatedTitle = this.abbreviateEntityId(title);
        
        // Create tab element
        const tab = document.createElement('div');
        tab.className = 'editor-tab';
        tab.dataset.tabId = tabId;
        tab.style.display = 'inline-flex';
        tab.style.alignItems = 'center';
        tab.style.padding = '8px 12px';
        tab.style.borderRight = '1px solid #ddd';
        tab.style.cursor = 'pointer';
        tab.style.userSelect = 'none';
        tab.style.maxWidth = '200px';
        tab.style.position = 'relative';
        
        // Create title span with ellipsis for overflow
        const titleSpan = document.createElement('span');
        titleSpan.textContent = abbreviatedTitle;
        titleSpan.style.overflow = 'hidden';
        titleSpan.style.textOverflow = 'ellipsis';
        titleSpan.style.whiteSpace = 'nowrap';
        
        // Create close button
        const closeBtn = document.createElement('span');
        closeBtn.innerHTML = '&times;';
        closeBtn.className = 'tab-close-btn';
        closeBtn.style.marginLeft = '8px';
        closeBtn.style.fontWeight = 'bold';
        closeBtn.style.fontSize = '16px';
        closeBtn.style.lineHeight = '1';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.padding = '0 4px';
        closeBtn.style.borderRadius = '50%';
        
        // Hover effect for close button
        closeBtn.addEventListener('mouseover', () => {
            closeBtn.style.backgroundColor = '#ddd';
        });
        closeBtn.addEventListener('mouseout', () => {
            closeBtn.style.backgroundColor = 'transparent';
        });
        
        // Add click event for close button
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent tab activation
            this.closeTab(tabId);
        });
        
        // Add click event for tab
        tab.addEventListener('click', () => {
            this.activateTab(tabId);
        });
        
        // Assemble the tab
        tab.appendChild(titleSpan);
        tab.appendChild(closeBtn);
        
        // Add to tab bar
        this.tabBar.appendChild(tab);
        
        return tab;
    }
    
    createEditorTab(title, options) {
        // Generate a unique tab ID
        const tabId = `editor-${++this.tabCounter}`;
        
        // Create the tab
        const tab = this.createTab(title, tabId);
        
        // Create content container for this tab
        const contentContainer = document.createElement('div');
        contentContainer.className = 'editor-tab-content';
        contentContainer.id = `${tabId}-content`;
        contentContainer.style.height = '100%';
        contentContainer.style.display = 'none'; // Hide initially
        
        // Create editor container inside the content
        const editorContainer = document.createElement('div');
        editorContainer.id = `${tabId}-editor`;
        editorContainer.style.height = '100%';
        contentContainer.appendChild(editorContainer);
        
        // Add the content to the content area
        this.contentArea.appendChild(contentContainer);
        
        // Create the editor
        options.containerId = editorContainer.id;
        const editor = new JsonEditor(options);
        
        // Store tab information
        this.tabs.push({
            id: tabId,
            tabElement: tab,
            contentElement: contentContainer,
            editor: editor,
            mode: options.mode || 'standard'
        });
        
        // Activate the new tab
        this.activateTab(tabId);
        
        return tabId;
    }
    
    activateTab(tabId) {
        // Skip if already active
        if (this.activeTabId === tabId) return;
        
        // Deactivate current active tab
        if (this.activeTabId) {
            const activeTab = this.tabs.find(t => t.id === this.activeTabId);
            if (activeTab) {
                activeTab.tabElement.classList.remove('active');
                activeTab.contentElement.style.display = 'none';
            }
        }
        
        // Activate the new tab
        const tab = this.tabs.find(t => t.id === tabId);
        if (tab) {
            tab.tabElement.classList.add('active');
            tab.contentElement.style.display = 'block';
            this.activeTabId = tabId;
            
            // Set window.mainEditor to the current tab's editor for backward compatibility
            if (tab.editor) {
                window.mainEditor = tab.editor;
            }
        }
    }
    
    closeTab(tabId) {
        // Find the tab index
        const tabIndex = this.tabs.findIndex(t => t.id === tabId);
        if (tabIndex === -1) return;
        
        const tab = this.tabs[tabIndex];
        
        // Prevent closing the welcome tab
        if (tab.mode === 'welcome' && this.tabs.length === 1) return;
        
        // Remove DOM elements
        tab.tabElement.remove();
        tab.contentElement.remove();
        
        // If this was the active tab, activate another one
        if (this.activeTabId === tabId) {
            // Try to activate the tab to the left, or the first tab if none on the left
            let newTabId;
            if (tabIndex > 0) {
                newTabId = this.tabs[tabIndex - 1].id;
            } else if (this.tabs.length > 1) {
                newTabId = this.tabs[1].id;
            } else {
                newTabId = null;
            }
            
            // Remove the tab from the array first
            this.tabs.splice(tabIndex, 1);
            
            // Activate new tab if available
            if (newTabId) {
                this.activateTab(newTabId);
            } else {
                this.activeTabId = null;
                window.mainEditor = null;
            }
        } else {
            // Just remove the tab from the array
            this.tabs.splice(tabIndex, 1);
        }
    }
    
    closeAllTabs() {
        // Close all tabs except welcome
        const tabsToClose = this.tabs
            .filter(tab => tab.mode !== 'welcome')
            .map(tab => tab.id);
        
        tabsToClose.forEach(tabId => this.closeTab(tabId));
        
        // Ensure welcome tab is visible and active if it exists
        const welcomeTab = this.tabs.find(tab => tab.mode === 'welcome');
        if (welcomeTab) {
            this.activateTab(welcomeTab.id);
        }
    }
    
    getTabById(tabId) {
        return this.tabs.find(t => t.id === tabId);
    }
    
    getActiveTab() {
        return this.tabs.find(t => t.id === this.activeTabId);
    }
    
    getActiveTabEditor() {
        const activeTab = this.getActiveTab();
        return activeTab ? activeTab.editor : null;
    }
}

// Export globally
window.TabManager = TabManager;