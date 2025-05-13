/**
 * JsonTableEditor extends JsonEditor to provide tabular view for JSON arrays
 * This editor displays array data in a table format while maintaining JSON editing capabilities
 */

import JsonEditor from './jsonEditor.js';

class JsonTableEditor extends JsonEditor {
    constructor(config) {
        super(config);
        this.viewMode = 'table'; // Default to table view for arrays
        this.createTableContainer();
    }

    /**
     * Create the table container for tabular display
     */
    createTableContainer() {
        this.tableContainer = document.createElement('div');
        this.tableContainer.className = 'json-table-container';
        this.tableContainer.style.display = 'none';
        this.tableContainer.style.width = '100%';
        this.tableContainer.style.height = '100%';
        this.tableContainer.style.overflow = 'auto';
        this.tableContainer.style.padding = '8px';
        this.editingArea.appendChild(this.tableContainer);

        // Add view toggle button to toolbar
        if (this.showToolbar) {
            const viewToggleButton = document.createElement('button');
            viewToggleButton.title = 'Toggle Table/JSON View';
            viewToggleButton.innerHTML = '<i class="fas fa-table"></i>';
            viewToggleButton.style.marginLeft = '8px';
            this.toolbar.insertBefore(viewToggleButton, this.toolbar.firstChild);

            viewToggleButton.addEventListener('click', () => this.toggleView());
        }
    }

    /**
     * Toggle between table and JSON view
     */
    toggleView() {
        this.viewMode = this.viewMode === 'table' ? 'json' : 'table';
        this.updateDisplay();
    }

    /**
     * Override updateDisplay to handle both JSON and table views
     */
    updateDisplay = () => {
        if (this.viewMode === 'table') {
            try {
                const data = this.getValue(true);
                if (Array.isArray(data)) {
                    this.displayTable(data);
                    this.editorWrapper.style.display = 'none';
                    this.tableContainer.style.display = 'block';
                    return;
                }
            } catch (e) {
                console.warn('Error displaying table view:', e);
            }
            // Fallback to JSON view if data is not an array or there's an error
            this.viewMode = 'json';
        }

        // Show JSON view
        this.editorWrapper.style.display = 'block';
        this.tableContainer.style.display = 'none';
        super.updateDisplay();
    }

    /**
     * Display data in table format
     * @param {Array} data Array of objects to display in table
     */
    displayTable(data) {
        if (!Array.isArray(data) || data.length === 0) {
            this.tableContainer.innerHTML = '<div class="empty-table">No data to display</div>';
            return;
        }

        // Get all unique columns from the data
        const columns = new Set();
        data.forEach(item => {
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

        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        columns.forEach(column => {
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
        data.forEach((item, index) => {
            const row = document.createElement('tr');
            row.style.backgroundColor = index % 2 === 0 ? '#f8f9fa' : 'white';
            
            columns.forEach(column => {
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

        // Clear and update table container
        this.tableContainer.innerHTML = '';
        this.tableContainer.appendChild(table);
    }

    /**
     * Override getValue to handle table view updates
     */
    getValue(parseJson = false) {
        const value = super.getValue(parseJson);
        if (this.viewMode === 'table' && parseJson && Array.isArray(value)) {
            // Ensure table view is updated when getting value
            this.displayTable(value);
        }
        return value;
    }
}

// Add module exports
window.JsonTableEditor = JsonTableEditor;
export { JsonTableEditor };