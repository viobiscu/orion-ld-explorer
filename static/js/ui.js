/**
 * UI Manager for handling user interface interactions
 */
class UIManager {
    constructor() {
        // Initialize UI components
        this.setupEventListeners();
        this.setupTreeView();
        this.initializeEntityTypes();
        this.setupResizer();
    }

    /**
     * Set up event listeners for UI elements
     */
    setupEventListeners() {
        const clearLogsBtn = document.getElementById('clearLogsBtn');
        const toggleLogsBtn = document.getElementById('toggleLogsBtn');
        
        if (clearLogsBtn) {
            clearLogsBtn.addEventListener('click', () => this.clearLogs());
        }
        
        if (toggleLogsBtn) {
            toggleLogsBtn.addEventListener('click', () => this.toggleLogs());
        }
    }

    /**
     * Set up treeview menu functionality
     */
    setupTreeView() {
        document.querySelectorAll('.treeview-item').forEach(item => {
            item.addEventListener('click', (e) => this.handleTreeViewClick(e));
        });

        // Prevent event bubbling for nested items
        document.querySelectorAll('.nested li').forEach(item => {
            item.addEventListener('click', (e) => e.stopPropagation());
        });
    }

    /**
     * Handle click events on treeview items
     */
    handleTreeViewClick(event) {
        const element = event.currentTarget;
        if (!element.classList.contains('expandable')) return;

        // Toggle the active class
        const isActive = element.classList.toggle('active');

        // Find the nested list and toggle its visibility
        const nestedList = element.nextElementSibling;
        if (nestedList && nestedList.classList.contains('nested')) {
            nestedList.style.display = isActive ? 'block' : 'none';
        }

        // Toggle folder icon open/closed
        const icon = element.querySelector('i.custom-icon');
        if (icon) {
            if (isActive) {
                icon.classList.replace('fa-folder-closed', 'fa-folder-open');
            } else {
                icon.classList.replace('fa-folder-open', 'fa-folder-closed');
            }
        }
    }

    /**
     * Clear logs from the log container
     */
    clearLogs() {
        const logContainer = document.getElementById("request-logs");
        if (logContainer) {
            logContainer.innerHTML = '<p class="log-placeholder">Logs will appear here...</p>';
        }
    }
    
    /**
     * Toggle logs visibility
     */
    toggleLogs() {
        const logContainer = document.getElementById("request-logs");
        const toggleButton = document.getElementById("toggleLogsBtn");
        
        if (!logContainer || !toggleButton) return;
        
        if (logContainer.style.display === "none") {
            logContainer.style.display = "block";
            toggleButton.textContent = "Hide Logs";
        } else {
            logContainer.style.display = "none";
            toggleButton.textContent = "Show Logs";
        }
    }

    /**
     * Add a log entry with type and message
     */
    logRequest(type, message) {
        const logContainer = document.getElementById("request-logs");
        if (!logContainer) return;
        
        const logEntry = document.createElement("div");
        logEntry.className = `log-entry log-${type}`;
        logEntry.textContent = `[${type.toUpperCase()}] ${message}`;
        logContainer.appendChild(logEntry);
    }

    /**
     * Update content display area
     */
    updateDisplay(content) {
        const displayArea = document.getElementById("displayArea");
        if (!displayArea) return;
        
        if (typeof content === 'object') {
            content = JSON.stringify(content, null, 2);
        }
        displayArea.innerHTML = `<pre>${content}</pre>`;
    }

    /**
     * Initialize entity types list
     */
    initializeEntityTypes() {
        // Load entity types after a short delay to ensure DOM is ready
        setTimeout(() => {
            if (typeof window.loadEntityTypes === 'function') {
                window.loadEntityTypes();
            }
        }, 1000);
    }
    
    /**
     * Set up the sidebar resizer functionality
     */
    setupResizer() {
        const resizer = document.getElementById('resizer');
        const sidebar = document.getElementById('sidebar');
        
        if (!resizer || !sidebar) return;
        
        let isResizing = false;
        let startX, startWidth;
        
        // Handle mouse down event on resizer
        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = parseInt(window.getComputedStyle(sidebar).width, 10);
            
            // Add active class to resizer when dragging
            resizer.classList.add('active');
            
            // Prevent text selection during resize
            document.body.style.userSelect = 'none';
            
            // Setup document-wide mouse events for drag tracking
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });
        
        // Handle mouse move for resizing
        const handleMouseMove = (e) => {
            if (!isResizing) return;
            
            // Calculate new width
            const newWidth = startWidth + (e.clientX - startX);
            
            // Ensure minimum and maximum width constraints
            const minWidth = 100; // Minimum sidebar width
            const maxWidth = window.innerWidth / 2; // Maximum sidebar width (half of window)
            
            // Apply the new width if within constraints
            if (newWidth >= minWidth && newWidth <= maxWidth) {
                sidebar.style.width = `${newWidth}px`;
            }
        };
        
        // Handle mouse up to stop resizing
        const handleMouseUp = () => {
            isResizing = false;
            resizer.classList.remove('active');
            document.body.style.userSelect = '';
            
            // Remove document-wide event listeners
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }
}

// Initialize UI manager
const uiManager = new UIManager();

// Make toggleTreeView available globally for inline HTML onclick handlers
window.toggleTreeView = function(element) {
    uiManager.handleTreeViewClick({currentTarget: element});
};

export default uiManager;
