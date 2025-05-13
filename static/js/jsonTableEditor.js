/**
 * JsonTableEditor extends JsonEditor to provide tabular view for JSON arrays
 * This editor displays array data in a table format while maintaining JSON editing capabilities
 */

import JsonEditor from './jsonEditor.js';

class JsonTableEditor extends JsonEditor {
    constructor(config) {
        console.log('[Debug] JsonTableEditor constructor starting with config:', config);
        super(config);
        this.viewMode = 'table'; // Default to table view for arrays
        console.log('[Debug] After super() call - DOM structure:', this.debugDOMState());
        
        // Make sure editingArea is initialized from parent before creating table container
        if (!this.editingArea) {
            console.log('[Debug] editingArea not found, attempting to find it in DOM');
            this.editingArea = this.editorContainer?.querySelector('.json-editor-editing-area');
            console.log('[Debug] editingArea search result:', {
                found: !!this.editingArea,
                parentExists: !!this.editorContainer,
                selector: '.json-editor-editing-area'
            });
        }
        
        this.createTableContainer();
        this.groupByType = false;

        // Initialize the correct view state after all elements are created
        requestAnimationFrame(() => {
            if (this.viewMode === 'table') {
                this.editorWrapper.style.cssText = 'display: none !important;';
                this.tableContainer.style.cssText = 'display: block !important; width: 100%; height: 100%; overflow: auto; padding: 8px;';
                try {
                    const data = this.getValue(true);
                    if (Array.isArray(data)) {
                        this.displayTable(data);
                    }
                } catch (e) {
                    console.error('[Debug] Error displaying initial table view:', e);
                    this.viewMode = 'json';
                    this.editorWrapper.style.cssText = 'display: block !important;';
                    this.tableContainer.style.cssText = 'display: none !important;';
                }
            }
        });

        console.log('[Debug] Constructor complete - Full element state:', this.debugDOMState());
    }

    /**
     * Debug helper to get comprehensive DOM state
     */
    debugDOMState() {
        return {
            editorContainer: {
                exists: !!this.editorContainer,
                display: this.editorContainer?.style.display,
                children: this.editorContainer?.children.length,
                visible: this.isElementVisible(this.editorContainer)
            },
            editingArea: {
                exists: !!this.editingArea,
                display: this.editingArea?.style.display,
                children: this.editingArea?.children.length,
                visible: this.isElementVisible(this.editingArea)
            },
            editorWrapper: {
                exists: !!this.editorWrapper,
                display: this.editorWrapper?.style.display,
                visible: this.isElementVisible(this.editorWrapper)
            },
            tableContainer: {
                exists: !!this.tableContainer,
                display: this.tableContainer?.style.display,
                visible: this.isElementVisible(this.tableContainer)
            },
            viewMode: this.viewMode,
            dimensions: this.getElementDimensions()
        };
    }

    /**
     * Check if an element is actually visible in the DOM
     */
    isElementVisible(element) {
        if (!element) return false;
        
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0' &&
               element.offsetParent !== null;
    }

    /**
     * Get dimensions of key elements
     */
    getElementDimensions() {
        return {
            editorContainer: this.editorContainer ? {
                width: this.editorContainer.offsetWidth,
                height: this.editorContainer.offsetHeight,
                clientWidth: this.editorContainer.clientWidth,
                clientHeight: this.editorContainer.clientHeight
            } : null,
            tableContainer: this.tableContainer ? {
                width: this.tableContainer.offsetWidth,
                height: this.tableContainer.offsetHeight,
                clientWidth: this.tableContainer.clientWidth,
                clientHeight: this.tableContainer.clientHeight
            } : null
        };
    }

    /**
     * Create the table container for tabular display
     */
    createTableContainer() {
        this.tableContainer = document.createElement('div');
        this.tableContainer.className = 'json-table-container';
        // Initialize with the correct display state based on viewMode
        this.tableContainer.style.cssText = this.viewMode === 'table' ? 
            'display: block !important; width: 100%; height: 100%; overflow: auto; padding: 8px;' : 
            'display: none !important;';
        this.editingArea.appendChild(this.tableContainer);

        // Add view toggle button to toolbar
        if (this.showToolbar) {
            const viewToggleContainer = document.createElement('div');
            viewToggleContainer.style.display = 'flex';
            viewToggleContainer.style.alignItems = 'center';
            viewToggleContainer.style.marginLeft = '8px';
            
            // View toggle button
            const viewToggleButton = document.createElement('button');
            viewToggleButton.title = 'Toggle Table/JSON View (Ctrl+Shift+T)';
            viewToggleButton.innerHTML = '<i class="fas fa-table"></i>';
            viewToggleButton.style.marginRight = '4px';
            viewToggleContainer.appendChild(viewToggleButton);

            // Add group by type toggle button
            const groupByTypeButton = document.createElement('button');
            groupByTypeButton.title = 'Group By Type';
            groupByTypeButton.innerHTML = '<i class="fas fa-layer-group"></i>';
            groupByTypeButton.style.marginLeft = '4px';
            viewToggleContainer.appendChild(groupByTypeButton);

            this.toolbar.insertBefore(viewToggleContainer, this.toolbar.firstChild);

            viewToggleButton.addEventListener('click', () => {
                this.toggleView();
            });
            groupByTypeButton.addEventListener('click', () => {
                this.toggleGroupByType();
                this.updateDisplay();
            });

            // Add keyboard shortcut for view toggle
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 't') {
                    e.preventDefault();
                    this.toggleView();
                }
            });
        }
    }

    /**
     * Toggle between table and JSON view
     */
    toggleView() {
        console.log('[Debug] toggleView starting - Current state:', this.debugDOMState());
        
        // Validate required elements exist
        if (!this.editorWrapper || !this.tableContainer) {
            console.error('[Debug] Critical elements missing for view toggle:', {
                editorWrapper: !!this.editorWrapper,
                tableContainer: !!this.tableContainer
            });
            return;
        }
        
        // Store previous state for debugging
        const previousMode = this.viewMode;
        const previousState = this.debugDOMState();
        
        // Perform the toggle
        this.viewMode = this.viewMode === 'table' ? 'json' : 'table';
        
        console.log('[Debug] View mode changing:', {
            from: previousMode,
            to: this.viewMode,
            previousState: previousState
        });

        // Force display updates with !important to override any conflicting styles
        if (this.viewMode === 'table') {
            this.editorWrapper.style.cssText = 'display: none !important;';
            this.tableContainer.style.cssText = 'display: block !important; width: 100%; height: 100%; overflow: auto; padding: 8px;';
            // Ensure table is properly rendered
            try {
                const data = this.getValue(true);
                if (Array.isArray(data)) {
                    this.displayTable(data);
                }
            } catch (e) {
                console.error('[Debug] Error displaying table:', e);
                // Revert to JSON view if table display fails
                this.viewMode = 'json';
                this.editorWrapper.style.cssText = 'display: block !important;';
                this.tableContainer.style.cssText = 'display: none !important;';
            }
        } else {
            this.editorWrapper.style.cssText = 'display: block !important;';
            this.tableContainer.style.cssText = 'display: none !important;';
        }

        // Force a DOM reflow to ensure styles are applied
        void this.editorWrapper.offsetHeight;
        void this.tableContainer.offsetHeight;
        
        // Update display and verify the change
        this.updateDisplay();
        
        // Verify the toggle worked as expected
        const newState = this.debugDOMState();
        console.log('[Debug] View toggle complete - New state:', newState);
        
        // Validate the toggle was successful
        const expectedEditorDisplay = this.viewMode === 'json' ? 'block' : 'none';
        const expectedTableDisplay = this.viewMode === 'table' ? 'block' : 'none';
        
        const actualEditorDisplay = window.getComputedStyle(this.editorWrapper).display;
        const actualTableDisplay = window.getComputedStyle(this.tableContainer).display;
        
        if (actualEditorDisplay !== expectedEditorDisplay ||
            actualTableDisplay !== expectedTableDisplay) {
            console.error('[Debug] View toggle resulted in unexpected display state:', {
                editorWrapper: {
                    expected: expectedEditorDisplay,
                    actual: actualEditorDisplay,
                    element: this.editorWrapper
                },
                tableContainer: {
                    expected: expectedTableDisplay,
                    actual: actualTableDisplay,
                    element: this.tableContainer
                }
            });

            // Force correct display state if mismatch detected
            requestAnimationFrame(() => {
                this.editorWrapper.style.cssText = `display: ${expectedEditorDisplay} !important;`;
                this.tableContainer.style.cssText = `display: ${expectedTableDisplay} !important;`;
            });
        }
    }

    /**
     * Toggle between grouped and ungrouped view
     */
    toggleGroupByType() {
        this.groupByType = !this.groupByType;
        this.updateDisplay();
    }

    /**
     * Group entities by their type
     * @param {Array} data Array of entities to group
     * @returns {Object} Grouped entities
     */
    groupEntitiesByType(data) {
        const groups = {};
        data.forEach(entity => {
            const type = entity.type || 'Unknown';
            if (!groups[type]) {
                groups[type] = [];
            }
            groups[type].push(entity);
        });
        return groups;
    }

    /**
     * Override updateDisplay to handle both JSON and table views
     */
    updateDisplay() {
        console.log('[Debug] updateDisplay called - Elements state:', {
            editorWrapper: !!this.editorWrapper,
            tableContainer: !!this.tableContainer,
            viewMode: this.viewMode
        });

        if (!this.editorWrapper || !this.tableContainer) {
            console.error('[Debug] Required elements missing:', {
                editorWrapper: !!this.editorWrapper,
                tableContainer: !!this.tableContainer
            });
            return;
        }

        // Ensure proper display state
        const editorDisplay = this.viewMode === 'json' ? 'block' : 'none';
        const tableDisplay = this.viewMode === 'table' ? 'block' : 'none';

        // Apply display states with !important
        this.editorWrapper.style.cssText = `display: ${editorDisplay} !important;`;
        this.tableContainer.style.cssText = `display: ${tableDisplay} !important;`;
        
        if (this.viewMode === 'table') {
            try {
                const data = this.getValue(true);
                if (Array.isArray(data)) {
                    // Clear and rebuild table to ensure fresh state
                    this.tableContainer.innerHTML = '';
                    this.displayTable(data);
                    // Force table visibility
                    requestAnimationFrame(() => {
                        this.tableContainer.style.cssText = 'display: block !important; width: 100%; height: 100%; overflow: auto; padding: 8px;';
                    });
                    return;
                }
            } catch (e) {
                console.error('[Debug] Error displaying table view:', e);
            }
            // Fallback to JSON view if table display fails
            this.viewMode = 'json';
            this.editorWrapper.style.cssText = 'display: block !important;';
            this.tableContainer.style.cssText = 'display: none !important;';
        }

        // Call parent's updateDisplay for JSON view
        if (this.viewMode === 'json') {
            super.updateDisplay();
        }
        
        console.log('[Debug] Final display state:', {
            editorWrapperDisplay: window.getComputedStyle(this.editorWrapper).display,
            tableContainerDisplay: window.getComputedStyle(this.tableContainer).display,
            viewMode: this.viewMode
        });
    }

    /**
     * Display data in table format
     * @param {Array} data Array of objects to display in table
     */
    displayTable(data) {
        console.log('[Debug] displayTable called with data:', {
            isArray: Array.isArray(data),
            length: data?.length,
            firstItem: data?.[0]
        });
        
        if (!Array.isArray(data) || data.length === 0) {
            console.log('[Debug] No valid data to display in table');
            this.tableContainer.innerHTML = '<div class="empty-table">No data to display</div>';
            return;
        }

        // Clear the table container
        this.tableContainer.innerHTML = '';

        if (this.groupByType) {
            const groups = this.groupEntitiesByType(data);
            Object.entries(groups).forEach(([type, entities]) => {
                // Create type header
                const typeHeader = document.createElement('h3');
                typeHeader.textContent = `${type} (${entities.length})`;
                typeHeader.style.marginTop = '20px';
                typeHeader.style.marginBottom = '10px';
                typeHeader.style.padding = '8px';
                typeHeader.style.backgroundColor = '#f8f9fa';
                typeHeader.style.borderRadius = '4px';
                this.tableContainer.appendChild(typeHeader);

                // Create table for this type
                this.createEntityTable(entities);
            });
        } else {
            this.createEntityTable(data);
        }
    }

    /**
     * Create a table for a set of entities
     * @param {Array} entities Array of entities to display
     */
    createEntityTable(entities) {
        // Get all unique columns from the entities
        const columns = new Set();
        entities.forEach(item => {
            if (typeof item === 'object' && item !== null) {
                Object.keys(item).forEach(key => columns.add(key));
            }
        });

        // Create table HTML
        const table = document.createElement('table');
        table.className = 'json-table';
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.fontFamily = 'monospace';
        table.style.fontSize = '13px';
        table.style.marginBottom = '20px';

        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        Array.from(columns).forEach(column => {
            const th = document.createElement('th');
            th.textContent = column;
            th.style.padding = '8px';
            th.style.borderBottom = '2px solid #ddd';
            th.style.textAlign = 'left';
            th.style.fontWeight = 'bold';
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create body
        const tbody = document.createElement('tbody');
        entities.forEach((item, index) => {
            const row = document.createElement('tr');
            row.style.backgroundColor = index % 2 === 0 ? '#f8f9fa' : 'white';
            
            Array.from(columns).forEach(column => {
                const td = document.createElement('td');
                td.style.padding = '8px';
                td.style.borderBottom = '1px solid #ddd';
                
                let value = item[column];
                if (typeof value === 'object' && value !== null) {
                    value = JSON.stringify(value);
                }
                td.textContent = value !== undefined ? value : '';
                
                row.appendChild(td);
            });
            tbody.appendChild(row);
        });
        table.appendChild(tbody);

        this.tableContainer.appendChild(table);
    }

    /**
     * Override getValue to handle table view updates
     */
    getValue(parseJson = false) {
        console.log('[Debug] getValue called with parseJson:', parseJson);
        const value = super.getValue(parseJson);
        console.log('[Debug] getValue result:', {
            isArray: Array.isArray(value),
            length: Array.isArray(value) ? value.length : 'N/A',
            viewMode: this.viewMode
        });
        
        if (this.viewMode === 'table' && parseJson && Array.isArray(value)) {
            this.displayTable(value);
        }
        return value;
    }
}

// Add module exports
window.JsonTableEditor = JsonTableEditor;
export { JsonTableEditor };