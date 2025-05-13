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