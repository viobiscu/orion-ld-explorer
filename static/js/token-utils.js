// token-utils.js
export function setupTokenButton() {
    const showTokenButton = document.getElementById('showTokenButton');
    if (showTokenButton) {
        showTokenButton.addEventListener('click', function() {
            showTokenDialog();
        });
    }
}

export function showTokenDialog() {
    // Check if AuthBackend is already available
    if (typeof window.AuthBackend !== 'undefined' && typeof window.AuthBackend.showToken === 'function') {
        console.log('Using showToken from auth-backend.js');
        window.AuthBackend.showToken();
        return;
    }
    
    console.log('AuthBackend.showToken is not available - waiting for module to load');
    
    // Implement a more robust retry mechanism with multiple attempts
    let attempts = 0;
    const maxAttempts = 5;
    const retryInterval = 500; // 500ms between attempts
    
    const tryShowToken = function() {
        attempts++;
        if (typeof window.AuthBackend !== 'undefined' && typeof window.AuthBackend.showToken === 'function') {
            console.log(`AuthBackend.showToken available after ${attempts} attempts`);
            window.AuthBackend.showToken();
        } else if (attempts < maxAttempts) {
            console.log(`Retry attempt ${attempts}/${maxAttempts} for AuthBackend.showToken`);
            setTimeout(tryShowToken, retryInterval);
        } else {
            console.error(`AuthBackend.showToken still not available after ${maxAttempts} attempts`);
            
            // Create fallback token display
            const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
            if (token) {
                alert('Token is available but the display functionality is not ready. Using simple display instead.');
                if (window.mainEditor) {
                    window.mainEditor.setValue(JSON.stringify({
                        message: "Authentication Token (Simple View)",
                        token_preview: token.substring(0, 15) + '...' + token.substring(token.length - 10),
                        note: "This is a simplified view. The full token viewer is not available."
                    }, null, 2));
                }
            } else {
                alert('Token display functionality is not available and no token was found in localStorage.');
            }
        }
    };
    
    // Start the retry process
    tryShowToken();
}