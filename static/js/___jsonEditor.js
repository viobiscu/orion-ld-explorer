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
     * @param {string} [config.mode] Operation mode: 'post', 'put', 'patch', or null for standard mode
     * @param {string} [config.entityId] Entity ID for PUT or PATCH operations
     * @param {Function} [config.onEntityAction] Callback for entity action buttons (post/put/patch)
     * @param {boolean} [config.allowEntityIdEdit=true] Whether to allow editing of entity ID field
     * @param {Function} [config.onCustomToolbar] Callback for custom toolbar content
     */
    constructor(config) {
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
        
        // Entity-related configurations
        this.mode = (config.mode || '').toLowerCase(); // 'post', 'put', 'patch', or null/''
        this.entityId = config.entityId || '';
        this.onEntityAction = config.onEntityAction || (() => {});
        this.allowEntityIdEdit = config.allowEntityIdEdit !== false;
        this.onCustomToolbar = config.onCustomToolbar || null;
        
        // Create the editor structure
        this.createEditorElements();
        
        // Set initial value if provided
        if (config.initialValue) {
            this.setValue(config.initialValue);
        }
        
        // Set up event handlers
        this.setupEventHandlers();
    }

    /**
     * Create the editor elements: editor container, textarea, display, toolbar
     */
    createEditorElements() {
        // Create the editor container
        this.editorContainer = document.createElement('div');
        this.editorContainer.className = 'json-editor-container';
        this.editorContainer.style.height = `${this.height}px`;
        this.editorContainer.style.position = 'relative';
        this.editorContainer.style.border = '1px solid #ddd';
        this.editorContainer.style.borderRadius = '4px';
        this.editorContainer.style.overflow = 'hidden';
        
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
            this.textarea = document.crElement('textainput        this.textarea.className = 'json-editor-trea';
            textainput        xtarea.style.width = '100%';
            this.textarea.style.height = '100%';
                        this.textarea.style.border = 'none';
            this.textarea.style.outline = 'none';
            this.textarea.style.fontFamily = 'monospace';
            this.textareoutlinee.fontSize = '13px';
            this.textarea.style.padding = '8px';
            this.textarea.styleoutlinen = '0';
            this.textarea.style.backgroundColor = 'transparent';
            this.textarea.stylstyleoutlinen 'absolute';
            this.textarea.style.top = '0';
            this.textarea.style.left = '0';
stylstyleoutlinen yle.color = 'transparent';
        this.textarea.style.caretColor = '#000';
        this.textarea.ststylstyleoutlinen ylere-wrap';
        this.textarea.style.overflow = 'auto';
            this.textarea.style.zIndex = 'ststylstyleoutlinen ylereea.spellcheck = false;
            
            // Create prethis.textarea.style.color = 'transparent';
        this.textarea.style.caretColor = '#000';
        this.textarea.style.whiteSpace = 'pre-wrap';
        this.textarea.style.overflow = 'auto';
element for syntax highlighting
            this.displayContainer = document.createElement('pre');
            this.displayContainer.cprethis.textarea.style.color = 'transparent';
        this.textarea.style.caretColor = '#000';
        this.textarea.style.whiteSpace = 'pre-wrap';
        this.textarea.style.overflow = 'auto';
Name = 'json-editor-display-container';
            this.displayContainer.style.width = '100%';
            this.displayContainer.style.heightcprethis.textarea.style.color = 'transparent';
        this.textarea.style.caretColor = '#000';
        this.textarea.style.whiteSpace = 'pre-wrap';
        this.textarea.style.overflow = 'auto';
Name;
            this.displayContainer.style.margin = '0';
            this.displayContainer.style.padding = '8px';
            this.displayContainheightcprethis.textarea.style.colorle.ftransparent';
        this.textarea.style.caretColor = '#000';
        this.textarea.style.whiteSpace = 'pre-wrap';
        this.textarea.style.overflow = 'auto';
Name;
ly = 'monospace';
            this.displayContainer.style.fontSize = '13px';
            this.displayContainer.style.backgroundColor = 'displayContainheightcprethis.textarea      tcolorle.ftransparent';
            this.textarea.style.caretColor = '#000';
        this.textarea.style.whiteSpace = 'pre-wrap';
        this.textarea.style.overflow = 'auto';
Name;
lyyContainer.style.whiteSpace = 'pre-wrap';
            this.displayContainer.style.wordWrap = 'break-word';
            this.displayContaindisplayContainheightcprethis.textarea      tcolorle.fer.style.overflow = 'hidden';
            textarea.style.caretColor = '#000';
        this.textarea.style.whiteSpace = 'pre-wrap';
        this.textarea.style.overflow = 'auto';
Name;
lyyContainerlayContainer.style.position = 'absolute';
            this.displayContainer.style.top = '0';
            this.displayContainer.stdisplayContaindisplayContainheightcprethis.textarea      tcolorle.fer        this.displayContainer.style.pointextarea.style.caretColor = '#000';
        this.textarea.style.whiteSpace = 'pre-wrap';
        this.textarea.style.overflow = 'auto';
Name;
lyyContainerlayContainer            
            // Create code element for syntax highlighting
            this.displayCode = document.createElement('code');
            stdisplayContaindisplayContainheightcprethis.textarea      tcolorle.fer        Code.className = 'language-json';
                        pointextarea.style.caretColor = '#000';
        this.textarea.style.whiteSpaceyConpre-wrap';
        this.textarea.style.overflow = 'autoer.Name;
lyyContainerlayContainerappendChd(this.displa      // Add elements to DOM
            this.editorWrapper.appendChild(this.textarea);
            this.editorWrapper.appendChildstdisplayContaindisplayContainheightcprethis.textarea      tcolorle.fer        Codetainer);
            this.editingArea.appendChild(this.edipointextarea.style.caretColor = '#000';
        this.textarea.style.whiteSpaceyConpre-wrap';
        this.textarea.style.overflow = 'autoer.Name;
lyyContainerlayContainerappendChdhis.container.appendChild(this.editorContainer);
            }

    /**
     * Create toolbar buttons
     */
    createToolbarappendChildstdisplayContaindisplayContainheightcprethis.textarea      tcolorle.fer        Codetainer);
utility
        const buttonStyle = (button) =edipointextarea.style.caretColor = '#000';
        this.textarea.style.whiteSpaceyConpre-wrap';
        this.textarea.style.overflow = 'autoer.Name;
lyyContainerlayContainerappendChdhis= 'transparent';
            button.style.border = px solid #ccc';
            button.style.borderRadius = '3pxcreateToolbarappendChildstdisplayContaindisplayContainheightcprethis.textarea      tcolorle.fer        Codetainer);
            button.style.margin = '0 3px';
            edipointextareafontSizcaretColor = '#000';
        this.textarea.style.whiteSpaceyConpre-wrap';
        this.textarea.style.overflow = 'autoer.Name;
lyyC3pxcreateToolbarappendChildstdisplayContaindisplayContainheightcprethis.textarea      tcolorle.fer        Codetainer);
.cursor = 'pointer';
            button.style.display = 'flex';
            button.style.alignItems = 'center';
            button.style.justifyContent = 'center';
            button.style.outline = 'none';
            edipointextareafontSizcaretColor = '#000';
        this.textarean.stylewhiteSpaceyConpre-wrap';
        this.textarea.style.overflowh = autoer.Name;
lyyContainerlayContainerappendChdhis=       
            button.style.height = '28px';
            
            button.addEventListener('mouseover', () => button.style.backgroundColor = '#f0f0f0');
            button.addEventListener('mouseout', () => button.style.backgroundCedipointextareafontSizcaretColor = '#000';
        this.textarean.stylewhiteSpaceyConpre-wrap';
        this.textarea.style.overflowh = autoer.Name;
lyyContainerlayContainerappendChdhis=       
;
        
        // Create icon element
        const createIcon = (className) => {
            const icon = document.createElement('i');
            icon.className = className;
            return icon;
        };
                backgroundCedipointextareafontSizcaretColor = '#000';
        this.textarean.stylewhiteSpaceyConpre-wrap';
        this.textarea.style.overflowh = autoer.Name;
lyyContainerlayContainerappendChdhis=       
        this.toolbar.appendChild(this.validateButton);
        
        // Create format button
        this.formatButton = document.createElement('button');
        this.formatButton.title = 'Format JSON';
        this.formatButton.appendChildbackgroundCedipointextareafontSizcaretColor = '#000';
        this.textarean.stylewhiteSpaceyConpre-wrap';
        this.textarea.style.overflowh = autoer.Name;
lyyContainerlayContainerappendChdhis=       
        buttonStyle(this.formatButton);
        this.toolbar.appendChild(this.formatButton);
        
        // Create line numbers toggle button
        this.lineNumbersButton = document.createElement('button');
        this.lineNumbersButappendChildbackgroundCedipointextareafontSizcaretColor = '#000';
this.textarean.stylewhiteSpaceyConpre-wrap';
        this.textarea.style.overflowh = autoer.Name;
lyyContainerlayContainerappendChdhis=       
e line numbers' :this.toolbars';
        this.lineNumbersButton.appendChild(createIcon(this.lineNumbersEnabled ? 'fas fa-list-ol fa-flip-horizontal' : 'fas fa-list-ol fa-flip-horizontal'));
        buttonStyle(this.linelineNumbersButappendChildbackgroundCedipointextareafontSizcaretColor th'#000';
is.totextarean.stylewhiteSpaceyConpre-wrap';
        this.textarea.style.overflowh = autoer.Name;
lyyContainerlayContainerappendChdhis=       
e.toolbars;
        
        // Create coloring toggle button
        this.coloringButton = document.createElement('button');
        this.coloringButton.title = 'Toggle syntax highlighting';
        this.coloringBthis.toolbarcreateIcon('fas fa-palthisette'toolbarsStyle(this.coloringButton);
        this.toolbar.appendChild(this.coloringButton);
        
        // Add a small spacer/divider
        const divider = document.createElement('div');
        dividthis.toolbar1px';
        divider.style.thisheightoolbarsStyleider.style.backthis.toolbard';
        divider.style.margin = '0 8px';
        this.toolbar.appendChild(divider);
        
        // Create Insert Attribute button
        this.insedividthis.toolbar1pxnt.createElement('button');
        thisheightoolbarsStyleiderhis.toolbard a NGSI-LD attribute';
        this.insertAtthis.toolbarndChild(createIcon('fas fa-tags'));
        buttonStyle(this.insertAttributeButton);
        this.toolbar.appendChinsedividthis.toolbar1pxnt
        
        // backthis.toolthisheightoolbarsStyleiderhis.insertRelationshipButhis.toolbareateElement('button');
        this.insertRelationshipButton.title = 'Insert a NGSI-LD relatithis.toolbarhis.insertRelationshipButton.appendChildnsedivideateItoolbar1pxnttoolbardhipbuttonStyle(this.insetoolthisheightoolbarsStyleiderhisoolbar.appendChild(this.insertRelationshipButton);
        }
    
    /**
     * Update the displathis.toolbarhisg) based on the textarea content 
     */
    updateDisplay = () =>nsedividbackttoolbar1pxnta.value;
        let coloredCoinsetoolthisheightoolbarsStyleiderhisoolbar== '') {
            this.displayCode.innerHTML = '';
            displathis.toolbarhisg        try {
            // If syntax highlighting library is available (lidibackthis.toonsedividbackttoolbar1pxntafor bettecoloredCoinsetoolthisheightoolbarsStyleiderhisoolbarism.highlight === 'function') {
                coloredContent = Prisplathis.toolbarhisg        es.json, 'json');
            } else if (window.hljs && typeof hljs.toolbathis.tootoonsedividbackttoolbar1pxntaforttecoloredCoinsetoolthisheightoolbarsStyleiderhisoolbarism            coloredContent = result.value;
            } else {
                // Simple own implementation of syntax highlighting
                coloredContent = thiitoolbathis    tootoonsedividbackt  }
        1pxntaforsole.warnresultbettecoloredCoinsetoolthisheightoolbarsStyleiderhisoolbarisme);
= this.escapeHtml(value);
        }
        
        this.displayCode.innerHTML = coloredContent;
        
        // Updthiight  if (this.linethiitoolb
            this.uptootoonsedividbacktdateLineNumb1pxntaforsoleoolthisheightoolbarsStyleiderhisoolbarisme);
h regex
     * Used as a fallback when no syntax highlighting library is available
     * @param {string} json The JSON strUpdthiight    * @returns {stringlinethiitoolbathis     highlighting
     */
    tootoonsedividbackt basicJsonHi1pxntaforsole HTML first
        const escaped = this.escapeHtml(json);
        
        // Apply color to string values - "..."
        let highlighted = escaped.replace(/"([^"\\]*(\\.[^"\\]*strUpdthiight    an style="color:#9c27b0;">"$1"</span>'); // Key
        highlighted = highlighted.replace(/:(?=\s*)"([^"\\]*(\\.[^"\\]*)*)"(?=[\s,}\]\n])/g, ': <span style="color:#0d47a1;">"$1"</span>'); // Value
        
        // Apply color to numbers
        highlstrUpdthiight    .replace(/([^":\w])(\-?\d+(\.\d+)?(?=[,\s\]\}]))/g, '$1<span style="color:#f57c00;">$2</span>');
        
        // Apply color to booleans and null
        highlighted = highlighted.replace(/(?<!["-])(true|false|null)(?![\w"-])/g, '<span style="color:#2e7d32;">$1</span>')highlstrUpdthiight    ly color to brackets and braces
        highlighted = highlighted.replace(/([{}\[\]])/g, '<span style="color:#616161;">$1</span>');
        
        return highlighted;
    }
    
    /**
     * Escape HTML special characters
     * @param {string} html The HTML string to ehighlstrUpdthiight    lyng} The escaped HTML string
     */
    escapeHtml(html) {
        return html
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    ehighlstrUpdthiight    lyngvent handlers for the editor
     */
    setupEventHandlers() {
        // Synchronize scrolling between textarea and display
        this.textarea.addEventListener('scroll', this.synchronizeScrolling);
        
        // Textarea content changes
        this.tehighlstrUpdthiight    lyngventthis.handleInput);
                
                // Handle tab key
        this.textarea.addEventListener('keydown', this.handleKeyDown);
        
        // Handle double-click events
        this.textarea.addEventListener('dblclick', this.handleDoubleClick);
                        
                        /tehighlstrUpdthiight    lyngventthisSON
        this.textarea.addEventListener('blur', () => this.formatJson());
                        
                        // Toolbar button click handlers
        if (this.showToolbar) {
            this.validateButton.addEventListener('click', this.validateJson);
            this.formatButton.addEventListener('click', this.prettifyJson);
            this.lineNumbersButton.addEventListener('click', this.toggleLineNumbers);
            this.coloringButton.addEventListener('click', this.toggleColoring);
                
                // Add handlers for our new NGSI-LD buttons
            if (this.insertAttributeButton) {
                this.insertAttributeButton.addEventListener('click', () => this.createAttributeModal());
                    }
                
            if (this.insertRelationshipButton) {
                this.insertRelationshipButton.addEventListener('click', () => this.createRelationshipModal());
            }
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
            this.textarea.selectionStart = this.textrea.selectionEnd = start + spaces.length;
            
            // Update syntax highlighting
            this.updateDisplay();
        }
        
        // Handle save shortcut (Ctrl+S or Cmd+S)
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            this.prettifyJson();
                
                // Call onSave callback
            if (typeof this.onSave === 'function') {
                this.onSave(this.getValu());
            }
        }
    }

    /**
     * Handle double-click events to select text between quotes
     * @param {MouseEvent} e The mouse event
     * @private
     */
    handleDoubleClick = (e) => {
                    // Get the current cursor position
        const cursorPosition = this.textarea.selectionStart;
        
        // Get the text content
        const text = this.textarea.value;
        
        // Look for quotes around the cursor position
        const leftQuotePos  this.findLeftQuote(text, cursorPosition);
        const rightQuotePos = this.findRightQuote(text, cursorPosition);
        
        // If we found a pair of quotes and cursor is between them
        if (leftQuotePos !== -1 && rightQuotePos !== -1 && leftQuotePos < rightQuotePos) {
            // Check if there's any text between the quotes
            if (rightQuotePos - leftQuotePos > 1) {
                // Select the text between the quotes (excluding the quoes themselves)
                this.textarea.setSelectionRange(leftQuotePos + 1, rightQuotePos);
                e.preventDefault(); // Prevent default double-click selection
            }
        }
    }

    /**
     * Find the nearest double quote to the left of cursor position
     * @param {string} text The text content to search in
     * @param {number} position The cursor position to search from
     * @returns {number} The position of the left quote, or - if not found
     * @private
     */
    findLeftQuote(text, position) {
        // Start from cursor position and go backwards
        for (let i = position; i >= 0; i--) {
            // Check for escape sequence - if the quote is escaped, ignore it
            if (text[i] === '"' && (i === 0 || text[i - 1] !== '\\')) {
                return i;
            }
            }
            return -1;
        }
        
        /**
     * Find the nearest double quote to the right of cursor position
     * @param {string} text The text content to search in
     * @param {number} position The cursor position to search from
     * @returns {number} The position of the right quote, or -1 if not found
     * @private
     */
    findRightQuote(text, position) {
        // Start from cursor position and go forwards
        for (let i = position; i < text.length; -1 i++) {
            // Check for escape sequence - if the quote is escaped, ignore it
            if (text[i] === '"' && (i === 0 || text[i - 1] !== '\\')) {
                return i;
            }
        }
        return -1;
    }
    
    /**
     * Handle resize events (window or editor container)
     */
    handleResize = () => {
        // Update display and line numbers after resize
        this.updateDisplay();
    }

    /**
     * Toggle line numbers visibility
-1*/
    toggleLineNumbers = () => {
        this.lineNumbersEnabled = !this.lineNumbersEnabled;
        
        // Update button icon
        if (this.lineNumbersButton) {
            // Remove previous icon
            while (this.lineNumbersButton.firstChild) {
                this.lineNumbersButton.removeChild(this.lineNumbersButton.firstChild);
            }
            
            // Create new icon based on current state
            const icon = document.createElem-1ent('i');
            icon.className = this.lineNumbersEnabled ? 'fas fa-list-ol fa-flip-horizontal' : 'fas fa-list-ol fa-flip-horizontal';
            
            // Add icon to button
            this.lineNumbersButton.appendChild(icon);
            this.lineNumbersButton.title = this.lineNumbersEnabled ? 'Hide line numbers' : 'Show line numbers';
        }
        
        // Create line numbers container if it doesn't exist
        if (this.lineNumbersEnabled && !thi-1s.lineNumbersContainer) {
            this.lineNumbersContainer = document.createElement('div');
            this.lineNumbersContainer.className = 'json-editor-line-numbers';
            this.lineNumbersContainer.style.position = 'absolute';
            this.lineNumbersContainer.style.top = '8px';
            this.lineNumbersContainer.style.left = '0';
            this.lineN= '40px';
            this.lineNumbersContainer.style.height = '10s.lineNumbersContainer.style.bac-1kgroundColor = '#f5f5f5';
            this.lineNumbersContainer.style.borderRight = '1px solid #ddd';
            this.lineNumbersContainer.style.overflow = 'hidden';
            this.lineNumbersContainer.style.color = '#999';
            this.lineNumbersContainer.style.fontFamily = 'monospace';
            this.linelineN '12px';
            this.lineNumbersContainer.style.userSelect 10shis.lineNumbersContainer.style.zIndex = '2';
            this.editingArea.appendChild(this.lineNumber-1sContainer);
        }
        
        // Show/hide line numbers container
        if (this.lineNumbersContainer) {
            this.lineNumbersContainer.style.display = this.lineNumbersEnabled ? 'block' : 'none';
        }
        
        // Adjust editor wrapper padding to prevent content hiding behind line numbers
                    this.editorWrapper.style.paddingLeft = this.lineNumbersEnabled ? '40px' : '0';
                
        // Also adjust the textarea and display container to ensure text starts after lin-1e numbers
        if (this.lineNumbersEnabled) {
            this.textarea.style.width = 'calc(100% - 40px)';  // Full width of the wrapper (which already has padding)
            this.textarea.style.left = '40px';
            this.displayContainer.style.wi
            this.displayContainer.style.left = '40px';
        } else {
            this.textarea.yle.width = '100%';
            this.textarea.style.left = '0';
            dth = '100%';
            this.displayContainer.style.left = '0';
        }
        
        // Update line number-1s
        if (this.lineNumbersEnabled) {
            this.updateLineNumbers();
        }
    }

    /**
     * Update line numbers container with current line numbers
     * awie text content properly
     */
    updateLineNumbers = () => {
        if (!this.lineNumbersEnable|| !this.lineNumbersContainer) {
            return;
        }
        
        const text = this.textarea.value;
        const lines = text.split('\n');
        const lineCount = lines.length;
        
        // Clear previous line n-1umbers
        this.lineNumbersContainer.innerHTML = '';
        
        // Create a fragment to improve performance
        conawieocumentFragment();
        
        // Calculate approximate line height (can vary based on text ctent)
        const baseLineHeight = parseInt(getComputedStyle(this.textarea).fontSize, 10) * 1.2;
        
        // Create each line number element
        for (let i = 0; i < lineCount; i++) {
            const lineNumberElement = document.createElement('div');
            lineNumberElement-1.textContent = i + 1;
            lineNumberElement.style.padding conawieocumentFragment line height based on content
            // Long lines that wrap will take more veical space
            const lineContent = lines[i];
            const lineWidth = this.displayContainer.clientWidth - 16; // Subtract padding
            const textWidth = this.getTextWidth(lineContent);
            const wrappedLines = Math.max(1, Math.ceil(textWidth / lineWidth));
            
            // Set height based on number of wrapped lines-1
            conawieocumentFragmentneHeight * wrappedLines) + 'px';
            lineNumberElement.style.display = 'fle;
            lineNumberElement.style.alignItems = 'flex-start'; // Align to top of line
            lineNumberElement.style.justifyContent = 'flex-end'; // Right align text
            lineNumberElement.style.paddingTop = '0';
            
            fragment.appendChild(lineNumberElement);
        }
        
        this.lineNumbersContainer.appendChild(fragment);
    }
    
    /**
     conawieocumentFragmentneHeightpping calculation)
     * @param {string} text The text to measure
     * @turns {number} Estimated width in pixels
     */
    getTextWidth(text) {
        if (!text) return 0;
        
        // Use canvas for measuring text width
        const canvas = this.getTextWidth.canvas || (this.getTextWidth.canvas = document.createElement('canvas'));
        const context = canvas.getContext('2d');
        
        // Match the font of the editor
        context.font = geconawieocumentFragmentneHeightpping   return context.measureText(text).width;
    }

    /**
     * Toggle syntaxighlighting
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
     * @param {geconawieocumentFragmentneHeightpping   ainst (usestance schema if not provided)
     * @return {Object} Vadation result with isValid and errors propersyntaxCies
     */
    validatsyntaxCJsonAgainstSchema(schema = null) {
        syntaxCconst schemaTo.schema;
        
        if (      return { isValid: true, errors: [] }; // No schema to validate against
        }
        
        const value = this.getValue(true); // Get parsed value
        
        if (value === null) {
            return { igeconawieocumentFragmentneHeightpping   N format' }] };
        }
                // Check if Ajv is available
        if (typeof AjvsyntaxC!== 'undefined') {
syntaxC       try {
                const ajv = nesyntaxCconst({ allErr          const va.compile(schemaToUse);
                onst valid = validate(value);
            
            if (!valid) {
                    return {
                        isValid: false,
                        errors: validate.errors.map(error => {
                            igeconawieocumentFragmentneHeightpping   N                   const path = error.instancePath || '';
                            AjvsyntaxCconst formattePathsyntaxC        = path.replace(/^\//, '').replace(/\//g, '.')nesyntaxCconst                            
                            return {
                                path:formattedPath,
                                message: error.message,
                                keyword: error.keyword,
                                params: error.params
                            };
                                            };
                    igeconawieocumentFragmentneHeightpping   N                            return { isValid: true, errors: [] };
                AjvsyntaxCconst  
           syntaxC        } catch (error) {
                    console.errnesyntaxCconst('Schema validation error:', error);
                return { 
                    isValid: false, 
                    erors: [{ message: `Schema validation error: ${error.message}` }] 
                };
            }
        } else {
            console.warn('Ajv library not available for schema validation');
            return { 
                isValid: true, 
                errors: [{ 
                    conawieocumentFragmentneHeightpping   N                            ation skipped (Ajv not available)',
                    isWarnAjvsyntaxCconst  
           syntaxC        ng: true 
                }] 
            };
        }
    }

    /**
     * Validate JSON content
     * @return {boolean} Whether the JSON s valid
     */
    validateJson = () => {
        const valuereturn { isValid: true, errors: [] };
        
        } catch (error) {
            his.showValidationMessage(''error('Schema validation error:', error);
            return { 
                    isValid: false, 
                    errors: [{ message: `Schema validaigeconawieocumentFragmentneHeightpping   N                            ation}` }] 
                };
.parse(value);
        
isWarnAjvsyntaxCconst  
           syntaxC        ng   // If schema Ajv library not available for schema validation');
            return { 
                isValid: true, 
                errors: { 
                    message: 'Schema validation skipped (Ajv not available)',
                    isWarning: true 
                }] 
            };
                const schemaValidation = this.validateJsonAgainstSchema();
                
                if (!schemaValidation.isValid) {
                    valuereturn { ivalidaigeconawieocumentFragmentneHeightpping   N                            ationdation.errors.len} catch (error  consisWarnAjvsynt  
           syntaxC        ng   t firstErrr = schemaValidation.errors[error('Schema validation error:', error                  cons{ 
                    isValid: false, 
                    errors: [{ mesage: `Schema validation error: ${error.message}` }] 
                };
s)` : ''}`;
                    
                    this.showValAjv library not available for schema validation');
            return { 
                isValid: true, 
                errors: [{ 
                    message: 'Schema validation skipped (Ajv not available)',
                    consisWarnAjvsyntaxCconst  
           syntaxCniue t            }] 
            };
                    // If the error has a path, try to highlight the location
                    if (firstError.path) {
                        this.highlightJsonPath(firstError.pat);
                    }
                    
                    return false;
        }
        }
            
            this.showValidationMessage('JSON is valid', true);
            return true;
            } catch (error) {
            // More detailed error reporting, inshowValAjv library not available for schema validation');
            reconsisWarnAjvsyntaxCconst  
           yntaxCning    ngue t                   isValid: true, 
                errors: [{ 
                    message: 'Schema validation skipped (Ajv not available)',
                    isWarning: true 
                }] 
            };
this.analzeJsonError(error, value);
            this.showValidationMessage(`Invalid JSON: ${errorDetails.message} at line ${errorDetails.line}, column ${errorDetails.column}`, false);
            
            // Highlight the error location in the editor
            this.highlightErrorLocation(errorDetails.line, errorDetails.column);
            
            return false;
        }
        }
        
        /*
     * Highlight asWarnAjvsyntaxCconst  
           syntaxCning    ngue t                   ON based on a JSON path
     * @param {string} path The dot-notation path to thinshowValAjv library not available for schema validation');
            return { 
                isValid: true, 
                errors: [{ 
                    message: 'Schema validation skipped (Ajv not available)',
                    isWarning: true 
                }] 
            };
sonPath(path) {
        if (!path) return;
        
        try {
            const json = JSON.parse(this.textarea.value);
        const pathParts = path.split('.');
        let value =json;
            l
        
        // Navigate to thlocationreconsisWarnAjvsyntaxCconst  
           syntaxCning    ngue t                           for (const part of pathParts) {
                if (part && value && typeof value === 'object') {
                    value = value[part];
                } else {
                    found = false;
                    break;
                thinshowValAjv library not available for schema validation');
            return { 
                isValid: true, 
                errors: [{ 
                    message: 'Schema validation skipped (Ajv not available)',
                    isWarning: true                 }]lsonPath          
        // Convert the object to string to find where it is          thlocationreconsisWarnAjvsyntaxCconst  
           syntaxCning    ngue t                           r = typeof value === 'object' 
                ? JSON.stringify(value) 
                : String(value);
            
            // Find the position in the text
            const fullText = this.textarea.value;
        
        // We need to handle property names and values
            // Last part of the path is the property name
            const lastPart = pathParts[pathParts.length - 1];
            const propertyPattern = new R                 }]lailable for schema validation');
            return { 
                id: true, 
                errors: [{ 
                    message: 'Schema validathlocationreconsisWarnAjvsyntaxCconst  
           syntaxCning    ngue t                           rAjv not available)',
                    isWarning: true 
                }] 
            };
sonPath          
to string to find where it is in the text
            const valueStr = typeof value === 'object' 
                ? JSON.stringify(value) 
                : String(value);
            
            // Find the position in the text
                const fullText = this.textareaR                 }]lhe property name + colon length
                const valid propertyPos + match[0].length;
                
                // Set focus and selection
                this.textarea.focus();
                validathlocationreconsisWarnAjvsyntaxCconst  
           syntaxCning    ngue t                           rarea.setSelectionRange(valuePos, valuePosCthinshowValAjv library not available for schema validation');
            return { 
                isValid: true, 
                errors: [{ 
                    message: 'Schema validation skipped (Ajv not available)',
                    isWarning: true 
                }] 
            };
sonR                 }]l value === 'object' 
                ? Jvalidify(value) 
                : String(valueonst textBeforePos = fullTex// Find the position in the text0, valuePos);
         fullTextt lthis.textarea.value;
        
        // Scroll to the linevalidathlocationreconsisWarnAjvsyntaxCconst  
           syntaxCning    ngue t                           rarea    this.scrollToLine(line);
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
        sonR                 }]le for schema validation');
            retuJvalidify                        isValid: true, 
                errors: [{ 
                    message: 'Schema validation skipped (Ajv not available)',
                    isWarning: true 
                }] 
            };
sonPath          
               
               valueStret typeof value === 'object' 
                ? JSlinevalidathlocationreconsisWarnAjvsyntaxCconst  
           syntaxCning    ngue t                           rarea    ringify(value) 
                : String(valueonst textBeforePos = fullTex// Find the position in the text0, valuePos);
         fullTextt lthis.textarea.value;
son, null, 2);
          sonR                 }]lescrollToLine(line);
            }
        retuJvalidify        h (e) {
            console.warn('Error finding JSON path:', e);
        }
owValidationMessage('JSON formatted', true);
            
            return true;
        } catch (error) {
            // Don't format cvaluePosCthinshowValAjv library not available for schema validation');
            return { 
                isValid: true, 
                errors: [{ 
                    message: 'Schema validation skipped (Ajv? JSlinevalidathlocationreconsisWarnAjvsyntaxCconst  
           syntaxCning    ngue t                           rarea    ringify,
                    isWarning: true 
                }] 
            };
sonPath          
Strwhere it is               
               valueretuJvalidify        hypeof value === 'objesonR                 }]le) 
                : String(valueonst textBeforePos = fullTex// Find the position in the text0, valuePos);
         fullTextt lthis.textarea.value;
son, null, 2);
          // Scroll to the line
                this.scrollToLine(line);
            }
        } catch (e) {
        console.warn('Error finding JSON path:', e);
        }
        
        if (value.trim() === '') {
            return true;
        }
        
        try {
            const json = JSON.parse? JSlinevalidathlocationreconsisWarnAjvsyntaxCconst  
           syntaxCning    ngue t                           rarea    ringify,
PosCthinshowValAjv libvalueretuJvalidify        hilable for schemaobjesonR                 }]le                      isValid: true, 
                errors: [{ 
                    message: 'Schema validation skipped (Ajv not available)',
                    isWarning: true 
                }] 
            };
sonPath          
Strwhere               
               valueStret typeof value === 'object' 
                ? JSON.stringify(value) 
                : String(valueonst textBeforePos = fullTex// Find the position in the text0, valuePos);
         fullTextt lthis.textarea.value;
son, null, 2);
          // Scroll to the line
                this.scrollToLine(line);
            ? JSlinevalidathlocationreconsisWarnAjvsyntaxCconst  
           libvalueretuJvalidify        hilablee t  schemaobjesonR                 }]le      PosCthinshowValAjvwarn('Error finding JSON path:', e);
        }
                                /**
     * Analyze a JSON parse error to extract line and column information
     * @param {Error} error The error object from JSON.parse
     * @param {string} jsonString The JSON stConvert the objeccvaluePosCthinshowValAjv library not available for schema validation');
            return { 
                isValid: true, 
                errors: [{ 
                    message: 'Schema validation skipped (Ajv not available)',
                    isWarning: true 
                }] 
            };
sonPath          
Strwhere               
alue === 'object' 
                ? JSON.stringify(value) 
                ? JSlinevalidathlocationreconsisWarnAjvsyntaxCconst  
           syntaxCning    ngue t                           rarea    ringify,
PosCthinshowValAjvwarnition in the text0, valuePos);
         fullTextt lthis.textarea.value;
son, null, 2);
          // Scroll to the line
                this.scrollToLine(line);
fo = {
            message: error.mess            colume        };
        tract position fole.warn('Error finding JSON path:', e)r message (inspired by svelte-jsoneditor's error haExample error message: "Unexpected token } in JSON at position 42"
        const positionMatch = error.message.match(/position\s+(\d+)/i);
        
        if (positionMatch) {
            const p stConvert the object to sobjeccvaluePosCthinshowValAjv library not available for schema validation');
            return { 
                isValid: true, 
                errors: [{ 
                    message: 'Schema validation skipped (Ajv not available)',
                    isWarning: true 
                }] 
            };
sonPath          
Strwhere               
bject' 
                ? JSON.stringify(value) 
                ? JSlinevalidathlocationreconsisWarnAjvsyntaxCconst  
           syntaxCning    ngue t                           rarea    ringify,
PosCthinshowValAjvwarnitionthe position in the text0, valuePos);
         fullTextt lthis.textarea.value;
son, null, 2);
          // Scroll to the line
                this.scrollToLine(line);
fo = {
  
            for (let i = 0;                        if (jse        ing[i] === '\n') {
                    line++;
fole.warn('Error finding JSON path:', e)r         lineStart = i + 1;
                }
            haExample         const column = position - lineStart + 1;
            
            errorInfo.lsobjeccvaluePosCthinshowValAjv library not available for schema validation');
            return { 
                isValid: true, 
                errors: [{ 
                    message: 'Schema validation skipped (Ajv not available)',
                    isWarning: true 
                }] 
            };
sonPath          
Strwhere               
bject' 
text for the error
            p stConvert the object to string(valueStrwhere it is               
               valueStret typeof value === 'object' 
                ? JSON.st? JSlinevalidathlocationreconsisWarnAjvsyntaxCconst  
           syntaxCning    ngue t                           rarea    ringify,
PosCthinshowValAjvwarnitionthextBeforePos = fullTex// Find the position in the text0, valuePos);
         fullTextt lthis.textarea.value;
son, null, 2);
          // Scroll to the line
                this.scrollToLine(line);
fo = {
  
            for (let i = 0;                        if (jse        ing context;
            errorInfo.pointer = pointer;
            errfole.warn('Error finding JSON prInfo.message = this.formatErrorMessage(error.mehaExample         ;lse {
            // Try other error formats
            // Chrome-like: "Unexpected token } in JSON at position 42"
            // Firefox-like: "JSON.parse: unexpected character at line 2 column 3 of thp stConvert the object to string(valueStrwhere it is               
               valueStret typeof value === 'object' 
                ? JSON.stringify(value) 
                : String(valueonst textBeforePos = fullTex// Find the position in the text0, valuePos);
         fullTextt lthis.textarea.value;
son, null, 2);
          // Scroll to the line
                this.scrollToLine(line);
fo = {
  
            for (let i = 0;                        if (jse        ing= parseInt(lineColumnMatch[2], 10);
     errfole.warn('Error finding JSON path:', e)r         orInfo  
                // Provide context formehaExample                   constprInfo'\n');
                const errorLine = lines[errorInfo.line                 const context = errorLine.trim();
                const pointer = ' '.repeat(Math.max(0, errorInfo.column - 1)) + '^';
                
                errorInfo.context = conthp stConvert the object to string(valueStrwhere it is               
               valueStret typeof value === 'object' 
                ? JSON.stringify(value) 
                : String(valueonst textBeforePos = fullTex// Find the position in the text0, valuePos);
         fullTextt lthis.textarea.value;
son, null, 2);
          // Scroll to the line
                this.scrollToLine(line);
fo = {
  
            for (let i = 0;                        if (jse        ingrrorInfo;
    }
    
    /*2], 10);
     errfole.warn('Error finding JSON path:', e)r         orInfo  
                // Provide context formehaExample                   constprInfo {string} A formatted error message
     */
    formatErrorMes                ssage, context) {
        // Extract the core error type
        let message = errorMessage;
        
        // Simplify common error messages
        if (message.includes('Unexpectconthp stConvert the object to string(valueStrwhere it is               
               valueStret typeof value === 'object' 
                ? JSON.stringify(value) 
                : String(valueonst textBeforePos = fullTex// Find the position in the text0, valuePos);
         fullTextt lthis.textarea.value;
son, null, 2);
          // Scroll to the line
                this.scrollToLine(line);
fo = {
  
            for (let i = 0;                        if (jse        ingrrorInfo;
    }
    
    /*2], 10);
     errfole.warn('Error finding JSON path:', e)r         orInfo  
                // Provide context formehaExample                   constprInfocate object key found';
        }
        
        return message;                ssage    * Show a validation message in the log container
     * @param {string} message The message to show
     * @param {boolean} isSuccess Whether it's a success message
     */
    showValidationMessage(messaconthp stConvert the object to string(valueStrwhere it is               
               valueStret typeof value === 'object' 
                ? JSON.stringify(value) 
                : String(valueonst textBeforePos = fullTex// Find the position in the text0, valuePos);
         fullTextt lthis.textarea.value;
son, null, 2);
          // Scroll to the line
                this.scrollToLine(line);
fo = {
  
            for (let i = 0;                        if (jse        ingrrorInfo;
    }
    
    /*2], 10);
     errfole.warn('Error finding JSON path:', e)r         orInfo  
                // Provide context formehaExample                   constprInfocategContainer.textConte                ssage    / Hide message after a delay
        if (message) {
            clearTimeout(this.logTimeoutId);
            this.logTimeoutId = setTimeout(() => {
                this.logContainer.style.display = 'none';
            }, 5000);
        }
    }
    
    /**
     * Highlight the error location imessaconthp stConvert the object to string(valueStrwhere it is               
               valueStret typeof value === 'object' 
                ? JSON.stringify(value) 
                : String(valueonst textBeforePos = fullTex// Find the position in the text0, valuePos);
         fullTextt lthis.textarea.value;
son, null, 2);
          // Scroll to the line
                this.scrollToLine(line);
fo = {
  
            for (let i = 0;                        if (jse        ingrrorInfo;
    }
    
    /*2], 10);
     errfole.warn('Error finding JSON path:', e)r         orInfo  
                // Provide context formehaExample                   constprInfocategContaineraracter
        }
        
        position += column - 1;
        
        // Set selection to the error location
        this.textarea.focus();
        this.textarea.setSelectionRange(position, position + 1);
        
        // If line numbers are enabled, ensure the error line is visible
        if (this.lineNumbersEnabledimessaconthp stConvert the object to string(valueStrwhere it is               
               valueStret typeof value === 'object' 
                ? JSON.stringify(value) 
                : String(valueonst textBeforePos = fullTex// Find the position in the text0, valuePos);
         fullTextt lthis.textarea.value;
son, null, 2);
          // Scroll to the line
                this.scrollToLine(line);
fo = {
  
            for (let i = 0;                        if (jse        ingrrorInfo;
    }
    
    /*2], 10);
     errfole.warn('Error finding JSON path:', e)r         orInfo  
                // Provide context formehaExample                   constprInfocategContaineraracter
ment.style.fontWeight = 'bold';
                
                // Reset the highlight after a delay
                setTimeout(() => {
                    errorLineElement.style.backgroundColor = '';
                    errorLineElement.style.color = '#999';
                    errorLinlineNumbersEnabledimessaconthp stConvert the object to string(valueStrwhere it is               
               valueStret typeof value === 'object' 
                ? JSON.stringify(value) 
                : String(valueonst textBeforePos = fullTex// Find the position in the text0, valuePos);
         fullTextt lthis.textarea.value;
son, null, 2);
          // Scroll to the line
            this.scrollToLine(line);
        fo = {
  
            for (let i = 0;                        if (jse        ingrrorInfo;
    }
    
    /*2], 10);
     errfole.warn('Error finding JSON path:', e)r         orInfo  
                // Provide context formehaExample                   constprInfocategContaineraracter
mentr: rgba(255, 0, 0, 0.1); width: 100%;">${originalLine}</div>`;
            this.displayCode.innerHTML = lines2.join('\n');
            
            // Reset the highlight after a delay
            setTimeout(() => {
        this.updateDisplay();
}, 5000);
        }
    }
    
    /**
     errorLinlineNumbersEnabledimessaconthp stConvert the object to string(valueStrwhere it is               
               valueStret typeof value === 'object' 
                ? JSON.stringify(value) 
                : String(valueonst textBeforePos = fullTex// Find the position in the text0, valuePos);
         fullTextt lthis.textarea.value;
son, null, 2);
          // Scroll to the line
        if (!this.textarea) returfo = {
  
            for (let i = 0;                        if (jse        ingrrorInfo;
    }
    
    /*2], 10);
     errfole.warn('Error finding JSON path:', e)r         orInfo  
                // Provide context formehaExample                   constprInfocategContaineraracter
mentrth + 1; // +1 for newline character
        }
        
        // Set cursor position to the beginning of the line
        t}, 5000);
        }
his.textarea.focus();
        this.textarea.setSelectionRange(position, position);
        
        // Calculate approximate line height (based on font size)
        const lineHeight = parseInt(getComputedStyle(this.textarea).fontSize, 10) * 1.2;
            
            // Calculate scroll position
        const targetPosition = (lineNumber - 1) * lineHeight;
        
        // Scroll to pofo = {
  
            for (let i = 0;                        if (jse        ingrrorInfo;
    }
    
    /*2], 10);
     errfole.warn('Error finding JSON path:', e)r         orInfo  
                // Provide context formehaExample                   constprInfocategContaineraracter
mentrth000);
        }
his  this.synchronizeScrolling();
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
                liCaerro    fontWeigpofo = {
  
            for (let i = 0;                        if (jse        ingrrorInfo;
    }
    
    /*2], 10);
     errfole.warn('Error finding JSON path:', e)r         orInfo  
                // Provide context formehaExample                   constprInfocategContaineraracter
mentrth000);
tainer) {
            this.logContainer.style.display = 'none';
        }
    }

    /**
     * Set the editor's value
     * @param {string|Object} value JSON string or object to se/**
     * Clear any error highlighting
     */
    clearErrorHighlighting(   setValue(valu// Clear line number highlighting
        if (this.lineNumbersEnabled && this.lineNumbersContainer) {
            const lineElements = this.lineNumbersContainer.children;
            for (let i = 0; i < lineElements.length; i++) {
                lineElements[i].style.backgroundColor = '';
liCaerro    fontWeigpofo = {
  
            for (let i = 0;                        if (jse        ingrrorInfo;
     errfole.warn('Error finding JSON path:', e)r         orInfo  
                // Provide context formehaExample                   constprInfocategContaineraracter
mentrth000);
tainer) {
String = '';
            }
        } else if (typeof value === 'string') {
            jsonString = value;
        } else {
            jsonString = String(value);
        }
        
        // Set textarea value
        this.textarea.value = jsonString;
        
        // Update the display
        this.updateDisp/**
     * Clear any error highlighting
        */
clearErrorHighlighting(   setValue(valu// Clear line number highlighting
        if (this.lineNumbersEnabled &&t}, 5000);
this.lineNumbersContainer) his      }
{
            const lineElements = this.lineNumbersContain/*2], 10);
     errfole.warn('Error finding JSON path:', e)r         orInfo  
                // Provide context formehaExample                   constprInfocategContaineraracter
mentrth000);
tainer) {
String';
e editor
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
t}, 5000);
                /**
     *    }
his      }
        }
        
        retur*/
ue;
    }

    /**
     setValulu// Clear line number highlighti/*2], 10);
     errfole.warn('Error finding JSON path:', e)r         orInfo  
                // Provide context formehaExample                   constprInfocategContaineraracter
mentrth000);
tainer) {
String';
oundColor = '';
                lineElements[i].style.color = '#999';
                lineElements[i].style.fontWeight = 'normal';
eirst
        const existingModal = document.getElementById('ngsi-attribute-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal container
        const modal = document.createElement(/**
     *       modal.id = 'ng*/
ueibute-modal';
        modhis      }
al.style.position = 'fixed';
        modal.style.top ';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        modasetValue(valu// Clear line number highlighting
        if (this.lineNumbersEnabled && this.lineNumbersContainer) {
            const lineElements = this.lineNumbersContainer.children;
            for (let i = 0; i < lineElements.length; i++) {
                lineElements[i].style.backgroundColor = '';
                lineElements[i].style.color = '#999';
                lineElements[i].style.fontWeight = 'normal';
eex = '9999';

        // Create modal
        con/**
     *       Content = document.cre*/
ueibutediv');
        momodhis      }
alntent.style.backgroundColor = 'white';
        modatent.style.borderRadius = '8px';
        modalContent.style.padding = '20px';
        modalContent.style.width = '500px';
        modalContent.style.maxWidth = '90%';
        modalContent.style.maxHeight = '90vh';
        modalContent.style.overflowY = 'auto';
        modalContent.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.2)';

        // Create modal header
        const header = document.createElement('div')modasetValue(valu// Clear line number highlighting
        if (this.lineNumbersEnabled && this.lineNumbersContainer) {
            const lineElements = this.lineNumbersContainer.children;
            for (let i = /*       ineElements.length;cre*/
ueibutediv      lineElmomodhis      }
alntentyle.backgroundColor = '';
                lineents[i].style.color = '#999';
                lineElements[i].style.fontWeight = 'normal';
eex  header.style.marginBottom = '20px';
        header.style.borderBottom = '1px solid #eee';
        header.style.paddingBottom = '10px';

        const title = document.createElement('h3');
        title.textContent = 'Insert NGSI-LD Attribute';
        title.style.margin = '0';
        title.style.fontSize = '18px';
        title.style.fontWeight = 'bold';

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.style.background = 'none';
        closeBtn.style.border = 'none';
        cln.s/*    *       ineElements.length;cre*/
ueibutediv      lineElmomodhis      }
alntentylesetValue(valu// Clear line number highlight        if (this.lineNumbersEnabled && this.lineNumbersContainer) {
            const lineElements = this.lineNumbersContainer.children;
            for (let i = 0; i < lineElements.length; i++) {
                lineElements[i].style.backgroundColor = '';
                lineElements[i].style.color = '#999';
                lineElements[i].style.fontWeight = 'normal';
eex  .appendChild(closeBtn);

        // Create form
        const form = document.createElement('form');
        form.onsubmit = (e) => {
            e.preventDefault();
            this.processAttributeForm(form);
            modal.remove();
        };

        // Create fs/**
     *       ineElements.lecln*/
u    butediv      lineElmomodhis      }
alntentylesetValue('div');
        nameGroup.style.ma        Bottom = '15px';

        const nameLabel = document.createElement('label');
        nameLabel.textContent = 'Attribute Name:';
        nameLabel.htmlFor = 'attr-name';
        nameLabel.style.display = 'block';
        nameLabel.style.marginBotmodasetValue(valu// Clear line number highlighting
        if (this.lineNumbersEnabled && this.lineNumbersContainer) {
            const lineElements = this.lineNumbersContainer.children;
            for (let i = 0; i < lineElements.length; i++) {
                lineElements[i].style.backgroundColor = '';
                lineElements[i].style.color = '#999';
                lineElements[i].style.fontWeight = 'normal';
eex  ut.type = 'text';
        fs/**
     *leclnElem    ts.length;cre*/
ueibutediv      lineElmomodhis      }
alntentylesetValueplaceholder = 'e.g., temperature'ma        BottommeInput.required = true;
        nameInput.style.width = '100%';
        nameInput.style.padding = '8px';
        nameInput.style.boxSizing = 'border-box';
        nameInput.style.border = '1px solid #ddd';
        nameInput.style.borderRadius = '4px';
        nameInput.value = 'temperature';

        nameGroup.appendChild(nameLabel);
        nameGroup.appendChild(nameInput);

        // 2. Attribute Type
        const typeGroup = document.createElement('div');
        marginBotmodasetValue(valu// Clear line number highlighting
        if (this.lineNumbersEnabled && this.lineNumbersContainer) {
            const lineElements = this.lineNumbersContainer.children;
            for (leleclnElem    tslemfs/**
     *       ineElements.length;cre*/
ueibutediv      lineElmomodhis      }
alntentylesetValueplaceholder  lineElements[i].stylma        BottommeInput               lineElements[i].style.fontWeight = 'normal';
eex  utpe:';
        typeLabel.style.display = 'block';
        typeLabel.style.marginBottom = '5px';
        typeLabel.style.fontWeight = 'bold';

        const typeOptions = document.createElement('div');
        typeOptions.style.display = 'flex';
        typeOptions.style.gap = '15px';

        // Create radio buttons for types
        const types = ['Property', 'GeoProperty', 'Relationship'];
        types.forEach((type, index) => {
            const radioContainer = document.createElement('div');
            radioContainer.style.display = 'flex';
            radioContainer.style.aleleclnElem    tslemfs                 marginBotmodasetValue(vallineElemfs/**
     *       ineElements.length;cre*/
ueibutediv      lineElmomodhis      }
alntentylesetValueplaceholder  lineElements[i].stylma        BottommeInput               ineNumbersContainer.children;
            for (let i = 0; i < lineElements.length; i++) {
                lineElements[i].style.backgroundColor = '';
                lineElements[i].style.color = '#999';
                lineElements[i].style.fontWeight = 'normal';
eex  utpe:';
            radio.name = 'attrType';
            radio.value = type;
            radio.checked = index === 0; // Select first option by default
            radio.style.margin = '0 5px 0 0';
            radio.onchange = () => this.handleTypeChange(radio.value);

            const radioLabel = document.createElement('label');
            aleleclnElem    tslemfs     or = `type-${type.toLowerCase()}`;
            radioLabel.textContent = typevallineElemfs/**
     *       ineElements.length;cre*/
ueibutediv      lineElmomodhis      }
alntentylesetValueplaceholder  lineElements[i].stylma        BottommeInput               ineNumbersContainer);

        typeGroup.appendChild(typeLabel);
        typeGroup.appendChild(marginBotmodasetValue(valu// Clear line number highlighting
        if (this.lineNumbersEnabled && this.lineNumbersContainer) {
            const lineElements = this.lineNumbersContainer.children;
            for (let i = 0; i < lineElements.length; i++) {
                lineElements[i].style.backgroundColor = '';
                lineElements[i].style.color = '#999';
                lineElements[i].style.fontWeight = 'normal';
eex  utpe:';
alueGroup.id = 'value-section';
        valueGroup.style.marginBottom = '15px';

        const valueLabel = document.createElement('label');
        valuetypevallineElemfs/**
     *       ineElements.length;cre*/
ueibutediv      lineElmomodhis      }
alntentylesetValueplaceholder  lineElements[i].stylma        BottommeInput               ineNumbersContainer);
        valueLabel.style.fontWeight = 'bold';

        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.id = 'attr-value';
        valueInput.name = 'attrValue';
        valueInput.placeholder = 'e.g., 23.5';
        valueInput.required = true;
        valueInput.style.width = '100%';
        vamarginBotmodasetValue(valu// Clear line number highlighting
        if (this.lineNumbersEnabled && this.lineNumbersContainer) {
            const lineElements = this.lineNumbersContainer.children;
            for (let i = 0; i < lineElements.length; i++) {
                lineElements[i].style.backgroundColor = '';
        lineElements[i].style.color = '#999';
        lineElements[i].style.fontWeight = 'normal';
eex  utpe:';

        valueInput.style.borderRadius = '4px';
        valueInput.value = '23.5';

        // Create GeoProperty fields (initially hidden)
        const geoGroup = document.createElement('div');
        geoGroup.id = 'geo-coordinates';
        geoGroup.style.display = 'none';
        geoGroup.style.marginTop = '10px';
        geoGroup.style.gap = '10px';

        const lonGroup = document.createElement('div');
        lonGroup.style.marginBottom = '10px';

        const lonLabel = document.createElement('label');
        lonLabel.textContent = 'Longitude:';
        lonLabel.htmlFor = 'geo-lon';
        lonLabel.style.display = 'block';
        lonLabel.style.marginBottom = '5px';

        const lonInput = document.createElement('input');
        lonInput.type = 'number';
        lonInput.id = 'geo-lon';
        lonInput.name = 'geoLon';
        lonInput.placeholder = 'e.g., 10.0';
        lonInput.step = 'any';
        lonInput.style.width = '100%';
        lonInput.style.padding = '8px';
        lonInput.style.boxSizing = 'border-box';
        lonInput.style.border = '1px solid #ddd';
        lonInput.style.borderRadius = '4px';
        lonInput.value = '10.0';

        const latGroup = document.createElement('div');

        const latLabel = document.createElement('label');
        latLabel.textContent = 'Latitude:';
        latLabel.htmlFor = 'geo-lat';
        latLabel.style.display = 'block';
        latLabel.style.marginBottom = '5px';

        const latInput = document.createElement('input');
        latInput.type = 'number';
        latInput.id = 'geo-lat';
        latInput.name = 'geoLat';
        latInput.placeholder = 'e.g., 20.0';
        latInput.step = 'any';
        latInput.style.width = '100%';
        latInput.style.padding = '8px';
        latInput.style.boxSizing = 'border-box';
        latInput.style.border = '1px solid #ddd';
        latInput.style.borderRadius = '4px';
        latInput.value = '20.0';

        lonGroup.appendChild(lonLabel);
        lonGroup.appendChild(lonInput);
        latGroup.appendChild(latLabel);
        latGroup.appendChild(latInput);

        geoGroup.appendChild(lonGroup);
        geoGroup.appendChild(latGroup);

        valueGroup.appendChild(valueLabel);
        valueGroup.appendChild(valueInput);
        valueGroup.appendChild(geoGroup);

        // 4. Metadata Section
        const metadataGroup = document.createElement('div');
        metadataGroup.style.marginBottom = '15px';

        const metadataCheck = document.createElement('input');
        metadataCheck.type = 'checkbox';
        metadataCheck.id = 'include-metadata';
        metadataCheck.name = 'includeMetadata';
        metadataCheck.style.marginRight = '8px';

        const metadataLabel = document.createElement('label');
        metadataLabel.htmlFor = 'include-metadata';
        metadataLabel.textContent = 'Include Metadata';
        metadataLabel.style.fontWeight = 'bold';

        const metadataSection = document.createElement('div');
        metadataSection.id = 'metadata-section';
        metadataSection.style.marginTop = '10px';
        metadataSection.style.display = 'none';
        metadataSection.style.padding = '10px';
        metadataSection.style.backgroundColor = '#f8f9fa';
        metadataSection.style.borderRadius = '4px';

        // Add observedAt metadata by default
        const observedAtGroup = document.createElement('div');
        observedAtGroup.style.marginBottom = '10px';

        const observedAtCheck = document.createElement('input');
        observedAtCheck.type = 'checkbox';
        observedAtCheck.id = 'include-observed-at';
        observedAtCheck.name = 'includeObservedAt';
        observedAtCheck.checked = true;
        observedAtCheck.style.marginRight = '8px';

        const observedAtLabel = document.createElement('label');
        observedAtLabel.htmlFor = 'include-observed-at';
        observedAtLabel.textContent = 'Add observedAt timestamp';

        observedAtGroup.appendChild(observedAtCheck);
        observedAtGroup.appendChild(observedAtLabel);

        // Custom metadata
        const customMetaGroup = document.createElement('div');
        
        const customMetaNameGroup = document.createElement('div');
        customMetaNameGroup.style.marginBottom = '8px';

        const customMetaNameLabel = document.createElement('label');
        customMetaNameLabel.textContent = 'Metadata Name:';
        customMetaNameLabel.htmlFor = 'metadata-name';
        customMetaNameLabel.style.display = 'block';
        customMetaNameLabel.style.marginBottom = '5px';

        const customMetaNameInput = document.createElement('input');
        customMetaNameInput.type = 'text';
        customMetaNameInput.id = 'metadata-name';
        customMetaNameInput.name = 'metadataName';
        customMetaNameInput.placeholder = 'e.g., unitCode';
        customMetaNameInput.style.width = '100%';
        customMetaNameInput.style.padding = '8px';
        customMetaNameInput.style.boxSizing = 'border-box';
        customMetaNameInput.style.border = '1px solid #ddd';
        customMetaNameInput.style.borderRadius = '4px';
        customMetaNameInput.value = 'unitCode';

        customMetaNameGroup.appendChild(customMetaNameLabel);
        customMetaNameGroup.appendChild(customMetaNameInput);

        const customMetaValueGroup = document.createElement('div');

        const customMetaValueLabel = document.createElement('label');
        customMetaValueLabel.textContent = 'Metadata Value:';
        customMetaValueLabel.htmlFor = 'metadata-value';
        customMetaValueLabel.style.display = 'block';
        customMetaValueLabel.style.marginBottom = '5px';

        const customMetaValueInput = document.createElement('input');
        customMetaValueInput.type = 'text';
        customMetaValueInput.id = 'metadata-value';
        customMetaValueInput.name = 'metadataValue';
        customMetaValueInput.placeholder = 'e.g., CEL';
        customMetaValueInput.style.width = '100%';
        customMetaValueInput.style.padding = '8px';
        customMetaValueInput.style.boxSizing = 'border-box';
        customMetaValueInput.style.border = '1px solid #ddd';
        customMetaValueInput.style.borderRadius = '4px';
        customMetaValueInput.value = 'CEL';

        customMetaValueGroup.appendChild(customMetaValueLabel);
        customMetaValueGroup.appendChild(customMetaValueInput);

        customMetaGroup.appendChild(customMetaNameGroup);
        customMetaGroup.appendChild(customMetaValueGroup);

        metadataSection.appendChild(observedAtGroup);
        metadataSection.appendChild(customMetaGroup);

        metadataGroup.appendChild(metadataCheck);
        metadataGroup.appendChild(metadataLabel);
        metadataGroup.appendChild(metadataSection);

        // Toggle metadata section visibility
        metadataCheck.addEventListener('change', function() {
            metadataSection.style.display = this.checked ? 'block' : 'none';
        });

        // Buttons
        const buttonGroup = document.createElement('div');
        buttonGroup.style.display = 'flex';
        buttonGroup.style.justifyContent = 'flex-end';
        buttonGroup.style.marginTop = '20px';
        buttonGroup.style.gap = '10px';

        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.textContent = 'Cancel';
        cancelButton.style.padding = '8px 16px';
        cancelButton.style.border = '1px solid #ddd';
        cancelButton.style.borderRadius = '4px';
        cancelButton.style.backgroundColor = '#f2f2f2';
        cancelButton.style.cursor = 'pointer';
        cancelButton.onclick = () => modal.remove();

        const submitButton = document.createElement('button');
        submitButton.type = 'submit';
        submitButton.textContent = 'Insert';
        submitButton.style.padding = '8px 16px';
        submitButton.style.border = 'none';
        submitButton.style.borderRadius = '4px';
        submitButton.style.backgroundColor = '#4CAF50';
        submitButton.style.color = 'white';
        submitButton.style.cursor = 'pointer';

        buttonGroup.appendChild(cancelButton);
        buttonGroup.appendChild(submitButton);

        // Assemble the form
        form.appendChild(nameGroup);
        form.appendChild(typeGroup);
        form.appendChild(valueGroup);
        form.appendChild(metadataGroup);
        form.appendChild(buttonGroup);

        // Assemble the modal
        modalContent.appendChild(header);
        modalContent.appendChild(form);
        modal.appendChild(modalContent);

        // Add modal to document
        document.body.appendChild(modal);

        // Initial setup based on default type (Property)
        this.handleTypeChange('Property');

        // Set focus to the first field
        nameInput.focus();

        return modal;
    }

    /**
     * Handle attribute type change in the form
     * @private
     * @param {string} type The selected attribute type
     */
    handleTypeChange(type) {
        const valueInput = document.getElementById('attr-value');
        const valueLabel = valueInput.previousElementSibling;
        const geoGroup = document.getElementById('geo-coordinates');
        
        // Update based on type
        if (type === 'GeoProperty') {
            valueInput.style.display = 'none';
            geoGroup.style.display = 'block';
            valueLabel.textContent = 'Coordinates:';
        } else if (type === 'Relationship') {
            valueInput.style.display = 'block';
            geoGroup.style.display = 'none';
            valueLabel.textContent = 'Target Entity:';
            valueInput.placeholder = 'e.g., urn:ngsi-ld:Entity:123';
            valueInput.value = valueInput.value === '23.5' ? 'urn:ngsi-ld:Entity:123' : valueInput.value;
        } else {
            // Property
            valueInput.style.display = 'block';
            geoGroup.style.display = 'none';
            valueLabel.textContent = 'Value:';
            valueInput.placeholder = 'e.g., 23.5';
            valueInput.value = valueInput.value === 'urn:ngsi-ld:Entity:123' ? '23.5' : valueInput.value;
        }
    }

    /**
     * Process the attribute form submission
     * @private
     * @param {HTMLFormElement} form The form element
     */
    processAttributeForm(form) {
        try {
            // Get current editor content
            const currentValue = this.getValue();
            let jsonObj;
            
            try {
                jsonObj = JSON.parse(currentValue);
            } catch (e) {
                console.error('Error parsing current JSON:', e);
                this.showValidationMessage('Cannot insert attribute: The current content is not valid JSON', false);
                return;
            }
            
            // Get form values
            const formData = new FormData(form);
            const attributeName = formData.get('attrName');
            const attributeType = formData.get('attrType');
            const attributeValue = formData.get('attrValue');
            const includeMetadata = formData.get('includeMetadata') === 'on';
            const includeObservedAt = formData.get('includeObservedAt') === 'on';
            const metadataName = formData.get('metadataName');
            const metadataValue = formData.get('metadataValue');
            
            // Create attribute object based on type
            const attribute = {};
            
            if (attributeType === 'Relationship') {
                attribute[attributeName] = {
                    "type": "Relationship",
                    "object": attributeValue
                };
            } else if (attributeType === 'GeoProperty') {
                const longitude = parseFloat(formData.get('geoLon'));
                const latitude = parseFloat(formData.get('geoLat'));
                
                attribute[attributeName] = {
                    "type": "GeoProperty",
                    "value": {
                        "type": "Point",
                        "coordinates": [longitude, latitude]
                    }
                };
            } else {
                // Default to regular Property
                attribute[attributeName] = {
                    "type": "Property",
                    "value": isNaN(attributeValue) ? attributeValue : parseFloat(attributeValue)
                };
            }
            
            // Add metadata if requested
            if (includeMetadata) {
                if (includeObservedAt) {
                    attribute[attributeName].observedAt = new Date().toISOString();
                }
                
                if (metadataName && metadataValue) {
                    attribute[attributeName][metadataName] = {
                        "type": "Property",
                        "value": isNaN(metadataValue) ? metadataValue : parseFloat(metadataValue)
                    };
                }
            }
            
            // Merge the attribute into the existing JSON
            Object.assign(jsonObj, attribute);
            
            // Update the editor
            this.setValue(jsonObj);
            
            // Show success message
            this.showValidationMessage(`Added ${attributeType}: ${attributeName}`, true);
            
        } catch (e) {
            console.error('Error processing attribute form:', e);
            this.showValidationMessage(`Error inserting attribute: ${e.message}`, false);
        }
    }

    /**
     * Insert a NGSI-LD relationship into the current JSON
     */
    insertRelationship = () => {
        // Create a modal dialog similar to attribute insertion
        const modal = this.createRelationshipModal();
        return modal;
    }
    
    /**
     * Create a modal dialog for relationship insertion
     * @private
     */
    createRelationshipModal() {
        // Remove any existing modals first
        const existingModal = document.getElementById('ngsi-relationship-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal container
        const modal = document.createElement('div');
        modal.id = 'ngsi-relationship-modal';
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
        modalContent.style.backgroundColor = 'white';
        modalContent.style.borderRadius = '8px';
        modalContent.style.padding = '20px';
        modalContent.style.width = '500px';
        modalContent.style.maxWidth = '90%';
        modalContent.style.maxHeight = '90vh';
        modalContent.style.overflowY = 'auto';
        modalContent.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.2)';

        // Create modal header
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '20px';
        header.style.borderBottom = '1px solid #eee';
        header.style.paddingBottom = '10px';

        const title = document.createElement('h3');
        title.textContent = 'Insert NGSI-LD Relationship';
        title.style.margin = '0';
        title.style.fontSize = '18px';
        title.style.fontWeight = 'bold';

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.style.background = 'none';
        closeBtn.style.border = 'none';
        closeBtn.style.fontSize = '20px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.padding = '0 5px';
        closeBtn.onclick = () => modal.remove();

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Create form
        const form = document.createElement('form');
        form.onsubmit = (e) => {
            e.preventDefault();
            this.processRelationshipForm(form);
            modal.remove();
        };

        // Create form fields
        // 1. Relationship Name
        const nameGroup = document.createElement('div');
        nameGroup.style.marginBottom = '15px';

        const nameLabel = document.createElement('label');
        nameLabel.textContent = 'Relationship Name:';
        nameLabel.htmlFor = 'rel-name';
        nameLabel.style.display = 'block';
        nameLabel.style.marginBottom = '5px';
        nameLabel.style.fontWeight = 'bold';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.id = 'rel-name';
        nameInput.name = 'relName';
        nameInput.placeholder = 'e.g., isPartOf';
        nameInput.required = true;
        nameInput.style.width = '100%';
        nameInput.style.padding = '8px';
        nameInput.style.boxSizing = 'border-box';
        nameInput.style.border = '1px solid #ddd';
        nameInput.style.borderRadius = '4px';
        nameInput.value = 'isPartOf';

        nameGroup.appendChild(nameLabel);
        nameGroup.appendChild(nameInput);

        // 2. Target Entity
        const targetGroup = document.createElement('div');
        targetGroup.style.marginBottom = '15px';

        const targetLabel = document.createElement('label');
        targetLabel.textContent = 'Target Entity:';
        targetLabel.htmlFor = 'target-entity';
        targetLabel.style.display = 'block';
        targetLabel.style.marginBottom = '5px';
        targetLabel.style.fontWeight = 'bold';

        const targetInput = document.createElement('input');
        targetInput.type = 'text';
        targetInput.id = 'target-entity';
        targetInput.name = 'targetEntity';
        targetInput.placeholder = 'e.g., urn:ngsi-ld:Entity:123';
        targetInput.required = true;
        targetInput.style.width = '100%';
        targetInput.style.padding = '8px';
        targetInput.style.boxSizing = 'border-box';
        targetInput.style.border = '1px solid #ddd';
        targetInput.style.borderRadius = '4px';
        targetInput.value = 'urn:ngsi-ld:Entity:123';

        targetGroup.appendChild(targetLabel);
        targetGroup.appendChild(targetInput);

        // 3. Metadata Section
        const metadataGroup = document.createElement('div');
        metadataGroup.style.marginBottom = '15px';

        // Add observedAt timestamp checkbox
        const observedAtGroup = document.createElement('div');
        observedAtGroup.style.marginBottom = '10px';

        const observedAtCheck = document.createElement('input');
        observedAtCheck.type = 'checkbox';
        observedAtCheck.id = 'include-observed-at';
        observedAtCheck.name = 'includeObservedAt';
        observedAtCheck.checked = true;
        observedAtCheck.style.marginRight = '8px';

        const observedAtLabel = document.createElement('label');
        observedAtLabel.htmlFor = 'include-observed-at';
        observedAtLabel.textContent = 'Add observedAt timestamp';
        observedAtLabel.style.fontWeight = 'bold';

        observedAtGroup.appendChild(observedAtCheck);
        observedAtGroup.appendChild(observedAtLabel);

        // Custom metadata section
        const customMetadataGroup = document.createElement('div');
        customMetadataGroup.style.marginBottom = '15px';

        const metadataCheck = document.createElement('input');
        metadataCheck.type = 'checkbox';
        metadataCheck.id = 'include-metadata';
        metadataCheck.name = 'includeMetadata';
        metadataCheck.style.marginRight = '8px';

        const metadataLabel = document.createElement('label');
        metadataLabel.htmlFor = 'include-metadata';
        metadataLabel.textContent = 'Include Additional Metadata';
        metadataLabel.style.fontWeight = 'bold';

        const metadataSection = document.createElement('div');
        metadataSection.id = 'rel-metadata-section';
        metadataSection.style.marginTop = '10px';
        metadataSection.style.display = 'none';
        metadataSection.style.padding = '10px';
        metadataSection.style.backgroundColor = '#f8f9fa';
        metadataSection.style.borderRadius = '4px';

        // Add metadata name/value fields
        const customMetaNameGroup = document.createElement('div');
        customMetaNameGroup.style.marginBottom = '8px';

        const customMetaNameLabel = document.createElement('label');
        customMetaNameLabel.textContent = 'Metadata Name:';
        customMetaNameLabel.htmlFor = 'rel-metadata-name';
        customMetaNameLabel.style.display = 'block';
        customMetaNameLabel.style.marginBottom = '5px';

        const customMetaNameInput = document.createElement('input');
        customMetaNameInput.type = 'text';
        customMetaNameInput.id = 'rel-metadata-name';
        customMetaNameInput.name = 'metadataName';
        customMetaNameInput.placeholder = 'e.g., weight';
        customMetaNameInput.style.width = '100%';
        customMetaNameInput.style.padding = '8px';
        customMetaNameInput.style.boxSizing = 'border-box';
        customMetaNameInput.style.border = '1px solid #ddd';
        customMetaNameInput.style.borderRadius = '4px';
        customMetaNameInput.value = 'weight';

        customMetaNameGroup.appendChild(customMetaNameLabel);
        customMetaNameGroup.appendChild(customMetaNameInput);

        const customMetaValueGroup = document.createElement('div');

        const customMetaValueLabel = document.createElement('label');
        customMetaValueLabel.textContent = 'Metadata Value:';
        customMetaValueLabel.htmlFor = 'rel-metadata-value';
        customMetaValueLabel.style.display = 'block';
        customMetaValueLabel.style.marginBottom = '5px';

        const customMetaValueInput = document.createElement('input');
        customMetaValueInput.type = 'text';
        customMetaValueInput.id = 'rel-metadata-value';
        customMetaValueInput.name = 'metadataValue';
        customMetaValueInput.placeholder = 'e.g., 0.8';
        customMetaValueInput.style.width = '100%';
        customMetaValueInput.style.padding = '8px';
        customMetaValueInput.style.boxSizing = 'border-box';
        customMetaValueInput.style.border = '1px solid #ddd';
        customMetaValueInput.style.borderRadius = '4px';
        customMetaValueInput.value = '0.8';

        customMetaValueGroup.appendChild(customMetaValueLabel);
        customMetaValueGroup.appendChild(customMetaValueInput);

        metadataSection.appendChild(customMetaNameGroup);
        metadataSection.appendChild(customMetaValueGroup);

        customMetadataGroup.appendChild(metadataCheck);
        customMetadataGroup.appendChild(metadataLabel);
        customMetadataGroup.appendChild(metadataSection);

        // Toggle metadata section visibility
        metadataCheck.addEventListener('change', function() {
            metadataSection.style.display = this.checked ? 'block' : 'none';
        });

        // Add metadata groups to form
        metadataGroup.appendChild(observedAtGroup);
        metadataGroup.appendChild(customMetadataGroup);

        // Buttons
        const buttonGroup = document.createElement('div');
        buttonGroup.style.display = 'flex';
        buttonGroup.style.justifyContent = 'flex-end';
        buttonGroup.style.marginTop = '20px';
        buttonGroup.style.gap = '10px';

        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.textContent = 'Cancel';
        cancelButton.style.padding = '8px 16px';
        cancelButton.style.border = '1px solid #ddd';
        cancelButton.style.borderRadius = '4px';
        cancelButton.style.backgroundColor = '#f2f2f2';
        cancelButton.style.cursor = 'pointer';
        cancelButton.onclick = () => modal.remove();

        const submitButton = document.createElement('button');
        submitButton.type = 'submit';
        submitButton.textContent = 'Insert';
        submitButton.style.padding = '8px 16px';
        submitButton.style.border = 'none';
        submitButton.style.borderRadius = '4px';
        submitButton.style.backgroundColor = '#4CAF50';
        submitButton.style.color = 'white';
        submitButton.style.cursor = 'pointer';

        buttonGroup.appendChild(cancelButton);
        buttonGroup.appendChild(submitButton);

        // Assemble the form
        form.appendChild(nameGroup);
        form.appendChild(targetGroup);
        form.appendChild(metadataGroup);
        form.appendChild(buttonGroup);

        // Assemble the modal
        modalContent.appendChild(header);
        modalContent.appendChild(form);
        modal.appendChild(modalContent);

        // Add modal to document
        document.body.appendChild(modal);

        // Set focus to the first field
        nameInput.focus();

        return modal;
    }

    /**
     * Process the relationship form submission
     * @private
     * @param {HTMLFormElement} form The form element
     */
    processRelationshipForm(form) {
        try {
            // Get current editor content
            const currentValue = this.getValue();
            let jsonObj;
            
            try {
                jsonObj = JSON.parse(currentValue);
            } catch (e) {
                console.error('Error parsing current JSON:', e);
                this.showValidationMessage('Cannot insert relationship: The current content is not valid JSON', false);
                return;
            }
            
            // Get form values
            const formData = new FormData(form);
            const relationshipName = formData.get('relName');
            const targetEntity = formData.get('targetEntity');
            const includeObservedAt = formData.get('includeObservedAt') === 'on';
            const includeMetadata = formData.get('includeMetadata') === 'on';
            const metadataName = formData.get('metadataName');
            const metadataValue = formData.get('metadataValue');
            
            // Create relationship object
            jsonObj[relationshipName] = {
                "type": "Relationship",
                "object": targetEntity
            };
            
            // Add observedAt if requested
            if (includeObservedAt) {
                jsonObj[relationshipName].observedAt = new Date().toISOString();
            }
            
            // Add additional metadata if requested
            if (includeMetadata && metadataName && metadataValue) {
                jsonObj[relationshipName][metadataName] = {
                    "type": "Property",
                    "value": isNaN(metadataValue) ? metadataValue : parseFloat(metadataValue)
                };
            }
            
            // Update the editor
            this.setValue(jsonObj);
            
            // Show success message
            this.showValidationMessage(`Added relationship: ${relationshipName} → ${targetEntity}`, true);
            
        } catch (e) {
            console.error('Error processing relationship form:', e);
            this.showValidationMessage(`Error inserting relationship: ${e.message}`, false);
        }
    }
}

// Expose the JsonEditor globally
window.JsonEditor = JsonEditor;

// Export for ES modules (only if we're in a module context)
if (typeof exports !== 'undefined') {
  exports.JsonEditor = JsonEditor;
}

// Handle ES module exports in a way that doesn't break in non-module contexts
try {
  // This will only execute in a module context
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = JsonEditor;
  } else if (typeof define === 'function' && define.amd) {
    define([], function() { return JsonEditor; });
  } 
} catch (e) {
  // Silently fail in non-module contexts
  console.log('Running JsonEditor in non-module mode');
}