/**
 * Common Keyboard Shortcuts for JsonEditor
 * This file contains a list of common keyboard shortcuts that can be implemented in the JsonEditor.
 * 
 * [✓] = Implemented
 * [✗] = Not yet implemented
 */

const JsonEditorKeyboardShortcuts = {
    // File Operations
    saveFile: { 
        windows: "Ctrl+S", 
        mac: "Cmd+S", 
        description: "Save file [✓]" 
    },
    saveAs: { 
        windows: "Ctrl+Shift+S", 
        mac: "Cmd+Shift+S", 
        description: "Save as [✗]" 
    },
    openFile: { 
        windows: "Ctrl+O", 
        mac: "Cmd+O", 
        description: "Open file [✗]" 
    },
    
    // Editing Basics
    copy: { 
        windows: "Ctrl+C", 
        mac: "Cmd+C", 
        description: "Copy [✓]" 
    },
    cut: { 
        windows: "Ctrl+X", 
        mac: "Cmd+X", 
        description: "Cut [✓]" 
    },
    paste: { 
        windows: "Ctrl+V", 
        mac: "Cmd+V", 
        description: "Paste [✓]" 
    },
    undo: { 
        windows: "Ctrl+Z", 
        mac: "Cmd+Z", 
        description: "Undo [✓]" 
    },
    redo: { 
        windows: "Ctrl+Y or Ctrl+Shift+Z", 
        mac: "Cmd+Y or Cmd+Shift+Z", 
        description: "Redo [✓]" 
    },
    selectAll: { 
        windows: "Ctrl+A", 
        mac: "Cmd+A", 
        description: "Select all [✓]" 
    },
    
    // Text Manipulation
    toggleComment: { 
        windows: "Ctrl+/", 
        mac: "Cmd+/", 
        description: "Toggle comment (comment/uncomment selection) [✓]" 
    },
    indentSelection: { 
        windows: "Ctrl+]", 
        mac: "Cmd+]", 
        description: "Indent selection [✓]" 
    },
    outdentSelection: { 
        windows: "Ctrl+[", 
        mac: "Cmd+[", 
        description: "Outdent (unindent) selection [✓]" 
    },
    indent: { 
        windows: "Tab", 
        mac: "Tab", 
        description: "Indent [✓]" 
    },
    outdent: { 
        windows: "Shift+Tab", 
        mac: "Shift+Tab", 
        description: "Outdent [✓]" 
    },
    find: { 
        windows: "Ctrl+F", 
        mac: "Cmd+F", 
        description: "Find [✓]" 
    },
    replace: { 
        windows: "Ctrl+H", 
        mac: "Cmd+H", 
        description: "Replace [✗]" 
    },
    deleteLine: { 
        windows: "Ctrl+D", 
        mac: "Cmd+D", 
        description: "Delete line or duplicate selection [✗]" 
    },
    deleteLineAlt: { 
        windows: "Ctrl+Shift+K", 
        mac: "Cmd+Shift+K", 
        description: "Delete line [✗]" 
    },
    
    // Navigation
    goToLine: { 
        windows: "Ctrl+G", 
        mac: "Cmd+G", 
        description: "Go to line [✗]" 
    },
    goToStart: { 
        windows: "Ctrl+Home", 
        mac: "Cmd+Home", 
        description: "Go to start of document [✓]" 
    },
    goToEnd: { 
        windows: "Ctrl+End", 
        mac: "Cmd+End", 
        description: "Go to end of document [✓]" 
    },
    wordPrevious: { 
        windows: "Ctrl+Left", 
        mac: "Option+Left", 
        description: "Move to previous word [✓]" 
    },
    wordNext: { 
        windows: "Ctrl+Right", 
        mac: "Option+Right", 
        description: "Move to next word [✓]" 
    },
    lineStart: { 
        windows: "Home", 
        mac: "Cmd+Left", 
        description: "Go to beginning of line [✓]" 
    },
    lineEnd: { 
        windows: "End", 
        mac: "Cmd+Right", 
        description: "Go to end of line [✓]" 
    },
    
    // JSON-Specific
    formatJson: { 
        windows: "Ctrl+Shift+F", 
        mac: "Cmd+Shift+F", 
        description: "Format/prettify JSON [✓]" 
    },
    validateJson: { 
        windows: "Ctrl+Shift+V", 
        mac: "Cmd+Shift+V", 
        description: "Validate JSON [✓]" 
    },
    autoComplete: { 
        windows: "Ctrl+Space", 
        mac: "Cmd+Space", 
        description: "Auto-complete (for property names) [✗]" 
    },
    foldUnfold: { 
        windows: "Ctrl+.", 
        mac: "Cmd+.", 
        description: "Fold/unfold JSON node [✗]" 
    },
    
    // Advanced Editing
    moveLineUp: { 
        windows: "Ctrl+Shift+Up", 
        mac: "Cmd+Shift+Up", 
        description: "Move line up [✗]" 
    },
    moveLineDown: { 
        windows: "Ctrl+Shift+Down", 
        mac: "Cmd+Shift+Down", 
        description: "Move line down [✗]" 
    },
    navigateUp: { 
        windows: "Alt+Up", 
        mac: "Option+Up", 
        description: "Move cursor up (to navigate JSON) [✓]" 
    },
    navigateDown: { 
        windows: "Alt+Down", 
        mac: "Option+Down", 
        description: "Move cursor down (to navigate JSON) [✓]" 
    },
    selectLine: { 
        windows: "Ctrl+L", 
        mac: "Cmd+L", 
        description: "Select current line [✗]" 
    },
    upperCase: { 
        windows: "Ctrl+U", 
        mac: "Cmd+U", 
        description: "Convert to uppercase [✗]" 
    },
    lowerCase: { 
        windows: "Ctrl+Shift+U", 
        mac: "Cmd+Shift+U", 
        description: "Convert to lowercase [✗]" 
    },
    
    // Multiple Cursors/Selection
    addCursorAtClick: { 
        windows: "Ctrl+Click", 
        mac: "Cmd+Click", 
        description: "Add cursor at click position [✗]" 
    },
    addCursorAbove: { 
        windows: "Ctrl+Alt+Up", 
        mac: "Cmd+Option+Up", 
        description: "Add cursor above [✗]" 
    },
    addCursorBelow: { 
        windows: "Ctrl+Alt+Down", 
        mac: "Cmd+Option+Down", 
        description: "Add cursor below [✗]" 
    },
    selectAllOccurrences: { 
        windows: "Ctrl+Shift+L", 
        mac: "Cmd+Shift+L", 
        description: "Select all occurrences of current selection [✗]" 
    },

    // JSON Editor Specific Shortcuts
    jsonEditorSpecific: {
        insertProperty: {
            windows: "Alt+P",
            mac: "Option+P",
            description: "Insert NGSI-LD Property [✓]"
        },
        insertRelationship: {
            windows: "Alt+R",
            mac: "Option+R",
            description: "Insert NGSI-LD Relationship [✓]"
        },
        incrementValue: {
            windows: "Alt+Up",
            mac: "Option+Up",
            description: "Increment selected numeric value [✓]"
        },
        decrementValue: {
            windows: "Alt+Down",
            mac: "Option+Down",
            description: "Decrement selected numeric value [✓]"
        },
        toggleColoring: {
            windows: "Alt+C",
            mac: "Option+C",
            description: "Toggle syntax highlighting [✓]"
        },
        exportCsv: {
            windows: "Alt+E",
            mac: "Option+E",
            description: "Export JSON as CSV [✓]"
        },
        importCsv: {
            windows: "Alt+I",
            mac: "Option+I",
            description: "Import CSV as JSON [✓]"
        },
        viewAsJson: {
            windows: "Alt+J",
            mac: "Option+J",
            description: "View as JSON [✓]"
        },
        viewAsTable: {
            windows: "Alt+T",
            mac: "Option+T",
            description: "View as Table [✓]"
        },
        showKeyboardShortcuts: {
            windows: "F1",
            mac: "F1",
            description: "Show Keyboard Shortcuts [✓]"
        }
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = JsonEditorKeyboardShortcuts;
}

// Make available globally
if (typeof window !== 'undefined') {
    window.JsonEditorKeyboardShortcuts = JsonEditorKeyboardShortcuts;
}
