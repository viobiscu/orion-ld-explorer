/**
 * UI handler utilities for the application
 * Complements the main UI manager with additional handlers
 */
import { appendToLogs } from './api.js';

/**
 * Toggle a tree view element's expanded state
 * @param {HTMLElement} element - The tree view element to toggle
 */
export function toggleTreeView(element) {
    if (!element?.classList?.contains('expandable')) return;

    element.classList.toggle('active');
    const nestedList = element.nextElementSibling;
    
    if (nestedList && nestedList.classList.contains('nested')) {
        nestedList.style.display = 
            nestedList.style.display === 'block' ? 'none' : 'block';
    }
}

/**
 * Initialize all tree view elements in the document
 */
export function initTreeView() {
    document.querySelectorAll('.treeview-item').forEach(item => {
        item.addEventListener('click', (e) => toggleTreeView(e.currentTarget));
    });

    // Prevent event bubbling for nested items
    document.querySelectorAll('.nested li').forEach(item => {
        item.addEventListener('click', (e) => e.stopPropagation());
    });
}

/**
 * Initialize all UI elements and event listeners
 */
export function initializeUI() {
    document.addEventListener('DOMContentLoaded', () => {
        setupEventListeners();
        appendToLogs('UI initialized successfully');
    });
}

/**
 * Set up event listeners for UI elements
 */
function setupEventListeners() {
    // Set up tenant selection input
    const tenantSelect = document.getElementById('tenantname');
    if (tenantSelect) {
        tenantSelect.addEventListener('change', () => {
            localStorage.setItem('tenantName', tenantSelect.value);
            appendToLogs(`Tenant changed to: ${tenantSelect.value}`);
        });
    }
}

/**
 * Clear the logs container
 */
export function clearLogs() {
    const logsContainer = document.getElementById('request-logs');
    if (logsContainer) {
        logsContainer.innerHTML = '';
        appendToLogs('Logs cleared');
    }
}

// Make functions available globally
window.clearLogs = clearLogs;
window.initializeUI = initializeUI;

export default {
    initializeUI,
    clearLogs,
    toggleTreeView,
    initTreeView
};
