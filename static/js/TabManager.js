import JsonEditor from './jsonEditor.js';
import { JsonTableEditor } from './jsonTableEditor.js';  // Changed to named import

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
        
        // Create the editor using the specified editor class or default to JsonEditor
        options.containerId = editorContainer.id;
        const EditorClass = options.editorClass || JsonEditor;
        const editor = new EditorClass(options);
        
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

    /**
     * Initialize TabManager and create welcome tab
     * @returns {Promise<TabManager>} The initialized TabManager instance
     */
    static async initialize() {
        console.log('Initializing TabManager');
        
        // Create TabManager
        const tabManager = new TabManager('#displayArea');
        
        // Create a default welcome tab
        const welcomeTabId = `welcome-tab-${Date.now()}`;
        const welcomeTab = tabManager.createTab('Welcome', welcomeTabId);
        
        // Create content container for welcome tab
        const contentContainer = document.createElement('div');
        contentContainer.className = 'editor-tab-content';
        contentContainer.id = `${welcomeTabId}-content`;
        contentContainer.style.height = '100%';
        contentContainer.style.display = 'none'; // Hide initially
        
        // Add welcome content
        contentContainer.innerHTML = `
            <div style="padding: 20px;">
                <h1>Welcome to SR Explorer</h1>
                <p>Select an option from the menu on the left to get started.</p>
            </div>
        `;
        
        // Add the content container to tabs array
        tabManager.tabs.push({
            id: welcomeTabId,
            tabElement: welcomeTab,
            contentElement: contentContainer,
            mode: 'welcome'
        });
        
        // Add content to content area and activate tab
        tabManager.contentArea.appendChild(contentContainer);
        tabManager.activateTab(welcomeTabId);
        
        return tabManager;
    }
}

// Add module exports
window.TabManager = TabManager;
export { TabManager };
export default TabManager;