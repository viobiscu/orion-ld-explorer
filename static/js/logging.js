// Logging functionality module

/**
 * Append a log message to the logs container
 * @param {string} message - The message to log
 */
export function appendToLogs(message) {
    const logsContainer = document.getElementById('request-logs');
    if (!logsContainer) return;

    // Create the log item
    const logItem = document.createElement('p');
    logItem.className = 'log-item';
    
    // Add timestamp to message
    const timestamp = new Date().toISOString();
    logItem.textContent = `[${timestamp}] ${message}`;
    
    // Add the new log at the top
    logsContainer.insertBefore(logItem, logsContainer.firstChild);
    
    // Remove placeholder if present
    const placeholder = logsContainer.querySelector('.log-placeholder');
    if (placeholder) {
        placeholder.remove();
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

/**
 * Add a log entry with type and message
 * @param {string} type - The type of log entry (e.g., 'info', 'error', 'warning')
 * @param {string} message - The message to log
 */
export function logRequest(type, message) {
    const logContainer = document.getElementById("request-logs");
    if (!logContainer) return;
    
    const logEntry = document.createElement("div");
    logEntry.className = `log-entry log-${type}`;
    logEntry.textContent = `[${type.toUpperCase()}] ${message}`;
    logContainer.appendChild(logEntry);
}

// Make functions available globally for legacy support
window.clearLogs = clearLogs;
window.logRequest = logRequest;