/**
 * Store class for managing application state
 * Provides centralized state management with subscription capability
 */
class Store {
    constructor() {
        this.state = {
            loading: false,
            error: null,
            data: null
        };
        this.subscribers = [];
    }

    /**
     * Subscribe to state changes
     * @param {Function} subscriber - Callback function that will be called when state changes
     * @return {Function} Unsubscribe function
     */
    subscribe(subscriber) {
        this.subscribers.push(subscriber);
        return () => {
            this.subscribers = this.subscribers.filter(s => s !== subscriber);
        };
    }

    /**
     * Notify all subscribers of state changes
     */
    notify() {
        this.subscribers.forEach(subscriber => subscriber(this.state));
    }

    /**
     * Set loading state
     * @param {boolean} loading - Whether the application is loading
     */
    setLoading(loading) {
        this.state = { ...this.state, loading };
        this.notify();
    }

    /**
     * Set error state
     * @param {string|null} error - Error message or null
     */
    setError(error) {
        this.state = { ...this.state, error };
        this.notify();
    }

    /**
     * Set data state
     * @param {any} data - Application data
     */
    setData(data) {
        this.state = { ...this.state, data };
        this.notify();
    }

    /**
     * Get current state
     * @return {Object} Current state
     */
    getState() {
        return this.state;
    }
}

// Create a singleton store instance
export const store = new Store();

export default Store;
