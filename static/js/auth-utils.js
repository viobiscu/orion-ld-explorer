// Function to clear authentication data
export function clearAuthData() {
    // Remove authentication-related items from localStorage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    localStorage.removeItem('login_timestamp');
    
    // Update the UI to reflect that the user is logged out
    const loginUserSpan = document.getElementById('loginUser');
    if (loginUserSpan) {
        loginUserSpan.textContent = 'User: Not logged in';
    }
    
    // Log the action
    console.log('Authentication data cleared');
    if (typeof window.Logging !== 'undefined' && typeof window.Logging.appendToLogs === 'function') {
        window.Logging.appendToLogs('Authentication data cleared');
    }
    
    // Show a message in the editor
    if (window.mainEditor) {
        window.mainEditor.setValue(JSON.stringify({
            message: "Authentication data cleared",
            status: "success",
            timestamp: new Date().toISOString()
        }, null, 2));
    }
    
    // Optionally reload the page to ensure all auth-dependent components are reset
    if (confirm('Authentication data cleared. Would you like to reload the page to complete the logout process?')) {
        window.location.reload();
    }
}

// Function to clear all localStorage data
export function clearAllData() {
    // Create a backup of non-auth data if user wants to keep it
    const confirm_clear = confirm('This will clear ALL local storage data, including saved queries, settings, and authentication. Continue?');
    
    if (confirm_clear) {
        // Clear all localStorage data
        localStorage.clear();
        
        // Log the action
        console.log('All localStorage data cleared');
        if (typeof window.Logging !== 'undefined' && typeof window.Logging.appendToLogs === 'function') {
            window.Logging.appendToLogs('All localStorage data cleared');
        }
        
        // Show a message in the editor
        if (window.mainEditor) {
            window.mainEditor.setValue(JSON.stringify({
                message: "All localStorage data cleared",
                status: "success",
                timestamp: new Date().toISOString()
            }, null, 2));
        }
        
        // Reload the page to reset all components
        if (confirm('All data cleared. Reload the page now?')) {
            window.location.reload();
        }
    }
}