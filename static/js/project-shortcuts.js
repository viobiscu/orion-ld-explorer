/**
 * Project-Specific Keyboard Shortcuts
 * Custom shortcuts designed specifically for the Sensors Report application.
 * 
 * [✓] = Implemented
 * [✗] = Not yet implemented
 */

const ProjectSpecificShortcuts = {
    // Data Product Operations
    createDataProduct: {
        windows: "Alt+N",
        mac: "Option+N",
        description: "Create new data product [✗]"
    },
    saveDataProduct: {
        windows: "Ctrl+S",
        mac: "Cmd+S",
        description: "Save current data product [✓]"
    },
    deleteDataProduct: {
        windows: "Ctrl+Shift+Delete",
        mac: "Cmd+Shift+Delete",
        description: "Delete current data product [✗]"
    },
    listDataProducts: {
        windows: "Alt+L",
        mac: "Option+L",
        description: "List all data products [✗]"
    },
    
    // JsonEditor Special Functions
    insertNGSIProperty: {
        windows: "Ctrl+Shift+P",
        mac: "Cmd+Shift+P",
        description: "Insert NGSI-LD Property [✗]"
    },
    insertNGSIRelationship: {
        windows: "Ctrl+Shift+R",
        mac: "Cmd+Shift+R",
        description: "Insert NGSI-LD Relationship [✗]"
    },
    toggleJsonTable: {
        windows: "Alt+T",
        mac: "Option+T",
        description: "Toggle between JSON and Table view [✓]"
    },
    toggleColoring: {
        windows: "Alt+C",
        mac: "Option+C",
        description: "Toggle JSON syntax highlighting [✓]"
    },
    exportToCsv: {
        windows: "Ctrl+E",
        mac: "Cmd+E",
        description: "Export current JSON as CSV [✗]"
    },
    importFromCsv: {
        windows: "Ctrl+I",
        mac: "Cmd+I",
        description: "Import CSV as JSON [✗]"
    },
    
    // Entity Management
    createEntity: {
        windows: "Alt+E",
        mac: "Option+E",
        description: "Create new entity [✗]"
    },
    getEntity: {
        windows: "Alt+G",
        mac: "Option+G",
        description: "Get entity by ID [✗]"
    },
    updateEntity: {
        windows: "Alt+U",
        mac: "Option+U",
        description: "Update current entity [✗]"
    },
    deleteEntity: {
        windows: "Alt+D",
        mac: "Option+D",
        description: "Delete current entity [✗]"
    },
    
    // View Controls
    toggleColorSettings: {
        windows: "Alt+S",
        mac: "Option+S",
        description: "Open/close color settings panel [✗]"
    },
    toggleApiPanel: {
        windows: "Alt+A",
        mac: "Option+A",
        description: "Toggle API interaction panel [✗]"
    },
    toggleResourcesView: {
        windows: "Alt+R",
        mac: "Option+R",
        description: "Toggle resources panel [✗]"
    },
    refreshData: {
        windows: "F5",
        mac: "Cmd+R",
        description: "Refresh current data [✓]"
    },
    
    // Authentication
    login: {
        windows: "Alt+L",
        mac: "Option+L",
        description: "Show login dialog [✗]"
    },
    logout: {
        windows: "Alt+Q",
        mac: "Option+Q",
        description: "Logout current user [✗]"
    },
    
    // NGSI-LD Operations
    incrementProperty: {
        windows: "Alt+Up",
        mac: "Option+Up",
        description: "Increment selected numeric property [✓]"
    },
    decrementProperty: {
        windows: "Alt+Down",
        mac: "Option+Down",
        description: "Decrement selected numeric property [✓]"
    },
    
    // Help Functions
    showKeyboardShortcuts: {
        windows: "F1",
        mac: "F1",
        description: "Show keyboard shortcuts reference [✓]"
    },
    showDocumentation: {
        windows: "F2",
        mac: "F2",
        description: "Show application documentation [✗]"
    }
};

// Merge with general keyboard shortcuts
if (typeof window !== 'undefined') {
    // If JsonEditorKeyboardShortcuts already exists, extend it
    if (window.JsonEditorKeyboardShortcuts) {
        window.AllKeyboardShortcuts = {
            ...window.JsonEditorKeyboardShortcuts,
            ...ProjectSpecificShortcuts
        };
    } else {
        window.ProjectSpecificShortcuts = ProjectSpecificShortcuts;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjectSpecificShortcuts;
}
