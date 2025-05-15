/**
 * JsonTableEditor extends JsonEditor to provide tabular view for JSON arrays
 * This editor displays array data in a table format while maintaining JSON editing capabilities
 */

import JsonEditor from './jsonEditor.js';
import { JsonFormEditor } from './jsonFormEditor.js';
import { OrionLDClient } from './api.js';
import { appendToLogs } from './logging.js';

class JsonTableEditor extends JsonEditor {
    constructor(config) {
        console.log('[Debug] JsonTableEditor constructor starting with config:', config);
        super(config);
        this.viewMode = 'table'; // Default to table view for arrays
        this.selectedRows = new Set();
        this.selectedColumns = new Set();
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
        // Set max-width and add pointer-events-auto to ensure resizer still works
        this.tableContainer.style.cssText = this.viewMode === 'table' ? 
            'display: block !important; width: 100%; max-width: 100%; height: 100%; overflow: auto; padding: 8px; position: relative; pointer-events: auto;' : 
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

            // Add delete button
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-button';
            deleteButton.title = 'Delete Selected Rows/Columns';
            deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
            deleteButton.style.display = 'none';
            deleteButton.style.marginLeft = '4px';
            viewToggleContainer.appendChild(deleteButton);

            this.toolbar.insertBefore(viewToggleContainer, this.toolbar.firstChild);

            viewToggleButton.addEventListener('click', () => {
                this.toggleView();
            });
            groupByTypeButton.addEventListener('click', () => {
                this.toggleGroupByType();
                this.updateDisplay();
            });
            deleteButton.addEventListener('click', () => {
                this.handleDelete();
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
        // Validate required elements exist
        if (!this.editorWrapper || !this.tableContainer) {
            console.error('[Debug] Critical elements missing for view toggle:', {
                editorWrapper: !!this.editorWrapper,
                tableContainer: !!this.tableContainer
            });
            return;
        }

        // Store previous state
        const previousMode = this.viewMode;
        console.log('[Debug] Switching view mode:', {
            from: previousMode,
            to: previousMode === 'table' ? 'json' : 'table'
        });
        
        // Toggle view mode
        this.viewMode = this.viewMode === 'table' ? 'json' : 'table';
        
        // Clear existing content before switching views to prevent duplicates
        if (this.viewMode === 'table') {
            console.log('[Debug] Switching to table view - Setting display states');
            // Switch to table view
            this.editorWrapper.style.cssText = 'display: none !important;';
            this.tableContainer.style.cssText = 'display: block !important; width: 100%; height: 100%; overflow: auto; padding: 8px;';
            
            // Clear and rebuild table
            this.tableContainer.innerHTML = '';
            try {
                const data = this.getValue(true);
                console.log('[Debug] Retrieved data for table view:', {
                    isArray: Array.isArray(data),
                    length: Array.isArray(data) ? data.length : 'N/A',
                    firstItem: data?.[0]
                });
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
            console.log('[Debug] Switching to JSON view - Setting display states');
            // Switch to JSON view
            this.editorWrapper.style.cssText = 'display: block !important;';
            this.tableContainer.style.cssText = 'display: none !important;';
            this.tableContainer.innerHTML = ''; // Clear table content
        }

        // Update display after toggle
        requestAnimationFrame(() => {
            console.log('[Debug] Updating display after view toggle');
            this.updateDisplay();
        });
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
     * Format column name for display
     * @param {string} column The raw column name
     * @returns {string} The formatted column name
     */
    formatColumnName(column) {
        // Remove common prefixes like "ngsi-" or "urn:"
        let formatted = column.replace(/^(ngsi-|urn:)/, '');
        
        // Split by common delimiters
        formatted = formatted.split(/[-_.]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');

        // Special case for ID/URN
        if (column.toLowerCase() === 'id' || column.toLowerCase() === 'urn') {
            return column.toUpperCase();
        }

        return formatted;
    }

    /**
     * Create a table for a set of entities
     * @param {Array} entities Array of entities to display
     */
    createEntityTable(entities) {
        // Get all unique columns from the entities and flatten Property types
        const columns = new Set();
        entities.forEach(item => {
            if (typeof item === 'object' && item !== null) {
                Object.entries(item).forEach(([key, value]) => {
                    if (value && typeof value === 'object' && value.type === 'Property' && 'value' in value) {
                        columns.add(key);
                    } else {
                        columns.add(key);
                    }
                });
            }
        });

        // Calculate column widths based on content with smart scaling
        const getContentWidth = (content) => {
            if (!content) return 80; // Default minimum width
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            context.font = '13px monospace'; // Match table font
            const padding = 16; // Reduced padding even further
            const measured = context.measureText(String(content)).width;
            
            // Aggressive sizing with diminishing returns for longer content
            if (measured < 80) return Math.max(60, measured + padding);
            if (measured < 120) return Math.min(120, measured + padding * 0.8);
            if (measured < 160) return Math.min(160, measured + padding * 0.6);
            return Math.min(200, measured + padding * 0.4); // Minimal padding for very long content
        };

        // Get optimized content width for each column
        const columnWidths = new Map();
        columns.forEach(column => {
            let maxWidth = getContentWidth(this.formatColumnName(column));
            let sampleSize = 0;
            const maxSamples = 10; // Reduced sample size for better performance
            
            // Get average content length first
            let totalLength = 0;
            let samples = 0;
            
            for (const item of entities) {
                if (samples++ >= maxSamples) break;
                let value = item[column];
                if (value && typeof value === 'object') {
                    if (value.type === 'Property' && 'value' in value) {
                        value = value.value;
                    } else {
                        value = JSON.stringify(value);
                    }
                }
                totalLength += String(value || '').length;
            }
            
            const avgLength = totalLength / samples;
            
            // If average length is small, we can use fewer samples
            const effectiveMaxSamples = avgLength > 50 ? 5 : maxSamples;
            
            // Process actual content widths
            for (const item of entities) {
                if (sampleSize++ >= effectiveMaxSamples) break;
                
                let value = item[column];
                if (value && typeof value === 'object') {
                    if (value.type === 'Property' && 'value' in value) {
                        value = value.value;
                    } else {
                        value = JSON.stringify(value);
                    }
                }
                const contentWidth = getContentWidth(value);
                maxWidth = Math.max(maxWidth, contentWidth);
                
                // Early exit if we hit max width
                if (maxWidth >= 200) {
                    maxWidth = 200;
                    break;
                }
            }
            columnWidths.set(column, maxWidth);
        });

        // Create table HTML with fixed layout and width constraints
        const table = document.createElement('table');
        table.className = 'json-table';
        table.style.width = '100%';
        table.style.maxWidth = '100%';
        table.style.tableLayout = 'fixed';
        table.style.borderCollapse = 'collapse';
        table.style.fontFamily = 'monospace';
        table.style.fontSize = '13px';
        table.style.marginBottom = '20px';
        table.style.position = 'relative';
        table.style.zIndex = '1';
        
        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        // Add checkbox column header with fixed width
        const checkboxTh = document.createElement('th');
        checkboxTh.style.width = '40px';
        checkboxTh.style.minWidth = '40px';
        checkboxTh.style.maxWidth = '40px';
        
        const selectAllCheckbox = document.createElement('input');
        selectAllCheckbox.type = 'checkbox';
        
        // Add click handler for reverse selection
        checkboxTh.addEventListener('click', (e) => {
            // Only handle clicks on the th element itself, not the checkbox
            if (e.target === checkboxTh) {
                const checkboxes = table.querySelectorAll('tbody input[type="checkbox"]');
                checkboxes.forEach((checkbox, index) => {
                    // Toggle the checkbox state
                    checkbox.checked = !checkbox.checked;
                    if (checkbox.checked) {
                        this.selectedRows.add(index);
                    } else {
                        this.selectedRows.delete(index);
                    }
                });
                // Update the select all checkbox state
                selectAllCheckbox.checked = false;
                this.updateSelectionUI();
                this.updateDeleteButtonVisibility();
            }
        });

        selectAllCheckbox.addEventListener('change', () => {
            const checkboxes = table.querySelectorAll('tbody input[type="checkbox"]');
            checkboxes.forEach((checkbox, index) => {
                checkbox.checked = selectAllCheckbox.checked;
                if (selectAllCheckbox.checked) {
                    this.selectedRows.add(index);
                } else {
                    this.selectedRows.delete(index);
                }
            });
            this.updateSelectionUI();
            this.updateDeleteButtonVisibility();
        });
        checkboxTh.appendChild(selectAllCheckbox);
        headerRow.appendChild(checkboxTh);

        // Add other column headers with calculated widths
        Array.from(columns).forEach((column) => {
            const th = document.createElement('th');
            th.textContent = this.formatColumnName(column);
            th.style.padding = '8px';
            th.style.borderBottom = '2px solid #ddd';
            th.style.textAlign = 'left';
            th.style.fontWeight = 'bold';
            th.style.position = 'relative';
            th.style.userSelect = 'none';
            th.style.width = `${columnWidths.get(column)}px`;
            th.style.minWidth = '80px';
            th.style.maxWidth = '200px';
            
            // Add tooltip with original name
            if (th.textContent !== column) {
                th.title = column;
            }
            
            // Add resize handle
            const resizeHandle = document.createElement('div');
            resizeHandle.className = 'column-resize-handle';
            resizeHandle.style.position = 'absolute';
            resizeHandle.style.right = '0';
            resizeHandle.style.top = '0';
            resizeHandle.style.bottom = '0';
            resizeHandle.style.width = '4px';
            resizeHandle.style.cursor = 'col-resize';
            resizeHandle.style.backgroundColor = 'transparent';
            resizeHandle.style.transition = 'background-color 0.2s';

            resizeHandle.addEventListener('mouseenter', () => {
                resizeHandle.style.backgroundColor = '#ddd';
            });
            resizeHandle.addEventListener('mouseleave', () => {
                resizeHandle.style.backgroundColor = 'transparent';
            });

            resizeHandle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const startX = e.pageX;
                const startWidth = th.offsetWidth;
                
                const onMouseMove = (mouseMoveEvent) => {
                    const diff = mouseMoveEvent.pageX - startX;
                    th.style.width = `${startWidth + diff}px`;
                };
                
                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };
                
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });

            th.appendChild(resizeHandle);
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create body with overflow handling
        const tbody = document.createElement('tbody');
        entities.forEach((item, index) => {
            const row = document.createElement('tr');
            row.style.backgroundColor = index % 2 === 0 ? '#f8f9fa' : 'white';
            
            // Add double-click handler to open form editor
            row.addEventListener('dblclick', () => this.openFormEditor(item));

            // Add checkbox cell as the first column
            const checkboxCell = document.createElement('td');
            checkboxCell.style.padding = '8px';
            checkboxCell.style.borderBottom = '1px solid #ddd';
            checkboxCell.style.textAlign = 'center';
            
            const rowCheckbox = document.createElement('input');
            rowCheckbox.type = 'checkbox';
            rowCheckbox.addEventListener('change', () => {
                if (rowCheckbox.checked) {
                    this.selectedRows.add(index);
                } else {
                    this.selectedRows.delete(index);
                }
                this.updateSelectionUI();
                this.updateDeleteButtonVisibility();
            });
            
            checkboxCell.appendChild(rowCheckbox);
            row.appendChild(checkboxCell);

            // Add data cells
            Array.from(columns).forEach(column => {
                const td = document.createElement('td');
                td.style.padding = '8px';
                td.style.borderBottom = '1px solid #ddd';
                td.style.overflow = 'hidden';
                td.style.textOverflow = 'ellipsis';
                td.style.whiteSpace = 'nowrap';
                td.style.maxWidth = '0'; // This forces text-overflow to work with table-layout: fixed
                
                let value = item[column];
                if (value && typeof value === 'object') {
                    if (value.type === 'Property' && 'value' in value) {
                        value = value.value;
                    } else {
                        value = JSON.stringify(value);
                    }
                }
                td.textContent = value !== undefined ? value : '';
                td.title = td.textContent; // Add tooltip to show full content on hover
                
                row.appendChild(td);
            });
            tbody.appendChild(row);
        });
        table.appendChild(tbody);

        this.tableContainer.appendChild(table);
    }

    /**
     * Open form editor modal for an entity
     * @param {Object} entity The entity to edit
     */
    openFormEditor(entity) {
        console.log('[Debug] Opening form editor modal for entity:', entity);
        if (!entity || !entity.id) {
            console.error('[Debug] Invalid entity for form editor');
            return;
        }

        // Create modal container
        const modal = document.createElement('div');
        modal.className = 'json-editor-modal';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.zIndex = '9999';

        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'json-editor-modal-content';
        modalContent.style.backgroundColor = 'white';
        modalContent.style.padding = '20px';
        modalContent.style.borderRadius = '8px';
        modalContent.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
        modalContent.style.width = '80%';
        modalContent.style.maxWidth = '1200px';
        modalContent.style.height = '80vh'; // Set a fixed height using viewport height
        modalContent.style.minHeight = '500px'; // Set a minimum height
        modalContent.style.display = 'flex';
        modalContent.style.flexDirection = 'column';
        modalContent.style.position = 'relative';

        // Add close button
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '✕';
        closeButton.style.position = 'absolute';
        closeButton.style.right = '10px';
        closeButton.style.top = '10px';
        closeButton.style.border = 'none';
        closeButton.style.background = 'none';
        closeButton.style.fontSize = '20px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.color = '#666';
        closeButton.onclick = () => modal.remove();
        modalContent.appendChild(closeButton);

        // Create form editor container with full remaining height
        const editorContainer = document.createElement('div');
        const editorId = `form-editor-${Date.now()}`;
        editorContainer.id = editorId;
        editorContainer.style.flexGrow = '1'; // Take up remaining space
        editorContainer.style.minHeight = '0'; // Allow container to shrink
        editorContainer.style.marginTop = '20px';
        modalContent.appendChild(editorContainer);

        // Add modal to DOM
        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Initialize JsonFormEditor after ensuring container is in DOM
        requestAnimationFrame(() => {
            if (window.currentFormEditor) {
                console.log('[Debug] Cleaning up existing form editor instance');
                window.currentFormEditor.destroy?.();
            }

            console.log('[Debug] Creating new form editor instance with config:', {
                containerId: editorId,
                schemaUrl: this.schema?.url || '/js/schemas/entity.json'
            });

            const formEditor = new JsonFormEditor({
                containerId: editorId,
                initialValue: JSON.stringify(entity, null, 2),
                height: '100%', // Use full height of container
                formConfig: {
                    schemaUrl: this.schema?.url || '/js/schemas/entity.json',
                    autoValidate: true,
                    reuseDom: true
                }
            });

            window.currentFormEditor = formEditor;
            console.log('[Debug] Form editor initialized and stored in window.currentFormEditor');

            formEditor.onSave = async (updatedData) => {
                console.log('[Debug] Form editor save handler called with data:', updatedData);
                try {
                    const client = new OrionLDClient();
                    await client.replaceEntity(entity.id, updatedData);
                    console.log('[Debug] Entity updated successfully');
                    modal.remove();
                    this.updateDisplay();
                    this.showValidationMessage('Entity updated successfully', true);
                } catch (error) {
                    console.error('[Debug] Error updating entity:', error);
                    this.showValidationMessage(`Error updating entity: ${error.message}`, false);
                }
            };
        });

        // Handle escape key to close modal and cleanup
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                window.currentFormEditor?.destroy?.();
                window.currentFormEditor = null;
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Handle click outside modal to close and cleanup
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                window.currentFormEditor?.destroy?.();
                window.currentFormEditor = null;
            }
        });
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

    /**
     * Clear selection state
     */
    clearSelection() {
        this.selectedRows.clear();
        this.selectedColumns.clear();
        this.updateSelectionUI();
        this.updateDeleteButtonVisibility();
    }

    /**
     * Update selection UI
     */
    updateSelectionUI() {
        const table = this.tableContainer.querySelector('table');
        if (!table) return;

        // Update row checkboxes
        table.querySelectorAll('tbody input[type="checkbox"]').forEach((checkbox, index) => {
            checkbox.checked = this.selectedRows.has(index);
        });

        // Update column checkboxes
        table.querySelectorAll('thead input[type="checkbox"]').forEach((checkbox, index) => {
            checkbox.checked = this.selectedColumns.has(index);
        });

        // Update rows highlighting
        table.querySelectorAll('tbody tr').forEach((row, index) => {
            row.classList.toggle('selected', this.selectedRows.has(index));
        });
    }

    /**
     * Update delete button visibility
     */
    updateDeleteButtonVisibility() {
        const deleteButton = this.toolbar.querySelector('.delete-button');
        if (!deleteButton) return;

        if (this.selectedRows.size > 0 || this.selectedColumns.size > 0) {
            deleteButton.style.display = 'block';
        } else {
            deleteButton.style.display = 'none';
        }
    }

    /**
     * Handle delete action
     */
    async handleDelete() {
        const data = this.getValue(true);
        if (!Array.isArray(data)) return;

        const selectedIndexes = Array.from(this.selectedRows).sort();
        if (selectedIndexes.length === 0) return;

        if (!confirm(`Are you sure you want to delete ${selectedIndexes.length} selected entities? This action cannot be undone.`)) {
            return;
        }

        const client = new OrionLDClient();
        const table = this.tableContainer.querySelector('table tbody');
        const rows = table.querySelectorAll('tr');

        // Process deletions one by one
        for (const index of selectedIndexes) {
            const entity = data[index];
            if (!entity || !entity.id) continue;

            try {
                // Delete the entity from the backend
                await client.deleteEntity(entity.id);
                
                // Remove the row from the table
                if (rows[index]) {
                    rows[index].remove();
                }
                
                // Log success
                console.log(`Successfully deleted entity: ${entity.id}`);
                appendToLogs(`Successfully deleted entity: ${entity.id}`);
            } catch (error) {
                console.error(`Failed to delete entity ${entity.id}:`, error);
                appendToLogs(`Error deleting entity ${entity.id}: ${error.message}`);
                // Continue with next deletion even if one fails
            }
        }

        // Clear selection state
        this.clearSelection();
        
        // Update the underlying JSON data
        const remainingData = data.filter((_, index) => !this.selectedRows.has(index));
        this.setValue(JSON.stringify(remainingData, null, 2));
        
        // Update the display
        this.updateDisplay();
    }
}

// Add module exports
window.JsonTableEditor = JsonTableEditor;
export { JsonTableEditor };