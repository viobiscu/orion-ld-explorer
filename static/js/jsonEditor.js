/**
 * Unified JSON Editor Component
 * This provides a consistent, syntax-highlighted, editable JSON editor
 * that can be used across the entire application.
 */

class JsonEditor {
    /**
     * Initialize a JSON editor with the given configuration
     * @param {Object} config Configuration options
     * @param {string} config.containerId ID of the container element for the editor
     * @param {string} [config.initialValue] Initial JSON string value
     * @param {number} [config.height=300] Height of the editor in pixels
     * @param {boolean} [config.resize=true] Whether the editor should be resizable
     * @param {boolean} [config.showToolbar=true] Whether to show the toolbar
     * @param {boolean} [config.showLineNumbers=false] Whether to show line numbers
     * @param {Function} [config.onChange] Callback when content changes
     * @param {Function} [config.onSave] Callback when content is saved/formatted
     * @param {Object} [config.schema] JSON Schema for validation
     * @param {string} [config.operation] HTTP operation (GET, POST, PATCH, PUT, DELETE)
     * @param {Function} [config.onApiOperation] Callback when API operation button is clicked
     * @param {string} [config.entityTemplate] Template JSON for entity operations
     * @param {string} [config.entityId] Entity ID for operations
     * @param {boolean} [config.allowEntityIdEdit=true] Whether entity ID can be edited
     */
    constructor(config) {
        console.log('JsonEditor constructor called with config:', config);
        this.containerId = config.containerId;
        this.container = document.getElementById(this.containerId);
        
        if (!this.container) {
            console.error(`Container element with ID "${this.containerId}" not found`);
            return;
        }
        
        this.height = config.height || 300;
        this.resizable = config.resize !== false;
        this.showToolbar = config.showToolbar !== false;
        this.lineNumbersEnabled = config.showLineNumbers || false;
        this.onChange = config.onChange || (() => {});
        this.onSave = config.onSave || (() => {});
        this.coloringEnabled = true;
        this.viewMode = 'json'; // 'json' or 'table'
        this.schema = config.schema || null; // Store the schema for validation
        this.debounceTimeoutId = null;
        this.MAX_VALIDATABLE_SIZE = 500000; // Similar to svelte-jsoneditor
        
        // API operation related
        this.operation = config.operation || null; // GET, POST, PATCH, PUT, DELETE
        this.onApiOperation = config.onApiOperation || (() => {});
        this.entityTemplate = config.entityTemplate || null;
        this.entityId = config.entityId || '';
        this.allowEntityIdEdit = config.allowEntityIdEdit !== false;
        
        // Network status tracking
        this.isOnline = navigator.onLine;
        this.setupNetworkListeners();
        
        // Create the editor structure
        this.createEditorElements();
        
        // Set initial value if provided
        if (config.initialValue) {
            this.setValue(config.initialValue);
        } else if (this.entityTemplate && (this.operation === 'PATCH' || this.operation === 'PUT')) {
            // For PATCH or PUT operations, initialize with the template
            this.setValue(this.entityTemplate);
        }
        
        // Set up event handlers
        this.setupEventHandlers();
        console.log('JsonEditor base class initialization complete');
    }

    /**
     * Create the editor structure
     */
    createEditorElements() {
        // Create the main editor container
        this.editorContainer = document.createElement('div');
        this.editorContainer.className = 'json-editor-container';
        this.editorContainer.style.width = '100%';
        this.editorContainer.style.height = this.height + 'px';
        this.editorContainer.style.border = '1px solid #ccc';
        this.editorContainer.style.borderRadius = '4px';
        this.editorContainer.style.overflow = 'hidden';
        
        // Make the editor resizable if configured
        if (this.resizable) {
            this.editorContainer.style.resize = 'vertical';
        }
        
        // Create toolbar if enabled
        if (this.showToolbar) {
            this.toolbar = document.createElement('div');
            this.toolbar.className = 'json-editor-toolbar';
            this.toolbar.style.borderBottom = '1px solid #ddd';
            this.toolbar.style.padding = '5px';
            this.toolbar.style.backgroundColor = '#f8f8f8';
            this.toolbar.style.display = 'flex';
            this.toolbar.style.alignItems = 'center';
            
            // Create buttons
            this.createToolbarButtons();
            
            // Create log container for validation messages
            this.logContainer = document.createElement('div');
            this.logContainer.className = 'json-editor-log';
            this.logContainer.style.marginLeft = '10px';
            this.logContainer.style.padding = '4px 8px';
            this.logContainer.style.fontSize = '12px';
            this.logContainer.style.borderRadius = '4px';
            this.logContainer.style.display = 'none';
            this.logContainer.style.flexGrow = '1';
            this.toolbar.appendChild(this.logContainer);
            
            this.editorContainer.appendChild(this.toolbar);
        }
        
        // Create editing area container to position editor and line numbers properly
        this.editingArea = document.createElement('div');
        this.editingArea.className = 'json-editor-editing-area';
        this.editingArea.style.position = 'relative';
        this.editingArea.style.height = this.showToolbar ? 'calc(100% - 36px)' : '100%'; // Subtract toolbar height
        this.editorContainer.appendChild(this.editingArea);
        
        // Create line numbers container if enabled
        if (this.lineNumbersEnabled) {
            this.lineNumbersContainer = document.createElement('div');
            this.lineNumbersContainer.className = 'json-editor-line-numbers';
            this.lineNumbersContainer.style.position = 'absolute';
            this.lineNumbersContainer.style.top = '0';
            this.lineNumbersContainer.style.left = '0';
            this.lineNumbersContainer.style.width = '40px';
            this.lineNumbersContainer.style.height = '100%';
            this.lineNumbersContainer.style.backgroundColor = '#f5f5f5';
            this.lineNumbersContainer.style.borderRight = '1px solid #ddd';
            this.lineNumbersContainer.style.overflow = 'hidden';
            this.lineNumbersContainer.style.color = '#999';
            this.lineNumbersContainer.style.fontFamily = 'monospace';
            this.lineNumbersContainer.style.fontSize = '12px';
            this.lineNumbersContainer.style.userSelect = 'none';
            this.lineNumbersContainer.style.zIndex = '2';
            this.editingArea.appendChild(this.lineNumbersContainer);
        }
        
        // Create main editor wrapper
        this.editorWrapper = document.createElement('div');
        this.editorWrapper.className = 'json-editor-wrapper';
        this.editorWrapper.style.position = 'relative';
        this.editorWrapper.style.height = '100%';
        this.editorWrapper.style.paddingLeft = this.lineNumbersEnabled ? '40px' : '0';
        this.editorWrapper.style.boxSizing = 'border-box';
        
        // Create textarea for input
        this.textarea = document.createElement('textarea');
        this.textarea.className = 'json-editor-textarea';
        this.textarea.style.width = '100%';
        this.textarea.style.height = '100%';
        this.textarea.style.border = 'none';
        this.textarea.style.resize = 'none';
        this.textarea.style.outline = 'none';
        this.textarea.style.fontFamily = 'monospace';
        this.textarea.style.fontSize = '13px';
        this.textarea.style.padding = '8px';
        this.textarea.style.margin = '0';
        this.textarea.style.backgroundColor = 'transparent';
        this.textarea.style.position = 'absolute';
        this.textarea.style.top = '0';
        this.textarea.style.left = '0';
        this.textarea.style.color = 'transparent';
        this.textarea.style.caretColor = '#000';
        this.textarea.style.whiteSpace = 'pre-wrap';
        this.textarea.style.overflow = 'auto';
        this.textarea.style.zIndex = '1';
        this.textarea.spellcheck = false;
        
        // Create pre element for syntax highlighting
        this.displayContainer = document.createElement('pre');
        this.displayContainer.className = 'json-editor-display-container';
        this.displayContainer.style.width = '100%';
        this.displayContainer.style.height = '100%';
        this.displayContainer.style.margin = '0';
        this.displayContainer.style.padding = '8px';
        this.displayContainer.style.fontFamily = 'monospace';
        this.displayContainer.style.fontSize = '13px';
        this.displayContainer.style.backgroundColor = 'transparent';
        this.displayContainer.style.whiteSpace = 'pre-wrap';
        this.displayContainer.style.wordWrap = 'break-word';
        this.displayContainer.style.overflow = 'hidden';
        this.displayContainer.style.position = 'absolute';
        this.displayContainer.style.top = '0';
        this.displayContainer.style.left = '0';
        this.displayContainer.style.pointerEvents = 'none';
        
        // Create code element for syntax highlighting
        this.displayCode = document.createElement('code');
        this.displayCode.className = 'language-json';
        this.displayContainer.appendChild(this.displayCode);
        
        // Add elements to DOM
        this.editorWrapper.appendChild(this.textarea);
        this.editorWrapper.appendChild(this.displayContainer);
        this.editingArea.appendChild(this.editorWrapper);
        
        this.container.appendChild(this.editorContainer);
    }
    
    /**
     * Create toolbar buttons
     */
    createToolbarButtons() {
        // Button style utility
        const buttonStyle = (button) => {
            button.style.backgroundColor = 'transparent';
            button.style.border = '1px solid #ccc';
            button.style.borderRadius = '3px';
            button.style.padding = '4px 8px';
            button.style.margin = '0 3px';
            button.style.fontSize = '12px';
            button.style.cursor = 'pointer';
            button.style.display = 'flex';
            button.style.alignItems = 'center';
            button.style.justifyContent = 'center';
            button.style.outline = 'none';
            button.style.minWidth = '28px';
            button.style.height = '28px';
            
            button.addEventListener('mouseover', () => button.style.backgroundColor = '#f0f0f0');
            button.addEventListener('mouseout', () => button.style.backgroundColor = 'transparent');
        };
        
        // Operation button style utility with colors
        const operationButtonStyle = (button, color) => {
            buttonStyle(button);
            button.style.backgroundColor = color;
            button.style.color = 'white';
            button.style.border = 'none';
            button.style.fontWeight = 'bold';
            button.style.minWidth = '60px';
            
            button.addEventListener('mouseover', () => {
                button.style.backgroundColor = shadeColor(color, -10); // Darken on hover
            });
            button.addEventListener('mouseout', () => {
                button.style.backgroundColor = color;
            });
        };
        
        // Function to shade a color (darken or lighten)
        const shadeColor = (color, percent) => {
            let R = parseInt(color.substring(1,3), 16);
            let G = parseInt(color.substring(3,5), 16);
            let B = parseInt(color.substring(5,7), 16);

            R = parseInt(R * (100 + percent) / 100);
            G = parseInt(G * (100 + percent) / 100);
            B = parseInt(B * (100 + percent) / 100);

            R = (R < 255) ? R : 255;  
            G = (G < 255) ? G : 255;  
            B = (B < 255) ? B : 255;  

            R = Math.max(0, R).toString(16).padStart(2, '0');
            G = Math.max(0, G).toString(16).padStart(2, '0');
            B = Math.max(0, B).toString(16).padStart(2, '0');

            return `#${R}${G}${B}`;
        };
        
        // Create icon element
        const createIcon = (className) => {
            const icon = document.createElement('i');
            icon.className = className;
            return icon;
        };
        
        // Create validate button
        this.validateButton = document.createElement('button');
        this.validateButton.title = 'Validate JSON';
        this.validateButton.appendChild(createIcon('fas fa-check'));
        buttonStyle(this.validateButton);
        this.toolbar.appendChild(this.validateButton);
        
        // Create format button
        this.formatButton = document.createElement('button');
        this.formatButton.title = 'Format JSON';
        this.formatButton.appendChild(createIcon('fas fa-indent'));
        buttonStyle(this.formatButton);
        this.toolbar.appendChild(this.formatButton);
        
        // Create line numbers toggle button
        this.lineNumbersButton = document.createElement('button');
        this.lineNumbersButton.title = this.lineNumbersEnabled ? 'Hide line numbers' : 'Show line numbers';
        this.lineNumbersButton.appendChild(createIcon(this.lineNumbersEnabled ? 'fas fa-list-ol fa-flip-horizontal' : 'fas fa-list-ol fa-flip-horizontal'));
        buttonStyle(this.lineNumbersButton);
        this.toolbar.appendChild(this.lineNumbersButton);
        
        // Create coloring toggle button
        this.coloringButton = document.createElement('button');
        this.coloringButton.title = 'Toggle syntax highlighting';
        this.coloringButton.appendChild(createIcon('fas fa-palette'));
        buttonStyle(this.coloringButton);
        this.toolbar.appendChild(this.coloringButton);
        
        // Create separator for API operation buttons
        const apiSeparator = document.createElement('div');
        apiSeparator.style.borderLeft = '1px solid #ccc';
        apiSeparator.style.height = '20px';
        apiSeparator.style.margin = '0 8px';
        this.toolbar.appendChild(apiSeparator);
        
        // Create API operation UI based on operation type
        if (this.operation) {
            this.operation = this.operation.toUpperCase();
            
            // Add Entity ID input for GET, PATCH, PUT operations
            if (['GET', 'PATCH', 'PUT'].includes(this.operation)) {
                // Create entity ID section
                const entityIdSection = document.createElement('div');
                entityIdSection.style.display = 'flex';
                entityIdSection.style.alignItems = 'center';
                entityIdSection.style.marginRight = '10px';
                
                // Entity ID input
                const entityIdInput = document.createElement('input');
                entityIdInput.type = 'text';
                entityIdInput.placeholder = 'Entity ID';
                entityIdInput.value = this.entityId || '';
                entityIdInput.style.padding = '4px 8px';
                entityIdInput.style.borderRadius = '3px';
                entityIdInput.style.border = '1px solid #ccc';
                entityIdInput.style.width = '250px';
                entityIdInput.disabled = !this.allowEntityIdEdit;
                
                // Store reference to entity ID input
                this.entityIdInput = entityIdInput;
                
                // Add input to section
                entityIdSection.appendChild(entityIdInput);
                
                // Add section to toolbar
                this.toolbar.appendChild(entityIdSection);
            }
            
            // Create appropriate operation button(s)
            if (this.operation === 'GET') {
                // GET Button (green)
                this.getButton = document.createElement('button');
                this.getButton.textContent = 'GET';
                this.getButton.title = 'Fetch entity by ID';
                operationButtonStyle(this.getButton, '#5cb85c'); // Green
                this.toolbar.appendChild(this.getButton);
            }
            else if (this.operation === 'POST') {
                // POST Button (blue)
                this.postButton = document.createElement('button');
                this.postButton.textContent = 'POST';
                this.postButton.title = 'Create new entity';
                operationButtonStyle(this.postButton, '#337ab7'); // Blue
                this.toolbar.appendChild(this.postButton);
            }
            else if (this.operation === 'PATCH') {
                // GET Button for PATCH (green)
                this.getButton = document.createElement('button');
                this.getButton.textContent = 'GET';
                this.getButton.title = 'Fetch entity by ID';
                operationButtonStyle(this.getButton, '#5cb85c'); // Green
                this.toolbar.appendChild(this.getButton);
                
                // PATCH Button (orange)
                this.patchButton = document.createElement('button');
                this.patchButton.textContent = 'PATCH';
                this.patchButton.title = 'Update entity properties';
                operationButtonStyle(this.patchButton, '#f0ad4e'); // Orange
                this.toolbar.appendChild(this.patchButton);
            }
            else if (this.operation === 'PUT') {
                // GET Button for PUT (green)
                this.getButton = document.createElement('button');
                this.getButton.textContent = 'GET';
                this.getButton.title = 'Fetch entity by ID';
                operationButtonStyle(this.getButton, '#5cb85c'); // Green
                this.toolbar.appendChild(this.getButton);
                
                // PUT Button (blue)
                this.putButton = document.createElement('button');
                this.putButton.textContent = 'PUT';
                this.putButton.title = 'Replace entity';
                operationButtonStyle(this.putButton, '#5bc0de'); // Light blue
                this.toolbar.appendChild(this.putButton);
            }
        }
        
        // Create separator for NGSI-LD specific buttons
        const separator = document.createElement('div');
        separator.style.borderLeft = '1px solid #ccc';
        separator.style.height = '20px';
        separator.style.margin = '0 8px';
        this.toolbar.appendChild(separator);
        
        // Create insert attribute button for Orion-LD
        this.insertAttributeButton = document.createElement('button');
        this.insertAttributeButton.title = 'Insert NGSI-LD Attribute';
        this.insertAttributeButton.appendChild(createIcon('fas fa-plus-circle'));
        const attrSpan = document.createElement('span');
        attrSpan.textContent = ' Attribute';
        attrSpan.style.marginLeft = '4px';
        this.insertAttributeButton.appendChild(attrSpan);
        buttonStyle(this.insertAttributeButton);
        this.insertAttributeButton.style.minWidth = 'auto';
        this.toolbar.appendChild(this.insertAttributeButton);
        
        // Create insert relationship button for Orion-LD
        this.insertRelationshipButton = document.createElement('button');
        this.insertRelationshipButton.title = 'Insert NGSI-LD Relationship';
        this.insertRelationshipButton.appendChild(createIcon('fas fa-link'));
        const relSpan = document.createElement('span');
        relSpan.textContent = ' Relationship';
        relSpan.style.marginLeft = '4px';
        this.insertRelationshipButton.appendChild(relSpan);
        buttonStyle(this.insertRelationshipButton);
        this.insertRelationshipButton.style.minWidth = 'auto';
        this.toolbar.appendChild(this.insertRelationshipButton);
        
        // Create insert context button for Orion-LD
        this.insertContextButton = document.createElement('button');
        this.insertContextButton.title = 'Insert NGSI-LD Context';
        this.insertContextButton.appendChild(createIcon('fas fa-sitemap'));
        const contextSpan = document.createElement('span');
        contextSpan.textContent = ' Context';
        contextSpan.style.marginLeft = '4px';
        this.insertContextButton.appendChild(contextSpan);
        buttonStyle(this.insertContextButton);
        this.insertContextButton.style.minWidth = 'auto';
        this.toolbar.appendChild(this.insertContextButton);
    }
    
    /**
     * Update the display (syntax highlighting) based on the textarea content 
     */
    updateDisplay = () => {
        const value = this.textarea.value;
        let coloredContent = '';
        
        if (value.trim() === '') {
            this.displayCode.innerHTML = '';
            return;
        }
        
        try {
            // If syntax highlighting library is available (like Prism.js or highlight.js),
            // use it for better highlighting
            if (window.Prism && typeof Prism.highlight === 'function') {
                coloredContent = Prism.highlight(value, Prism.languages.json, 'json');
            } else if (window.hljs && typeof hljs.highlight === 'function') {
                const result = hljs.highlight(value, { language: 'json' });
                coloredContent = result.value;
            } else {
                // Simple own implementation of syntax highlighting
                coloredContent = this.basicJsonHighlight(value);
            }
        } catch (e) {
            console.warn('Error during syntax highlighting:', e);
            coloredContent = this.escapeHtml(value);
        }
        
        this.displayCode.innerHTML = coloredContent;
        
        // Update line numbers
        if (this.lineNumbersEnabled) {
            this.updateLineNumbers();
        }
    }
    
    /**
     * Basic JSON syntax highlighting with regex
     * Used as a fallback when no syntax highlighting library is available
     * @param {string} json The JSON string to highlight
     * @returns {string} HTML with syntax highlighting
     */
    basicJsonHighlight(json) {
        // Escape HTML first
        const escaped = this.escapeHtml(json);
        
        // Apply color to string values - "..."
        let highlighted = escaped.replace(/"([^"\\]*(\\.[^"\\]*)*)"(?=\s*:)/g, '<span style="color:#9c27b0;">"$1"</span>'); // Key
        highlighted = highlighted.replace(/:(?=\s*)"([^"\\]*(\\.[^"\\]*)*)"(?=[\s,}\]\n])/g, ': <span style="color:#0d47a1;">"$1"</span>'); // Value
        
        // Apply color to numbers
        highlighted = highlighted.replace(/([^":\w])(\-?\d+(\.\d+)?(?=[,\s\]\}]))/g, '$1<span style="color:#f57c00;">$2</span>');
        
        // Apply color to booleans and null
        highlighted = highlighted.replace(/(?<!["-])(true|false|null)(?![\w"-])/g, '<span style="color:#2e7d32;">$1</span>');
        
        // Apply color to brackets and braces
        highlighted = highlighted.replace(/([{}\[\]])/g, '<span style="color:#616161;">$1</span>');
        
        return highlighted;
    }
    
    /**
     * Escape HTML special characters
     * @param {string} html The HTML string to escape
     * @returns {string} The escaped HTML string
     */
    escapeHtml(html) {
        return html
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    /**
     * Set up event handlers for the editor
     */
    setupEventHandlers() {
        // Synchronize scrolling between textarea and display
        this.textarea.addEventListener('scroll', this.synchronizeScrolling);
        
        // Textarea content changes
        this.textarea.addEventListener('input', this.handleInput);
        
        // Handle tab key
        this.textarea.addEventListener('keydown', this.handleKeyDown);
        
        // Add double-click handler to select text between quotes
        this.textarea.addEventListener('dblclick', this.handleDoubleClick);
        
        // When textarea loses focus, reformat JSON
        this.textarea.addEventListener('blur', () => this.formatJson());
        
        // Toolbar button click handlers
        if (this.showToolbar) {
            this.validateButton.addEventListener('click', this.validateJson);
            this.formatButton.addEventListener('click', this.prettifyJson);
            this.lineNumbersButton.addEventListener('click', this.toggleLineNumbers);
            this.coloringButton.addEventListener('click', this.toggleColoring);
            
            // Add handlers for API operation buttons
            if (this.operation) {
                if (this.getButton) {
                    this.getButton.addEventListener('click', this.handleGetOperation);
                }
                if (this.postButton) {
                    this.postButton.addEventListener('click', this.handlePostOperation);
                }
                if (this.putButton) {
                    this.putButton.addEventListener('click', this.handlePutOperation);
                }
                if (this.patchButton) {
                    this.patchButton.addEventListener('click', this.handlePatchOperation);
                }
                if (this.deleteButton) {
                    this.deleteButton.addEventListener('click', this.handleDeleteOperation);
                }
            }
            
            // Add handlers for Orion-LD specific buttons
            this.insertAttributeButton.addEventListener('click', this.insertNGSIAttribute);
            this.insertRelationshipButton.addEventListener('click', this.insertNGSIRelationship);
            this.insertContextButton.addEventListener('click', this.insertNGSIContext);
        }
        
        // Window resize handler for editor resizing
        window.addEventListener('resize', this.handleResize);
        
        // Handle editor container resizing
        if (this.resizable) {
            this.editorContainer.addEventListener('mouseup', this.handleResize);
        }
    }
    
    /**
     * Synchronize scrolling between textarea and display elements
     */
    synchronizeScrolling = () => {
        this.displayContainer.scrollTop = this.textarea.scrollTop;
        this.displayContainer.scrollLeft = this.textarea.scrollLeft;
        
        // If line numbers are enabled, update their scroll position too
        if (this.lineNumbersEnabled && this.lineNumbersContainer) {
            this.lineNumbersContainer.scrollTop = this.textarea.scrollTop;
        }
    }
    
    /**
     * Handle input event on textarea
     */
    handleInput = () => {
        this.updateDisplay();
        
        // Add debounce for validation on input
        clearTimeout(this.debounceTimeoutId);
        this.debounceTimeoutId = setTimeout(() => {
            this.onChange(this.getValue());
        }, 300);
    }
    
    /**
     * Handle keydown event (for tab key behavior)
     * @param {KeyboardEvent} e The keydown event
     */
    handleKeyDown = (e) => {
        // Handle tab key for indentation
        if (e.key === 'Tab') {
            e.preventDefault();
            
            const start = this.textarea.selectionStart;
            const end = this.textarea.selectionEnd;
            
            // Insert tab character (or 2 spaces)
            const spaces = '  ';
            this.textarea.value = this.textarea.value.substring(0, start) + spaces + this.textarea.value.substring(end);
            
            // Set cursor position after the inserted tab
            this.textarea.selectionStart = this.textarea.selectionEnd = start + spaces.length;
            
            // Update syntax highlighting
            this.updateDisplay();
        }
        
        // Handle save shortcut (Ctrl+S or Cmd+S)
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            this.prettifyJson();
            
            // Call onSave callback
            if (typeof this.onSave === 'function') {
                this.onSave(this.getValue());
            }
        }
    }
    
    /**
     * Handle double-click event to select text between quotes
     * @param {MouseEvent} e The double-click event
     */
    handleDoubleClick = (e) => {
        const value = this.textarea.value;
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;

        // Find the nearest quotes around the cursor position
        const before = value.lastIndexOf('"', start - 1);
        const after = value.indexOf('"', end);

        if (before !== -1 && after !== -1) {
            this.textarea.selectionStart = before + 1;
            this.textarea.selectionEnd = after;
        }
    }
    
    /**
     * Handle resize events (window or editor container)
     */
    handleResize = () => {
        // Update display and line numbers after resize
        this.updateDisplay();
        
        // Adjust editor height to match container
        if (this.editorContainer && this.editorContainer.parentElement) {
            const parentHeight = this.editorContainer.parentElement.clientHeight;
            if (parentHeight > 0) {
                this.editorContainer.style.height = `${parentHeight}px`;
            }
        }
    }
    
    /**
     * Toggle line numbers visibility
     */
    toggleLineNumbers = () => {
        this.lineNumbersEnabled = !this.lineNumbersEnabled;
        
        // Update button icon
        if (this.lineNumbersButton) {
            // Remove previous icon
            while (this.lineNumbersButton.firstChild) {
                this.lineNumbersButton.removeChild(this.lineNumbersButton.firstChild);
            }
            
            // Create new icon based on current state
            const icon = document.createElement('i');
            icon.className = this.lineNumbersEnabled ? 'fas fa-list-ol fa-flip-horizontal' : 'fas fa-list-ol fa-flip-horizontal';
            
            // Add icon to button
            this.lineNumbersButton.appendChild(icon);
            this.lineNumbersButton.title = this.lineNumbersEnabled ? 'Hide line numbers' : 'Show line numbers';
        }
        
        // Create line numbers container if it doesn't exist
        if (this.lineNumbersEnabled && !this.lineNumbersContainer) {
            this.lineNumbersContainer = document.createElement('div');
            this.lineNumbersContainer.className = 'json-editor-line-numbers';
            this.lineNumbersContainer.style.position = 'absolute';
            this.lineNumbersContainer.style.top = '8px';
            this.lineNumbersContainer.style.left = '0';
            this.lineNumbersContainer.style.width = '40px';
            this.lineNumbersContainer.style.height = '100%';
            this.lineNumbersContainer.style.backgroundColor = '#f5f5f5';
            this.lineNumbersContainer.style.borderRight = '1px solid #ddd';
            this.lineNumbersContainer.style.overflow = 'hidden';
            this.lineNumbersContainer.style.color = '#999';
            this.lineNumbersContainer.style.fontFamily = 'monospace';
            this.lineNumbersContainer.style.fontSize = '12px';
            this.lineNumbersContainer.style.userSelect = 'none';
            this.lineNumbersContainer.style.zIndex = '2';
            this.editingArea.appendChild(this.lineNumbersContainer);
        }
        
        // Show/hide line numbers container
        if (this.lineNumbersContainer) {
            this.lineNumbersContainer.style.display = this.lineNumbersEnabled ? 'block' : 'none';
        }
        
        // Adjust editor wrapper padding to prevent content hiding behind line numbers
        this.editorWrapper.style.paddingLeft = this.lineNumbersEnabled ? '40px' : '0';
        
        // Also adjust the textarea and display container to ensure text starts after line numbers
        if (this.lineNumbersEnabled) {
            this.textarea.style.width = 'calc(100% - 40px)';  // Full width of the wrapper (which already has padding)
            this.textarea.style.left = '40px';
            this.displayContainer.style.width = 'calc(100% - 40px)';
            this.displayContainer.style.left = '40px';
        } else {
            this.textarea.style.width = '100%';
            this.textarea.style.left = '0';
            this.displayContainer.style.width = '100%';
            this.displayContainer.style.left = '0';
        }
        
        // Update line numbers
        if (this.lineNumbersEnabled) {
            this.updateLineNumbers();
        }
    }

    /**
     * Update line numbers container with current line numbers
     * and ensure they align with the text content properly
     */
    updateLineNumbers = () => {
        if (!this.lineNumbersEnabled || !this.lineNumbersContainer) {
            return;
        }
        
        const text = this.textarea.value;
        const lines = text.split('\n');
        const lineCount = lines.length;
        
        // Clear previous line numbers
        this.lineNumbersContainer.innerHTML = '';
        
        // Create a fragment to improve performance
        const fragment = document.createDocumentFragment();
        
        // Calculate approximate line height (can vary based on text content)
        const baseLineHeight = parseInt(getComputedStyle(this.textarea).fontSize, 10) * 1.2;
        
        // Create each line number element
        for (let i = 0; i < lineCount; i++) {
            const lineNumberElement = document.createElement('div');
            lineNumberElement.textContent = i + 1;
            lineNumberElement.style.padding = '0 8px';
            
            // Calculate line height based on content
            // Long lines that wrap will take more vertical space
            const lineContent = lines[i];
            const lineWidth = this.displayContainer.clientWidth - 16; // Subtract padding
            const textWidth = this.getTextWidth(lineContent);
            const wrappedLines = Math.max(1, Math.ceil(textWidth / lineWidth));
            
            // Set height based on number of wrapped lines
            lineNumberElement.style.height = (baseLineHeight * wrappedLines) + 'px';
            lineNumberElement.style.display = 'flex';
            lineNumberElement.style.alignItems = 'flex-start'; // Align to top of line
            lineNumberElement.style.justifyContent = 'flex-end'; // Right align text
            lineNumberElement.style.paddingTop = '0';
            
            fragment.appendChild(lineNumberElement);
        }
        
        this.lineNumbersContainer.appendChild(fragment);
    }
    
    /**
     * Estimate text width in pixels (for line wrapping calculation)
     * @param {string} text The text to measure
     * @returns {number} Estimated width in pixels
     */
    getTextWidth(text) {
        if (!text) return 0;
        
        // Use canvas for measuring text width
        const canvas = this.getTextWidth.canvas || (this.getTextWidth.canvas = document.createElement('canvas'));
        const context = canvas.getContext('2d');
        
        // Match the font of the editor
        context.font = getComputedStyle(this.textarea).font;
        
        return context.measureText(text).width;
    }

    /**
     * Toggle syntax highlighting
     */
    toggleColoring = () => {
        this.syntaxColoringEnabled = !this.syntaxColoringEnabled;
        
        if (this.syntaxColoringEnabled) {
            this.updateDisplay();
        } else {
            this.displayCode.innerHTML = this.escapeHtml(this.textarea.value);
        }
    }

    /**
     * Validate JSON content against a schema if provided
     * @param {Object} [schema] Optional schema to validate against (uses the instance schema if not provided)
     * @return {Object} Validation result with isValid and errors properties
     */
    validateJsonAgainstSchema(schema = null) {
        const schemaToUse = schema || this.schema;
        
        if (!schemaToUse) {
            return { isValid: true, errors: [] }; // No schema to validate against
        }
        
        const value = this.getValue(true); // Get parsed value
        
        if (value === null) {
            return { isValid: false, errors: [{ message: 'Invalid JSON format' }] };
        }
        
        // Check if Ajv is available
        if (typeof Ajv !== 'undefined') {
            try {
                const ajv = new Ajv({ allErrors: true });
                const validate = ajv.compile(schemaToUse);
                const valid = validate(value);
                
                if (!valid) {
                    return {
                        isValid: false,
                        errors: validate.errors.map(error => {
                            // Format error path for display
                            const path = error.instancePath || '';
                            const formattedPath = path.replace(/^\//, '').replace(/\//g, '.');
                            
                            return {
                                path: formattedPath,
                                message: error.message,
                                keyword: error.keyword,
                                params: error.params
                            };
                        })
                    };
                }
                
                return { isValid: true, errors: [] };
                
            } catch (error) {
                console.error('Schema validation error:', error);
                return { 
                    isValid: false, 
                    errors: [{ message: `Schema validation error: ${error.message}` }] 
                };
            }
        } else {
            console.warn('Ajv library not available for schema validation');
            return { 
                isValid: true, 
                errors: [{ 
                    message: 'Schema validation skipped (Ajv not available)',
                    isWarning: true 
                }] 
            };
        }
    }
    
    /**
     * Validate JSON content
     * @return {boolean} Whether the JSON is valid
     */
    validateJson = () => {
        const value = this.textarea.value;
        
        if (value.trim() === '') {
            this.showValidationMessage('', true);
            return true;
        }
        
        try {
            // Attempt to parse JSON
            const result = JSON.parse(value);
            
            // If schema is provided, validate against it
            if (this.schema) {
                const schemaValidation = this.validateJsonAgainstSchema();
                
                if (!schemaValidation.isValid) {
                    const errorCount = schemaValidation.errors.length;
                    const firstError = schemaValidation.errors[0];
                    const message = `Schema validation: ${firstError.message}${errorCount > 1 ? ` (and ${errorCount - 1} more errors)` : ''}`;
                    
                    this.showValidationMessage(message, false);
                    
                    // If the error has a path, try to highlight the location
                    if (firstError.path) {
                        this.highlightJsonPath(firstError.path);
                    }
                    
                    return false;
                }
            }
            
            this.showValidationMessage('JSON is valid', true);
            return true;
        } catch (error) {
            // More detailed error reporting, inspired by svelte-jsoneditor
            const errorDetails = this.analyzeJsonError(error, value);
            this.showValidationMessage(`Invalid JSON: ${errorDetails.message} at line ${errorDetails.line}, column ${errorDetails.column}`, false);
            
            // Highlight the error location in the editor
            this.highlightErrorLocation(errorDetails.line, errorDetails.column);
            
            return false;
        }
    }
    
    /**
     * Highlight a location in the JSON based on a JSON path
     * @param {string} path The dot-notation path to the property (e.g., "person.address.city")
     */
    highlightJsonPath(path) {
        if (!path) return;
        
        try {
            const json = JSON.parse(this.textarea.value);
            const pathParts = path.split('.');
            let value = json;
            let found = true;
            
            // Navigate to the object path
            for (const part of pathParts) {
                if (part && value && typeof value === 'object') {
                    value = value[part];
                } else {
                    found = false;
                    break;
                }
            }
            
            if (!found) return;
            
            // Convert the object to string to find where it is in the text
            const valueStr = typeof value === 'object' 
                ? JSON.stringify(value) 
                : String(value);
            
            // Find the position in the text
            const fullText = this.textarea.value;
            
            // We need to handle property names and values
            // Last part of the path is the property name
            const lastPart = pathParts[pathParts.length - 1];
            const propertyPattern = new RegExp(`"${lastPart}"\\s*:\\s*`);
            
            // First try to find the property in the text
            const match = propertyPattern.exec(fullText);
            
            if (match) {
                const propertyPos = match.index;
                // Now find the value position by adding the property name + colon length
                const valuePos = propertyPos + match[0].length;
                
                // Set focus and selection
                this.textarea.focus();
                this.textarea.setSelectionRange(valuePos, valuePos + String(valueStr).length);
                
                // Get line number
                const textBeforePos = fullText.substring(0, valuePos);
                const line = textBeforePos.split('\n').length;
                
                // Scroll to the line
                this.scrollToLine(line);
            }
        } catch (e) {
            console.warn('Error finding JSON path:', e);
        }
    }

    /**
     * Format and validate JSON
     * @return {boolean} Whether the operation succeeded
     */
    prettifyJson = () => {
        const value = this.textarea.value;
        
        if (value.trim() === '') {
            return true;
        }
        
        try {
            const json = JSON.parse(value);
            const formatted = JSON.stringify(json, null, 2);
            
            this.textarea.value = formatted;
            this.updateDisplay();
            this.showValidationMessage('JSON formatted', true);
            
            return true;
        } catch (error) {
            // Don't format if there are errors
            this.validateJson(); // This will show the error message
            return false;
        }
    }

    /**
     * Format the current JSON value (like prettifyJson but doesn't show a message)
     * @return {boolean} Whether the operation succeeded
     */
    formatJson = () => {
        const value = this.textarea.value;
        
        if (value.trim() === '') {
            return true;
        }
        
        try {
            const json = JSON.parse(value);
            const formatted = JSON.stringify(json, null, 2);
            
            if (formatted !== value) {
                this.textarea.value = formatted;
                this.updateDisplay();
            }
            
            return true;
        } catch (error) {
            // Silently fail
            return false;
        }
    }

    /**
     * Analyze a JSON parse error to extract line and column information
     * @param {Error} error The error object from JSON.parse
     * @param {string} jsonString The JSON string that caused the error
     * @return {Object} Object with line, column, and message properties
     */
    analyzeJsonError(error, jsonString) {
        const errorInfo = {
            message: error.message,
            line: 1,
            column: 1
        };
        
        // Extract position from error message (inspired by svelte-jsoneditor's error handling)
        // Example error message: "Unexpected token } in JSON at position 42"
        const positionMatch = error.message.match(/position\s+(\d+)/i);
        
        if (positionMatch) {
            const position = parseInt(positionMatch[1], 10);
            
            // Calculate line and column based on position
            let line = 1;
            let lineStart = 0;
            
            for (let i = 0; i < position; i++) {
                if (jsonString[i] === '\n') {
                    line++;
                    lineStart = i + 1;
                }
            }
            
            const column = position - lineStart + 1;
            
            errorInfo.line = line;
            errorInfo.column = column;
            
            // Provide more context for the error
            const lines = jsonString.split('\n');
            const errorLine = lines[line - 1] || '';
            const context = errorLine.trim();
            const pointer = ' '.repeat(Math.max(0, column - 1)) + '^';
            
            errorInfo.context = context;
            errorInfo.pointer = pointer;
            errorInfo.message = this.formatErrorMessage(error.message, context);
        } else {
            // Try other error formats
            // Chrome-like: "Unexpected token } in JSON at position 42"
            // Firefox-like: "JSON.parse: unexpected character at line 2 column 3 of the JSON data"
            const lineColumnMatch = error.message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
            
            if (lineColumnMatch) {
                errorInfo.line = parseInt(lineColumnMatch[1], 10);
                errorInfo.column = parseInt(lineColumnMatch[2], 10);
                
                // Provide context for the error
                const lines = jsonString.split('\n');
                const errorLine = lines[errorInfo.line - 1] || '';
                const context = errorLine.trim();
                const pointer = ' '.repeat(Math.max(0, errorInfo.column - 1)) + '^';
                
                errorInfo.context = context;
                errorInfo.pointer = pointer;
                errorInfo.message = this.formatErrorMessage(error.message, context);
            }
        }
        
        return errorInfo;
    }
    
    /**
     * Format a friendly error message with context
     * @param {string} errorMessage The original error message
     * @param {string} context The context around the error
     * @return {string} A formatted error message
     */
    formatErrorMessage(errorMessage, context) {
        // Extract the core error type
        let message = errorMessage;
        
        // Simplify common error messages
        if (message.includes('Unexpected token')) {
            message = 'Unexpected character in JSON';
        } else if (message.includes('Unexpected end of JSON')) {
            message = 'JSON ended unexpectedly (missing closing bracket/brace?)';
        } else if (message.includes('Unexpected number')) {
            message = 'Invalid number format';
        } else if (message.includes('Duplicate key')) {
            message = 'Duplicate object key found';
        }
        
        return message;
    }

    /**
     * Show a validation message in the log container
     * @param {string} message The message to show
     * @param {boolean} isSuccess Whether it's a success message
     */
    showValidationMessage(message, isSuccess) {
        if (!this.showToolbar || !this.logContainer) {
            return;
        }
        
        // Update log container style based on status
        this.logContainer.style.backgroundColor = isSuccess ? '#e8f5e9' : '#ffebee';
        this.logContainer.style.color = isSuccess ? '#388e3c' : '#d32f2f';
        this.logContainer.style.display = message ? 'block' : 'none';
        this.logContainer.textContent = message;
        
        // Hide message after a delay
        if (message) {
            clearTimeout(this.logTimeoutId);
            this.logTimeoutId = setTimeout(() => {
                this.logContainer.style.display = 'none';
            }, 5000);
        }
    }

    /**
     * Highlight the error location in the editor
     * @param {number} line The line number (1-based)
     * @param {number} column The column number (1-based)
     */
    highlightErrorLocation(line, column) {
        // Get string position from line and column
        const lines = this.textarea.value.split('\n');
        let position = 0;
        
        for (let i = 0; i < line - 1; i++) {
            position += lines[i].length + 1; // +1 for the newline character
        }
        
        position += column - 1;
        
        // Set selection to the error location
        this.textarea.focus();
        this.textarea.setSelectionRange(position, position + 1);
        
        // If line numbers are enabled, ensure the error line is visible
        if (this.lineNumbersEnabled && this.lineNumbersContainer) {
            // Find the error line element and highlight it
            const lineElements = this.lineNumbersContainer.children;
            
            if (line <= lineElements.length) {
                const errorLineElement = lineElements[line - 1];
                errorLineElement.style.backgroundColor = '#ffcdd2';
                errorLineElement.style.color = '#b71c1c';
                errorLineElement.style.fontWeight = 'bold';
                
                // Reset the highlight after a delay
                setTimeout(() => {
                    errorLineElement.style.backgroundColor = '';
                    errorLineElement.style.color = '#999';
                    errorLineElement.style.fontWeight = 'normal';
                }, 5000);
            }
            
            // Ensure the line is visible by scrolling to it
            this.scrollToLine(line);
        }
        
        // Highlight the line in the display
        const lines2 = this.displayCode.innerHTML.split('\n');
        if (line <= lines2.length) {
            const originalLine = lines2[line - 1];
            lines2[line - 1] = `<div style="background-color: rgba(255, 0, 0, 0.1); width: 100%;">${originalLine}</div>`;
            this.displayCode.innerHTML = lines2.join('\n');
            
            // Reset the highlight after a delay
            setTimeout(() => {
                this.updateDisplay();
            }, 5000);
        }
    }
    
    /**
     * Scroll to a specific line in the editor
     * @param {number} lineNumber The line number to scroll to (1-based)
     */
    scrollToLine(lineNumber) {
        if (!this.textarea) return;
        
        const lines = this.textarea.value.split('\n');
        let position = 0;
        
        // Calculate position of the target line
        for (let i = 0; i < Math.min(lineNumber - 1, lines.length - 1); i++) {
            position += lines[i].length + 1; // +1 for newline character
        }
        
        // Set cursor position to the beginning of the line
        this.textarea.focus();
        this.textarea.setSelectionRange(position, position);
        
        // Calculate approximate line height (based on font size)
        const lineHeight = parseInt(getComputedStyle(this.textarea).fontSize, 10) * 1.2;
        
        // Calculate scroll position
        const targetPosition = (lineNumber - 1) * lineHeight;
        
        // Scroll to position, with some padding to center it in view
        const viewportHeight = this.textarea.clientHeight;
        this.textarea.scrollTop = Math.max(0, targetPosition - (viewportHeight / 2));
        
        // Synchronize scroll position with display elements
        this.synchronizeScrolling();
    }
    
    /**
     * Clear any error highlighting
     */
    clearErrorHighlighting() {
        // Clear line number highlighting
        if (this.lineNumbersEnabled && this.lineNumbersContainer) {
            const lineElements = this.lineNumbersContainer.children;
            for (let i = 0; i < lineElements.length; i++) {
                lineElements[i].style.backgroundColor = '';
                lineElements[i].style.color = '#999';
                lineElements[i].style.fontWeight = 'normal';
            }
        }
        
        // Clear display highlighting by refreshing the display
        this.updateDisplay();
    }
    
    /**
     * Hide the log message
     */
    hideLogMessage() {
        if (this.showToolbar && this.logContainer) {
            this.logContainer.style.display = 'none';
        }
    }

    /**
     * Set the editor's value
     * @param {string|Object} value JSON string or object to set as the editor value
     */
    setValue(value) {
        let jsonString;
        
        // Convert object to string if necessary
        if (typeof value === 'object') {
            try {
                jsonString = JSON.stringify(value, null, 2);
            } catch (e) {
                console.error('Error stringifying JSON object:', e);
                jsonString = '';
            }
        } else if (typeof value === 'string') {
            jsonString = value;
        } else {
            jsonString = String(value);
        }
        
        // Set textarea value
        this.textarea.value = jsonString;
        
        // Update the display
        this.updateDisplay();
        
        // Clear any error highlighting
        this.clearErrorHighlighting();
        
        // Hide any previous log messages
        this.hideLogMessage();
    }
    
    /**
     * Get the current value from the editor
     * @param {boolean} [parseJson=false] Whether to parse and return as object
     * @returns {string|Object} The current value as string or parsed object
     */
    getValue(parseJson = false) {
        const value = this.textarea.value;
        
        if (parseJson) {
            try {
                return JSON.parse(value);
            } catch (e) {
                console.error('Error parsing JSON:', e);
                return null;
            }
        }
        
        return value;
    }

    /**
     * Insert NGSI-LD Attribute template at cursor position
     */
    insertNGSIAttribute = () => {
        const attributeTemplate = `"attributeName": {
    "type": "Property",
    "value": ""
}`;
        
        // Insert directly as a string template, no need for JSON.stringify
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        
        // Insert the template at cursor position
        this.textarea.value = this.textarea.value.substring(0, start) 
            + attributeTemplate 
            + this.textarea.value.substring(end);
        
        // Update cursor position after the inserted template
        const newPosition = start + attributeTemplate.length;
        this.textarea.selectionStart = this.textarea.selectionEnd = newPosition;
        
        // Give focus back to the textarea
        this.textarea.focus();
        
        // Update the display
        this.updateDisplay();
        
        // Show success message
        this.showValidationMessage('NGSI-LD Attribute template inserted', true);
        
        // Trigger onChange callback
        this.onChange(this.getValue());
    }
    
    /**
     * Insert NGSI-LD Relationship template at cursor position
     */
    insertNGSIRelationship = () => {
        const relationshipTemplate = `"relationshipName": {
    "type": "Relationship",
    "object": "urn:ngsi-ld:Entity:001"
}`;
        
        // Insert directly as a string template, no need for JSON.stringify
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        
        // Insert the template at cursor position
        this.textarea.value = this.textarea.value.substring(0, start) 
            + relationshipTemplate 
            + this.textarea.value.substring(end);
        
        // Update cursor position after the inserted template
        const newPosition = start + relationshipTemplate.length;
        this.textarea.selectionStart = this.textarea.selectionEnd = newPosition;
        
        // Give focus back to the textarea
        this.textarea.focus();
        
        // Update the display
        this.updateDisplay();
        
        // Show success message
        this.showValidationMessage('NGSI-LD Relationship template inserted', true);
        
        // Trigger onChange callback
        this.onChange(this.getValue());
    }
    
    /**
     * Insert NGSI-LD Context template at cursor position
     */
    insertNGSIContext = () => {
        const contextTemplate = `"@context": [
    "https://ngsi-ld.sensorsreport.net/synchro-context.jsonld"
],`;
        
        // Insert directly as a string template, no need for JSON.stringify
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        
        // Insert the template at cursor position
        this.textarea.value = this.textarea.value.substring(0, start) 
            + contextTemplate 
            + this.textarea.value.substring(end);
        
        // Update cursor position after the inserted template
        const newPosition = start + contextTemplate.length;
        this.textarea.selectionStart = this.textarea.selectionEnd = newPosition;
        
        // Give focus back to the textarea
        this.textarea.focus();
        
        // Update the display
        this.updateDisplay();
        
        // Show success message
        this.showValidationMessage('NGSI-LD Context template inserted', true);
        
        // Trigger onChange callback
        this.onChange(this.getValue());
    }
    
    /**
     * Insert JSON at cursor position
     * @param {Object} jsonObj - The JSON object to insert
     */
    insertJsonAtCursor = (jsonObj) => {
        // Format the object as indented JSON string
        const formattedJson = JSON.stringify(jsonObj, null, 2);
        
        // Get cursor position
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        
        // Insert the new content
        this.textarea.value = this.textarea.value.substring(0, start) 
            + formattedJson 
            + this.textarea.value.substring(end);
        
        // Update cursor position after the inserted template
        const newPosition = start + formattedJson.length;
        this.textarea.selectionStart = this.textarea.selectionEnd = newPosition;
        
        // Give focus back to the textarea
        this.textarea.focus();
        
        // Update the display
        this.updateDisplay();
        
        // Trigger onChange callback
        this.onChange(this.getValue());
    }

    /**
     * Set up network status event listeners
     */
    setupNetworkListeners() {
        // Listen for online/offline events
        window.addEventListener('online', this.handleNetworkStatusChange);
        window.addEventListener('offline', this.handleNetworkStatusChange);
    }

    /**
     * Handle network status changes
     */
    handleNetworkStatusChange = () => {
        const wasOnline = this.isOnline;
        this.isOnline = navigator.onLine;
        
        // Only show notification if status actually changed
        if (wasOnline !== this.isOnline) {
            if (this.isOnline) {
                this.showValidationMessage('Connection restored. You are back online.', true);
            } else {
                this.showValidationMessage('You are currently offline. API operations will not work.', false);
            }
        }
    }

    /**
     * Check if the application is online
     * @returns {boolean} True if online, false if offline
     */
    checkOnlineStatus() {
        // Update current online status
        this.isOnline = navigator.onLine;
        
        // If offline, show a message
        if (!this.isOnline) {
            this.showValidationMessage('You are offline. Please check your network connection and try again.', false);
        }
        
        return this.isOnline;
    }

    /**
     * Attempt an API operation with offline handling
     * @param {Function} operationFn The API operation function to try
     * @returns {Promise} A promise that resolves or rejects based on the operation
     */
    tryApiOperation(operationFn) {
        // First check if we're online
        if (!this.checkOnlineStatus()) {
            return Promise.reject({
                error: true,
                message: 'It appears you\'re not connected to the internet, please check your network connection and try again.',
                offline: true,
                requestId: this.generateRequestId()
            });
        }
        
        // If we're online, try the operation
        return operationFn().catch(error => {
            // If the error might be due to connection issues
            if (this.isConnectionError(error)) {
                // Double check our connection status
                this.isOnline = navigator.onLine;
                if (!this.isOnline) {
                    return Promise.reject({
                        error: true,
                        message: 'You lost connection during the operation. Please check your network and try again.',
                        offline: true,
                        requestId: this.generateRequestId()
                    });
                }
            }
            
            // If it's not an offline issue, just pass through the original error
            return Promise.reject(error);
        });
    }

    /**
     * Generate a unique request ID for error tracking
     * @returns {string} A unique request ID
     */
    generateRequestId() {
        return [
            Date.now().toString(36), 
            Math.random().toString(36).substring(2, 9)
        ].join('-');
    }

    /**
     * Check if an error is likely a connection error
     * @param {Object} error The error object
     * @returns {boolean} True if it's likely a connection error
     */
    isConnectionError(error) {
        // Check for common connection error signs
        if (!error) return false;
        
        // Check for network error messages
        if (error.message) {
            const msg = error.message.toLowerCase();
            return (
                msg.includes('network') ||
                msg.includes('connection') ||
                msg.includes('offline') ||
                msg.includes('internet') ||
                msg.includes('timeout') ||
                msg.includes('failed to fetch')
            );
        }
        
        // Check for specific error formats
        if (typeof error === 'string') {
            const errorStr = error.toLowerCase();
            return (
                errorStr.includes('not connected to the internet') ||
                errorStr.includes('check your network') ||
                errorStr.includes('network connection') ||
                errorStr.includes('please try again')
            );
        }
        
        // Check if the error has a standard format with the 'reason' property
        if (error.reason && typeof error.reason === 'string') {
            const reason = error.reason.toLowerCase();
            return (
                reason.includes('not connected to the internet') ||
                reason.includes('check your network') ||
                reason.includes('offline') ||
                reason.includes('network connection')
            );
        }
        
        // Check for specific error codes
        if (error.code) {
            return (
                error.code === 'ECONNREFUSED' ||
                error.code === 'ECONNRESET' ||
                error.code === 'ENOTFOUND' ||
                error.code === 'ETIMEDOUT'
            );
        }
        
        return false;
    }

    /**
     * Handle API operation with proper error detection and offline mode handling
     * @param {Event} e The event object
     */
    handleApiOperation = (e) => {
        // Make sure we're online before proceeding
        if (!this.checkOnlineStatus()) {
            const errorObj = {
                error: true,
                message: 'It appears you\'re not connected to the internet, please check your network connection and try again.',
                offline: true,
                requestId: this.generateRequestId()
            };
            
            // Display error message
            this.showValidationMessage(`Error: ${errorObj.message}`, false);
            
            // Call the onApiOperation callback with the error
            if (typeof this.onApiOperation === 'function') {
                this.onApiOperation(this.entityId, null, errorObj);
            }
            return;
        }
        
        // Validate JSON before sending
        if (!this.validateJson()) {
            // If validation failed, stop and don't send invalid JSON
            return;
        }
        
        try {
            const jsonData = this.getValue(true); // Get parsed value
            
            if (jsonData === null) {
                this.showValidationMessage('Error: Invalid JSON format', false);
                return;
            }
            
            // Use the tryApiOperation method to handle the operation with offline detection
            this.tryApiOperation(() => {
                // Return a promise that will be handled by tryApiOperation
                return new Promise((resolve, reject) => {
                    // This would typically be an actual API call
                    // For now, we're just simulating the callback to the parent component
                    if (typeof this.onApiOperation === 'function') {
                        // In a real implementation, this would be replaced with an actual API call
                        // that returns a promise, which would resolve or reject based on the result
                        try {
                            const result = this.onApiOperation(this.entityId, jsonData, null);
                            resolve(result);
                        } catch (error) {
                            reject(error);
                        }
                    } else {
                        resolve({ success: true }); // Resolve with a dummy result if no callback provided
                    }
                });
            }).catch(error => {
                // Handle errors from the API operation
                let errorMessage;
                
                if (error.offline) {
                    errorMessage = `Error: ${error.message}`;
                } else if (error.message) {
                    errorMessage = `API Error: ${error.message}`;
                } else {
                    errorMessage = 'An unknown error occurred';
                }
                
                // Show error in the UI
                this.showValidationMessage(errorMessage, false);
                
                // Call onApiOperation with the error
                if (typeof this.onApiOperation === 'function') {
                    this.onApiOperation(this.entityId, null, error);
                }
            });
            
        } catch (error) {
            console.error('Error in API operation:', error);
            this.showValidationMessage(`Error: ${error.message || 'Unknown error'}`, false);
        }
    }

    /**
     * Handle the GET operation button click
     * Gets an entity by ID and displays it in the editor
     */
    handleGetOperation = () => {
        // Make sure we have an entity ID
        const entityId = this.entityIdInput ? this.entityIdInput.value.trim() : this.entityId;
        
        if (!entityId) {
            this.showValidationMessage('Please enter an Entity ID', false);
            if (this.entityIdInput) {
                this.entityIdInput.focus();
            }
            return;
        }
        
        // Store the entity ID
        this.entityId = entityId;
        
        // Show loading message
        this.showValidationMessage('Loading entity...', true);
        
        // Call the onApiOperation callback with the entity ID
        if (typeof this.onApiOperation === 'function') {
            try {
                // Operation is GET, no JSON data needed for GET
                const result = this.onApiOperation('GET', entityId, null);
                
                // Check if the operation returned a promise
                if (result && typeof result.then === 'function') {
                    result.then(data => {
                        // Display the fetched entity
                        this.handleGetSuccess(data);
                    }).catch(error => {
                        // Handle error
                        this.showValidationMessage(`Error: ${error.message || 'Failed to load entity'}`, false);
                    });
                } else if (result) {
                    // Handle synchronous result
                    this.handleGetSuccess(result);
                }
            } catch (error) {
                // Handle error
                this.showValidationMessage(`Error: ${error.message || 'Failed to load entity'}`, false);
            }
        } else {
            // No callback provided, show error
            this.showValidationMessage('API operation handler not configured', false);
        }
    }
    
    /**
     * Handle successful GET operation
     * @param {Object} data The fetched entity data
     */
    handleGetSuccess = (data) => {
        // Set the editor value to the fetched entity
        this.setValue(data);
        
        // Show success message
        this.showValidationMessage('Entity loaded successfully', true);
        
        // Update tab title with entity ID if available
        if (data && data.id && window.tabManager) {
            // Find the tab that contains this editor
            const tab = window.tabManager.tabs.find(t => t.editor === this);
            if (tab) {
                // Create new title with operation and entity ID
                const newTitle = `GET ${data.id}`;
                const titleSpan = tab.tabElement.querySelector('span');
                if (titleSpan) {
                    titleSpan.textContent = window.tabManager.abbreviateEntityId(newTitle);
                }
            }
        }
        
        // Add additional operation buttons after a successful GET
        this.addOperationButtonsAfterGet();
    }
    
    /**
     * Add PATCH, PUT, and DELETE buttons after a successful GET operation
     */
    addOperationButtonsAfterGet = () => {
        // Don't add buttons if they already exist
        if (this.operation === 'GET' && !this.patchButton && !this.putButton && !this.deleteButton) {
            const toolbar = this.toolbar;
            
            // Function to style operation buttons
            const operationButtonStyle = (button, color) => {
                button.style.backgroundColor = color;
                button.style.color = 'white';
                button.style.border = 'none';
                button.style.borderRadius = '3px';
                button.style.padding = '4px 8px';
                button.style.margin = '0 3px';
                button.style.fontSize = '12px';
                button.style.cursor = 'pointer';
                button.style.display = 'flex';
                button.style.alignItems = 'center';
                button.style.justifyContent = 'center';
                button.style.fontWeight = 'bold';
                button.style.minWidth = '60px';
                button.style.height = '28px';
                
                // Shade color function for hover effects
                const shadeColor = (color, percent) => {
                    let R = parseInt(color.substring(1,3), 16);
                    let G = parseInt(color.substring(3,5), 16);
                    let B = parseInt(color.substring(5,7), 16);

                    R = parseInt(R * (100 + percent) / 100);
                    G = parseInt(G * (100 + percent) / 100);
                    B = parseInt(B * (100 + percent) / 100);

                    R = (R < 255) ? R : 255;  
                    G = (G < 255) ? G : 255;  
                    B = (B < 255) ? B : 255;  

                    R = Math.max(0, R).toString(16).padStart(2, '0');
                    G = Math.max(0, G).toString(16).padStart(2, '0');
                    B = Math.max(0, B).toString(16).padStart(2, '0');

                    return `#${R}${G}${B}`;
                };
                
                button.addEventListener('mouseover', () => {
                    button.style.backgroundColor = shadeColor(color, -10); // Darken on hover
                });
                button.addEventListener('mouseout', () => {
                    button.style.backgroundColor = color;
                });
            };
            
            // Create PATCH Button (orange)
            this.patchButton = document.createElement('button');
            this.patchButton.textContent = 'PATCH';
            this.patchButton.title = 'Update entity properties';
            operationButtonStyle(this.patchButton, '#f0ad4e'); // Orange
            this.patchButton.addEventListener('click', this.handlePatchOperation);
            toolbar.appendChild(this.patchButton);
            
            // Create PUT Button (light blue)
            this.putButton = document.createElement('button');
            this.putButton.textContent = 'PUT';
            this.putButton.title = 'Replace entity';
            operationButtonStyle(this.putButton, '#5bc0de'); // Light blue
            this.putButton.addEventListener('click', this.handlePutOperation);
            toolbar.appendChild(this.putButton);
            
            // Create DELETE Button (red)
            this.deleteButton = document.createElement('button');
            this.deleteButton.textContent = 'DELETE';
            this.deleteButton.title = 'Delete entity';
            operationButtonStyle(this.deleteButton, '#d9534f'); // Red
            this.deleteButton.addEventListener('click', this.handleDeleteOperation);
            toolbar.appendChild(this.deleteButton);
        }
    }
    
    /**
     * Handle the POST operation button click
     * Creates a new entity
     */
    handlePostOperation = () => {
        // Validate JSON before sending
        if (!this.validateJson()) {
            return;
        }
        
        // Get the JSON data
        const jsonData = this.getValue(true);
        if (!jsonData) {
            this.showValidationMessage('Error: Invalid JSON format', false);
            return;
        }
        
        // Show loading message
        this.showValidationMessage('Creating entity...', true);
        
        // Call the onApiOperation callback
        if (typeof this.onApiOperation === 'function') {
            try {
                // Operation is POST
                const result = this.onApiOperation('POST', null, jsonData);
                
                // Check if the operation returned a promise
                if (result && typeof result.then === 'function') {
                    result.then(data => {
                        // Handle successful creation
                        this.handlePostSuccess(data);
                    }).catch(error => {
                        // Handle error
                        this.showValidationMessage(`Error: ${error.message || 'Failed to create entity'}`, false);
                    });
                } else if (result) {
                    // Handle synchronous result
                    this.handlePostSuccess(result);
                }
            } catch (error) {
                // Handle error
                this.showValidationMessage(`Error: ${error.message || 'Failed to create entity'}`, false);
            }
        } else {
            // No callback provided, show error
            this.showValidationMessage('API operation handler not configured', false);
        }
    }
    
    /**
     * Handle successful POST operation
     * @param {Object} data The response data from the POST operation
     */
    handlePostSuccess = (data) => {
        // Check if the response contains the created entity
        if (data && typeof data === 'object') {
            // If we have entity data, show it
            this.setValue(data);
        }
        
        // Show success message
        this.showValidationMessage('Entity created successfully', true);
        
        // If this response has an ID, extract it
        if (data && data.id) {
            this.entityId = data.id;
            if (this.entityIdInput) {
                this.entityIdInput.value = data.id;
            }
        }
        
        // Switch to GET mode with the new entity
        this.refreshWithGetMode();
    }
    
    /**
     * Handle the PATCH operation button click
     * Updates specific properties of an entity
     */
    handlePatchOperation = () => {
        // Make sure we have an entity ID
        const entityId = this.entityIdInput ? this.entityIdInput.value.trim() : this.entityId;
        
        if (!entityId) {
            this.showValidationMessage('Please enter an Entity ID', false);
            if (this.entityIdInput) {
                this.entityIdInput.focus();
            }
            return;
        }
        
        // Validate JSON before sending
        if (!this.validateJson()) {
            return;
        }
        
        // Get the JSON data
        const jsonData = this.getValue(true);
        if (!jsonData) {
            this.showValidationMessage('Error: Invalid JSON format', false);
            return;
        }
        
        // Show loading message
        this.showValidationMessage('Updating entity...', true);
        
        // Call the onApiOperation callback
        if (typeof this.onApiOperation === 'function') {
            try {
                // Operation is PATCH
                const result = this.onApiOperation('PATCH', entityId, jsonData);
                
                // Check if the operation returned a promise
                if (result && typeof result.then === 'function') {
                    result.then(data => {
                        // Handle successful update
                        this.handlePatchSuccess(data);
                    }).catch(error => {
                        // Handle error
                        this.showValidationMessage(`Error: ${error.message || 'Failed to update entity'}`, false);
                    });
                } else if (result) {
                    // Handle synchronous result
                    this.handlePatchSuccess(result);
                }
            } catch (error) {
                // Handle error
                this.showValidationMessage(`Error: ${error.message || 'Failed to update entity'}`, false);
            }
        } else {
            // No callback provided, show error
            this.showValidationMessage('API operation handler not configured', false);
        }
    }
    
    /**
     * Handle successful PATCH operation
     * @param {Object} data The response data from the PATCH operation
     */
    handlePatchSuccess = (data) => {
        // Show success message
        this.showValidationMessage('Entity updated successfully', true);
        
        // Refresh to GET the updated entity
        this.refreshWithGetMode();
    }
    
    /**
     * Handle the PUT operation button click
     * Replaces an entire entity
     */
    handlePutOperation = () => {
        // Make sure we have an entity ID
        const entityId = this.entityIdInput ? this.entityIdInput.value.trim() : this.entityId;
        
        if (!entityId) {
            this.showValidationMessage('Please enter an Entity ID', false);
            if (this.entityIdInput) {
                this.entityIdInput.focus();
            }
            return;
        }
        
        // Validate JSON before sending
        if (!this.validateJson()) {
            return;
        }
        
        // Get the JSON data
        const jsonData = this.getValue(true);
        if (!jsonData) {
            this.showValidationMessage('Error: Invalid JSON format', false);
            return;
        }
        
        // Show loading message
        this.showValidationMessage('Replacing entity...', true);
        
        // Call the onApiOperation callback
        if (typeof this.onApiOperation === 'function') {
            try {
                // Operation is PUT
                const result = this.onApiOperation('PUT', entityId, jsonData);
                
                // Check if the operation returned a promise
                if (result && typeof result.then === 'function') {
                    result.then(data => {
                        // Handle successful replacement
                        this.handlePutSuccess(data);
                    }).catch(error => {
                        // Handle error
                        this.showValidationMessage(`Error: ${error.message || 'Failed to replace entity'}`, false);
                    });
                } else if (result) {
                    // Handle synchronous result
                    this.handlePutSuccess(result);
                }
            } catch (error) {
                // Handle error
                this.showValidationMessage(`Error: ${error.message || 'Failed to replace entity'}`, false);
            }
        } else {
            // No callback provided, show error
            this.showValidationMessage('API operation handler not configured', false);
        }
    }
    
    /**
     * Handle successful PUT operation
     * @param {Object} data The response data from the PUT operation
     */
    handlePutSuccess = (data) => {
        // Show success message
        this.showValidationMessage('Entity replaced successfully', true);
        
        // Refresh to GET the updated entity
        this.refreshWithGetMode();
    }
    
    /**
     * Handle the DELETE operation button click
     * Deletes an entity
     */
    handleDeleteOperation = () => {
        // Make sure we have an entity ID
        const entityId = this.entityIdInput ? this.entityIdInput.value.trim() : this.entityId;
        
        if (!entityId) {
            this.showValidationMessage('Please enter an Entity ID', false);
            if (this.entityIdInput) {
                this.entityIdInput.focus();
            }
            return;
        }
        
        // Confirm deletion
        if (!confirm(`Are you sure you want to delete entity "${entityId}"?`)) {
            return;
        }
        
        // Show loading message
        this.showValidationMessage('Deleting entity...', true);
        
        // Call the onApiOperation callback
        if (typeof this.onApiOperation === 'function') {
            try {
                // Operation is DELETE
                const result = this.onApiOperation('DELETE', entityId, null);
                
                // Check if the operation returned a promise
                if (result && typeof result.then === 'function') {
                    result.then(data => {
                        // Handle successful deletion
                        this.handleDeleteSuccess(data);
                    }).catch(error => {
                        // Handle error
                        this.showValidationMessage(`Error: ${error.message || 'Failed to delete entity'}`, false);
                    });
                } else if (result) {
                    // Handle synchronous result
                    this.handleDeleteSuccess(result);
                }
            } catch (error) {
                // Handle error
                this.showValidationMessage(`Error: ${error.message || 'Failed to delete entity'}`, false);
            }
        } else {
            // No callback provided, show error
            this.showValidationMessage('API operation handler not configured', false);
        }
    }
    
    /**
     * Handle successful DELETE operation
     * @param {Object} data The response data from the DELETE operation
     */
    handleDeleteSuccess = (data) => {
        // Show success message
        this.showValidationMessage('Entity deleted successfully', true);
        
        // Clear the editor or refresh to GET mode with empty results
        this.setValue({
            message: "Entity deleted successfully",
            timestamp: new Date().toISOString()
        });
        
        // Refresh to GET mode with blank state
        this.refreshWithGetMode();
    }
    
    /**
     * Refresh the editor to GET mode
     * This allows a seamless transition between operations
     */
    refreshWithGetMode = () => {
        // If this is part of a tab system with API functions, notify parent to refresh
        if (typeof window.refreshEditorWithOperation === 'function') {
            window.refreshEditorWithOperation('GET', this.entityId);
        } else if (typeof this.onApiOperation === 'function') {
            // Otherwise, try to use our callback to refresh
            setTimeout(() => {
                // If we have an entity ID, try to GET it
                if (this.entityId && this.entityIdInput) {
                    this.handleGetOperation();
                } else {
                    // Just show success without changing mode
                    this.showValidationMessage('Operation completed successfully', true);
                }
            }, 1000); // Short delay to show success message first
        }
    }
}

// Add module exports
window.JsonEditor = JsonEditor;
export default JsonEditor;