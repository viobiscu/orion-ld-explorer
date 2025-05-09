/**
 * Authentication checker module
 * Simplified integration with the main auth-backend.js
 */

// Import the authentication manager
import { authManager } from './auth-backend.js';

// Function to check if user is authenticated
export function checkAuthentication() {
  return authManager.isUserAuthenticated;
}

// Function to redirect to login page if not authenticated
// Only redirects on protected pages, not all pages
export function redirectIfNotAuthenticated() {
  // Check if we should redirect - only on main pages that require authentication
  const isMainPage = window.location.pathname === '/' || 
                     window.location.pathname.endsWith('/') || 
                     window.location.pathname.endsWith('index.html');

  // Check if we're in a redirect loop
  const redirectCount = parseInt(sessionStorage.getItem('auth_redirect_count') || '0');
  
  if (!authManager.isUserAuthenticated && isMainPage && redirectCount < 3) {
    console.log('User not authenticated on protected page, redirecting to login');
    // Increment the counter to detect loops
    sessionStorage.setItem('auth_redirect_count', redirectCount + 1);
    authManager.login();
    return false;
  }
  
  // If there was a redirect loop, show error instead of redirecting again
  if (redirectCount >= 3) {
    console.error('Authentication redirect loop detected in authChecker.js');
    showAuthError('Authentication redirect loop detected. Please try clearing your cookies and refreshing the page.');
    // Reset counter
    sessionStorage.setItem('auth_redirect_count', '0');
  }
  
  return true;
}

// Helper function to display auth error
function showAuthError(message) {
  // Check if error is already displayed
  if (document.querySelector('.auth-error')) {
    return;
  }
  
  // Display a friendly error message to the user
  const errorMessage = document.createElement('div');
  errorMessage.className = 'auth-error';
  errorMessage.style.position = 'fixed';
  errorMessage.style.top = '50%';
  errorMessage.style.left = '50%';
  errorMessage.style.transform = 'translate(-50%, -50%)';
  errorMessage.style.backgroundColor = '#fff';
  errorMessage.style.padding = '20px';
  errorMessage.style.borderRadius = '5px';
  errorMessage.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
  errorMessage.style.zIndex = '1000';
  
  errorMessage.innerHTML = `
    <h3>Authentication Error</h3>
    <p>${message}</p>
    <p>Possible causes:</p>
    <ul>
      <li>Session timeout</li>
      <li>Network connectivity issues</li>
      <li>Server configuration problems</li>
    </ul>
    <button id="retry-auth" style="padding: 8px 16px; margin-top: 10px; cursor: pointer;">Try Again</button>
    <button id="clear-auth-data" style="padding: 8px 16px; margin-top: 10px; margin-left: 10px; cursor: pointer;">Clear Auth Data</button>
  `;
  
  // Add to the document
  document.body.appendChild(errorMessage);
  
  // Add event listener to retry button
  document.getElementById('retry-auth')?.addEventListener('click', () => {
    errorMessage.remove();
    sessionStorage.setItem('auth_redirect_count', '0');
    window.location.reload();
  });
  
  // Add event listener to clear auth data button
  document.getElementById('clear-auth-data')?.addEventListener('click', () => {
    errorMessage.remove();
    localStorage.clear();
    sessionStorage.clear();
    document.cookie.split(";").forEach(function(c) {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    window.location.reload();
  });
}

// Check auth status after a short delay to ensure the DOM is loaded
// and auth status has been checked, but only on pages that need it
setTimeout(() => {
  // Only run the check on pages that require authentication
  const isProtectedPage = window.location.pathname === '/' || 
                          window.location.pathname.endsWith('/') || 
                          window.location.pathname.endsWith('index.html');
                          
  if (isProtectedPage) {
    console.log('Checking authentication status on protected page');
    redirectIfNotAuthenticated();
  } else {
    console.log('Not a protected page, skipping auth check');
  }
}, 500);

export default {
  checkAuthentication,
  redirectIfNotAuthenticated
};