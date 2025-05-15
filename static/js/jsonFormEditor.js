import { OrionLDClient } from './api.js';

// Remove the inheritance from JsonEditor since it creates a circular dependency
class JsonFormEditor {
    /**
     * Initialize a JSON form editor with the given configuration
     * @param {Object} config Configuration options
     * @param {string} config.containerId ID of the container element
     * @param {Object} [config.formConfig] Form-specific configuration
     * @param {string} [config.formConfig.schemaUrl] URL to fetch JSON schema from
     * @param {boolean} [config.formConfig.autoValidate=true] Whether to validate on input
     * @param {string} [config.entityId] ID of the entity to load and edit
     */
    constructor(config) {
        this.containerId = config.containerId;
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            throw new Error(`Container element not found: ${this.containerId}`);
        }
        
        this.formConfig = config.formConfig || {};
        this.autoValidate = this.formConfig.autoValidate !== false;
        this.formFields = new Map();
        this.formErrors = new Map();
        this.schema = null;
        this.entityId = config.entityId;
        this.client = new OrionLDClient();
        
        // Initialize form structure
        this.createFormElements();
        
        // If entityId is provided, load the entity data
        if (this.entityId) {
            this.loadEntityData();
        }
        // Set initial value if provided (and no entityId)
        else if (config.initialValue) {
            this.setValue(config.initialValue);
        }
        
        // Fetch schema if URL is provided
        if (this.formConfig.schemaUrl) {
            this.fetchSchema();
        }
    }

    /**
     * Load entity data by ID
     * @returns {Promise<void>}
     */
    async loadEntityData() {
        try {
            // Show loading state
            this.formContainer.innerHTML = '<div class="loading">Loading entity data...</div>';
            
            // Fetch entity data
            const entityData = await this.client.getEntity(this.entityId);
            
            // Set the form value with the entity data
            this.setValue(entityData);
        } catch (error) {
            console.error('Error loading entity:', error);
            this.formContainer.innerHTML = `
                <div class="json-form-error">
                    Error loading entity: ${error.message}
                    <button onclick="this.loadEntityData()">Retry</button>
                </div>
            `;
        }
    }
    
    /**
     * Create base form structure
     */
    createFormElements() {
        // Create form container
        this.formContainer = document.createElement('div');
        this.formContainer.className = 'json-form-container';
        this.container.appendChild(this.formContainer);
    }
    
    /**
     * Set form value
     * @param {Object|string} value Form data to set
     */
    setValue(value) {
        try {
            const data = typeof value === 'string' ? JSON.parse(value) : value;
            
            // Clear existing fields first
            this.formFields.clear();
            this.formContainer.innerHTML = '';
            
            // Create fields dynamically based on the data structure
            Object.entries(data).forEach(([key, value]) => {
                const fieldConfig = {
                    name: key,
                    type: this.inferFieldType(value),
                    title: this.formatFieldName(key),
                    value: value
                };
                
                this.createFormField(fieldConfig);
            });
        } catch (error) {
            console.error('Error setting form value:', error);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'json-form-error';
            errorDiv.textContent = `Error loading data: ${error.message}`;
            this.formContainer.appendChild(errorDiv);
        }
    }

    /**
     * Infer field type from value
     * @param {*} value The value to infer type from
     * @returns {string} The inferred type
     */
    inferFieldType(value) {
        if (value === null || value === undefined) return 'string';
        if (typeof value !== 'object') return typeof value;
        
        // Handle NGSI-LD specific types
        if (value.type === 'Property') return 'property';
        if (value.type === 'Relationship') return 'relationship';
        if (value.type === 'GeoProperty') return 'geoproperty';
        
        if (Array.isArray(value)) return 'array';
        return 'object';
    }
    
    /**
     * Get current form value
     * @param {boolean} [asString=false] Whether to return as JSON string
     * @returns {Object|string} Form data
     */
    getValue(asString = false) {
        const data = {};
        
        this.formFields.forEach((field, name) => {
            const value = this.getFieldValue(field.input);
            if (value !== '') {
                data[name] = value;
            }
        });
        
        return asString ? JSON.stringify(data, null, 2) : data;
    }
    
    /**
     * Get value from a form field
     * @param {HTMLElement} input Form field input element
     * @returns {*} Field value
     */
    getFieldValue(input) {
        if (!input) return '';
        
        // Handle NGSI-LD Property container
        if (input.className === 'json-form-property') {
            const valueInput = input.querySelector('.json-form-input');
            const observedAtInput = input.querySelectorAll('.json-form-input')[1];
            const unitCodeInput = input.querySelectorAll('.json-form-input')[2];
            
            const property = {
                type: 'Property',
                value: valueInput.type === 'number' ? Number(valueInput.value) : valueInput.value
            };
            
            if (observedAtInput?.value) {
                property.observedAt = new Date(observedAtInput.value).toISOString();
            }
            
            if (unitCodeInput?.value) {
                property.unitCode = unitCodeInput.value;
            }
            
            return property;
        }
        
        // Handle NGSI-LD Relationship container
        if (input.className === 'json-form-relationship') {
            const objectInput = input.querySelector('.json-form-input');
            const observedAtInput = input.querySelectorAll('.json-form-input')[1];
            
            const relationship = {
                type: 'Relationship',
                object: objectInput.value
            };
            
            if (observedAtInput?.value) {
                relationship.observedAt = new Date(observedAtInput.value).toISOString();
            }
            
            return relationship;
        }
        
        // Handle NGSI-LD GeoProperty container
        if (input.className === 'json-form-geoproperty') {
            const textarea = input.querySelector('.json-form-input');
            return {
                type: 'GeoProperty',
                value: JSON.parse(textarea.value)
            };
        }
        
        // Handle regular inputs
        if (input.type === 'checkbox') return input.checked;
        if (input.type === 'number') return input.value === '' ? '' : Number(input.value);
        return input.value;
    }
    
    /**
     * Fetch and apply JSON schema
     */
    async fetchSchema() {
        try {
            const response = await fetch(this.formConfig.schemaUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            this.schema = await response.json();
            this.initializeFormFromSchema();
        } catch (error) {
            console.error('Error fetching schema:', error);
            // Show error in form
            const errorDiv = document.createElement('div');
            errorDiv.className = 'json-form-error';
            errorDiv.textContent = `Error loading form: ${error.message}`;
            this.formContainer.appendChild(errorDiv);
        }
    }
    
    /**
     * Initialize form fields from JSON schema
     */
    initializeFormFromSchema() {
        if (!this.schema?.properties) return;
        
        // Clear existing fields
        this.formFields.clear();
        this.formContainer.innerHTML = '';
        
        // Create fields from schema properties
        Object.entries(this.schema.properties).forEach(([key, prop]) => {
            this.createFormField({
                name: key,
                type: prop.type || 'string',
                title: prop.title || this.formatFieldName(key),
                description: prop.description,
                required: this.schema.required?.includes(key),
                enum: prop.enum,
                default: prop.default
            });
        });
    }
    
    /**
     * Format a field name for display
     * @param {string} name Raw field name
     * @returns {string} Formatted field name
     */
    formatFieldName(name) {
        return name
            .split(/(?=[A-Z])|[_\s-]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }
    
    /**
     * Create a form field
     * @param {Object} config Field configuration
     */
    createFormField(config) {
        const { name, type, title, required, enum: options, value } = config;
        
        // Create field container with proper styling
        const fieldContainer = document.createElement('div');
        fieldContainer.className = 'json-form-field';
        
        // Create label with proper styling
        const label = document.createElement('label');
        label.textContent = title || this.formatFieldName(name);
        if (required) label.classList.add('required');
        fieldContainer.appendChild(label);
        
        // Create input based on type
        let input;
        try {
            if (options) {
                input = this.createSelectInput(options, value);
            } else {
                input = this.createInput(type, { ...config, value });
            }
            
            // Add input to container
            fieldContainer.appendChild(input);
            this.formContainer.appendChild(fieldContainer);
            
            // Store field reference with container
            this.formFields.set(name, { 
                input,
                container: fieldContainer,
                config: { ...config, type }
            });
            
            // Add validation handlers
            if (this.autoValidate) {
                const validateOnChange = () => {
                    if (this.validateField(name)) {
                        // If valid, update the form data
                        this.updateFormData();
                    }
                };
                
                // For compound inputs (Property, Relationship, GeoProperty)
                if (input.classList.contains('json-form-property') ||
                    input.classList.contains('json-form-relationship') ||
                    input.classList.contains('json-form-geoproperty')) {
                    const inputs = input.querySelectorAll('.json-form-input');
                    inputs.forEach(childInput => {
                        childInput.addEventListener('input', validateOnChange);
                        childInput.addEventListener('blur', validateOnChange);
                    });
                } else {
                    input.addEventListener('input', validateOnChange);
                    input.addEventListener('blur', validateOnChange);
                }
            }
            
        } catch (error) {
            console.error(`Error creating field ${name}:`, error);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'json-form-error';
            errorDiv.textContent = `Error creating field: ${error.message}`;
            fieldContainer.appendChild(errorDiv);
        }
    }
    
    /**
     * Update form data when field values change
     */
    updateFormData() {
        const data = this.getValue();
        if (typeof this.onChange === 'function') {
            this.onChange(data);
        }
    }
    
    /**
     * Create an input element
     * @param {string} type Input type
     * @param {Object} config Field configuration
     * @returns {HTMLElement} Input element
     */
    createInput(type, config) {
        switch (type) {
            case 'property':
                return this.createPropertyInput(config.value);
            case 'relationship':
                return this.createRelationshipInput(config.value);
            case 'geoproperty':
                return this.createGeoPropertyInput(config.value);
            case 'boolean':
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.className = 'json-form-checkbox';
                if (config.value !== undefined) {
                    input.checked = Boolean(config.value);
                }
                return input;
                
            case 'number':
            case 'integer':
                const numberInput = document.createElement('input');
                numberInput.type = 'number';
                if (config.minimum !== undefined) numberInput.min = config.minimum;
                if (config.maximum !== undefined) numberInput.max = config.maximum;
                if (config.value !== undefined) numberInput.value = config.value;
                if (type === 'integer') numberInput.step = '1';
                return numberInput;
                
            case 'object':
                // Create a readonly textarea for objects
                const textarea = document.createElement('textarea');
                textarea.className = 'json-form-input';
                textarea.value = JSON.stringify(config.value, null, 2);
                textarea.readOnly = true;
                textarea.rows = 4;
                return textarea;
                
            case 'array':
                // Create a readonly textarea for arrays
                const arrayTextarea = document.createElement('textarea');
                arrayTextarea.className = 'json-form-input';
                arrayTextarea.value = JSON.stringify(config.value, null, 2);
                arrayTextarea.readOnly = true;
                arrayTextarea.rows = 4;
                return arrayTextarea;
                
            default:
                const textInput = document.createElement('input');
                textInput.type = 'text';
                if (config.value !== undefined) {
                    textInput.value = String(config.value);
                }
                return textInput;
        }
    }
    
    /**
     * Create an input for NGSI-LD Property
     * @param {Object} property The Property object
     * @returns {HTMLElement} The property input container
     */
    createPropertyInput(property) {
        const container = document.createElement('div');
        container.className = 'json-form-property';
        
        // Create value input
        const valueInput = document.createElement('input');
        valueInput.className = 'json-form-input';
        valueInput.type = typeof property.value === 'number' ? 'number' : 'text';
        valueInput.value = property.value;
        
        // Create observedAt input if present
        if (property.observedAt) {
            const observedAtInput = document.createElement('input');
            observedAtInput.className = 'json-form-input';
            observedAtInput.type = 'datetime-local';
            observedAtInput.value = property.observedAt.replace('Z', '');
            observedAtInput.style.marginTop = '8px';
            container.appendChild(observedAtInput);
        }
        
        // Create unitCode input if present
        if (property.unitCode) {
            const unitCodeInput = document.createElement('input');
            unitCodeInput.className = 'json-form-input';
            unitCodeInput.type = 'text';
            unitCodeInput.value = property.unitCode;
            unitCodeInput.placeholder = 'Unit Code';
            unitCodeInput.style.marginTop = '8px';
            container.appendChild(unitCodeInput);
        }
        
        container.insertBefore(valueInput, container.firstChild);
        return container;
    }

    /**
     * Create an input for NGSI-LD Relationship
     * @param {Object} relationship The Relationship object
     * @returns {HTMLElement} The relationship input container
     */
    createRelationshipInput(relationship) {
        const container = document.createElement('div');
        container.className = 'json-form-relationship';
        
        // Create object input (target entity URI)
        const objectInput = document.createElement('input');
        objectInput.className = 'json-form-input';
        objectInput.type = 'text';
        objectInput.value = relationship.object;
        objectInput.pattern = '^urn:ngsi-ld:[a-zA-Z0-9]+:[a-zA-Z0-9_-]+$';
        objectInput.title = 'Enter a valid NGSI-LD entity URI';
        
        // Create observedAt input if present
        if (relationship.observedAt) {
            const observedAtInput = document.createElement('input');
            observedAtInput.className = 'json-form-input';
            observedAtInput.type = 'datetime-local';
            observedAtInput.value = relationship.observedAt.replace('Z', '');
            observedAtInput.style.marginTop = '8px';
            container.appendChild(observedAtInput);
        }
        
        container.insertBefore(objectInput, container.firstChild);
        return container;
    }

    /**
     * Create an input for NGSI-LD GeoProperty
     * @param {Object} geoProperty The GeoProperty object
     * @returns {HTMLElement} The geo property input container
     */
    createGeoPropertyInput(geoProperty) {
        const container = document.createElement('div');
        container.className = 'json-form-geoproperty';
        
        // For now, display as readonly JSON since it's complex
        const textarea = document.createElement('textarea');
        textarea.className = 'json-form-input';
        textarea.value = JSON.stringify(geoProperty.value, null, 2);
        textarea.readOnly = true;
        textarea.rows = 4;
        
        container.appendChild(textarea);
        return container;
    }
    
    /**
     * Create a select input
     * @param {Array} options Select options
     * @param {*} defaultValue Default value
     * @returns {HTMLSelectElement} Select element
     */
    createSelectInput(options, defaultValue) {
        const select = document.createElement('select');
        select.className = 'json-form-select';
        
        // Add placeholder option
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '-- Select --';
        placeholder.disabled = true;
        if (defaultValue === undefined) placeholder.selected = true;
        select.appendChild(placeholder);
        
        // Add options
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            if (option === defaultValue) optionElement.selected = true;
            select.appendChild(optionElement);
        });
        
        return select;
    }
    
    /**
     * Validate a field
     * @param {string} fieldName Name of field to validate
     * @returns {boolean} Whether field is valid
     */
    validateField(fieldName) {
        const field = this.formFields.get(fieldName);
        if (!field?.input) return true;
        
        const { input, config } = field;
        const value = this.getFieldValue(input);
        
        // Clear previous error
        this.clearFieldError(fieldName);
        
        try {
            // Required field validation
            if (config.required && (value === '' || value === undefined)) {
                this.setFieldError(fieldName, 'This field is required');
                return false;
            }
            
            // NGSI-LD specific validation
            if (config.type === 'relationship') {
                const uriPattern = /^urn:ngsi-ld:[a-zA-Z0-9]+:[a-zA-Z0-9_-]+$/;
                const objectInput = input.querySelector('.json-form-input');
                if (objectInput && !uriPattern.test(objectInput.value)) {
                    this.setFieldError(fieldName, 'Invalid NGSI-LD entity URI format');
                    return false;
                }
            }
            
            return true;
        } catch (error) {
            console.error(`Error validating field ${fieldName}:`, error);
            this.setFieldError(fieldName, 'Validation error occurred');
            return false;
        }
    }
    
    /**
     * Set error on a field
     * @param {string} fieldName Field name
     * @param {string} message Error message
     */
    setFieldError(fieldName, message) {
        const field = this.formFields.get(fieldName);
        if (!field?.container) return;
        
        // Add error classes
        field.container.classList.add('is-invalid');
        
        // For compound inputs (Property, Relationship, GeoProperty)
        const inputs = field.container.querySelectorAll('.json-form-input');
        inputs.forEach(input => input.classList.add('is-invalid'));
        
        // Add error message if it doesn't exist
        let errorDiv = field.container.querySelector('.json-form-error');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'json-form-error';
            field.container.appendChild(errorDiv);
        }
        errorDiv.textContent = message;
        
        this.formErrors.set(fieldName, message);
    }
    
    /**
     * Clear error from a field
     * @param {string} fieldName Field name
     */
    clearFieldError(fieldName) {
        const field = this.formFields.get(fieldName);
        if (!field?.container) return;
        
        // Remove error classes
        field.container.classList.remove('is-invalid');
        
        // For compound inputs (Property, Relationship, GeoProperty)
        const inputs = field.container.querySelectorAll('.json-form-input');
        inputs.forEach(input => input.classList.remove('is-invalid'));
        
        // Remove error message
        const errorDiv = field.container.querySelector('.json-form-error');
        if (errorDiv) errorDiv.remove();
        
        this.formErrors.delete(fieldName);
    }
    
    /**
     * Validate all form fields
     * @returns {boolean} Whether form is valid
     */
    validate() {
        let isValid = true;
        this.formFields.forEach((_, name) => {
            if (!this.validateField(name)) {
                isValid = false;
            }
        });
        return isValid;
    }
    
    /**
     * Clean up form
     */
    destroy() {
        this.formFields.clear();
        this.formErrors.clear();
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

// Add module exports
window.JsonFormEditor = JsonFormEditor;
export { JsonFormEditor };
export default JsonFormEditor;