/**
 * Error boundary utility for handling API errors consistently
 */
class ErrorBoundary {
    constructor() {
        this.errors = [];
    }

    /**
     * Wrap an async function with error handling
     * @param {Function} fn - Async function to wrap
     * @return {Function} Wrapped function with error handling
     */
    wrap(fn) {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                this.addError(error);
                throw error;
            }
        };
    }

    /**
     * Add an error to the error list
     * @param {Error} error - Error to add
     */
    addError(error) {
        this.errors.push({
            message: error.message,
            stack: error.stack,
            timestamp: new Date()
        });
        console.error('API Error:', error);
    }

    /**
     * Clear all errors
     */
    clearErrors() {
        this.errors = [];
    }

    /**
     * Get all errors
     * @return {Array} List of errors
     */
    getErrors() {
        return this.errors;
    }
}

// Singleton instance
export const errorBoundary = new ErrorBoundary();

export default ErrorBoundary;
