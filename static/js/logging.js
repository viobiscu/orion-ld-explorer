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
    
    // Check if the message contains a response status code
    if (message.includes('Response:')) {
        const statusMatch = message.match(/Response: (\d{3})/);
        if (statusMatch) {
            const statusCode = parseInt(statusMatch[1]);
            const statusText = message.split(statusMatch[0])[1] || '';
            
            // Create span for timestamp
            const timestampSpan = document.createElement('span');
            timestampSpan.textContent = `[${timestamp}] `;
            
            // Create span for "Response: "
            const responseSpan = document.createElement('span');
            responseSpan.textContent = 'Response: ';
            
            // Create span for status code with color
            const statusSpan = document.createElement('span');
            statusSpan.textContent = statusCode;
            
            // Apply color based on status code
            if (statusCode >= 200 && statusCode < 300) {
                statusSpan.style.color = '#28a745'; // Green for success
            } else if (statusCode >= 400 && statusCode < 500) {
                statusSpan.style.color = '#dc3545'; // Red for client errors
            } else if (statusCode >= 500) {
                statusSpan.style.color = '#ffc107'; // Yellow for server errors
            }
            
            // Create span for the rest of the message
            const textSpan = document.createElement('span');
            textSpan.textContent = statusText;
            
            // Combine all parts
            logItem.appendChild(timestampSpan);
            logItem.appendChild(responseSpan);
            logItem.appendChild(statusSpan);
            logItem.appendChild(textSpan);
        } else {
            logItem.textContent = `[${timestamp}] ${message}`;
        }
    } else {
        logItem.textContent = `[${timestamp}] ${message}`;
    }
    
    // Add the new log at the bottom and scroll into view
    logsContainer.appendChild(logItem);
    logItem.scrollIntoView({ behavior: 'smooth', block: 'end' });
    
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