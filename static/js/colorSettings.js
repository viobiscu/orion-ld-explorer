// Default colors
const DEFAULT_COLORS = {
    '--json-property': '#986801',
    '--json-string': '#50a14f',
    '--json-number': '#4078f2',
    '--json-boolean': '#aa17e6',
    '--json-null': '#e45649',
    '--json-punctuation': '#383a42'
};

// Initialize color settings
function initColorSettings() {
    try {
        // Load saved colors or use defaults
        const savedColors = JSON.parse(localStorage.getItem('jsonColors')) || DEFAULT_COLORS;
        applyColors(savedColors);
        setupColorInputs(savedColors);
    } catch (error) {
        console.error('Error initializing color settings:', error);
        // Fallback to defaults if there's an error
        applyColors(DEFAULT_COLORS);
        setupColorInputs(DEFAULT_COLORS);
    }
}

// Apply colors to the CSS variables
function applyColors(colors) {
    const root = document.documentElement;
    Object.entries(colors).forEach(([variable, value]) => {
        root.style.setProperty(variable, value);
    });
    // Add custom class to code blocks and refresh highlighting
    document.querySelectorAll('pre code').forEach(block => {
        block.classList.add('hljs-custom');
        hljs.highlightElement(block);
    });
}

// Hide the color settings menu and return to previous content
function hideColorSettings() {
    const displayArea = document.getElementById('displayArea');
    if (displayArea) {
        const previousContent = localStorage.getItem('previousContent');
        if (previousContent) {
            // Create a temporary div to safely parse the HTML content
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = previousContent;
            
            // Find any code blocks and re-apply highlighting safely
            const codeBlocks = tempDiv.querySelectorAll('pre code');
            codeBlocks.forEach(block => {
                const originalText = block.textContent;
                if (hljs && originalText) {
                    try {
                        const result = hljs.highlight(originalText, {
                            language: 'json',
                            ignoreIllegals: true
                        });
                        block.innerHTML = result.value;
                        block.classList.add('hljs-custom');
                    } catch (error) {
                        console.error('Error re-applying syntax highlighting:', error);
                        block.textContent = originalText;
                    }
                }
            });
            
            // Update the display area with the processed content
            displayArea.innerHTML = tempDiv.innerHTML;
        }
    }
}

// Set up color input handlers
function setupColorInputs(colors) {
    document.querySelectorAll('.color-setting-group input[type="color"]').forEach(input => {
        const cssVar = input.dataset.target;
        // Set the initial color value
        input.value = colors[cssVar] || DEFAULT_COLORS[cssVar];
        
        // Remove any existing event listeners
        input.removeEventListener('input', handleColorChange);
        input.removeEventListener('change', handleColorChange);
        
        // Add event listeners for real-time updates
        input.addEventListener('input', handleColorChange);
        input.addEventListener('change', handleColorChange);
    });

    // Reset button handler
    const resetBtn = document.getElementById('resetColors');
    if (resetBtn) {
        resetBtn.removeEventListener('click', handleReset);
        resetBtn.addEventListener('click', handleReset);
    }

    // Save button handler
    const saveBtn = document.getElementById('saveColors');
    if (saveBtn) {
        saveBtn.removeEventListener('click', handleSave);
        saveBtn.addEventListener('click', handleSave);
    }
}

// Handle color input changes
function handleColorChange(event) {
    const newColors = getColorValues();
    applyColors(newColors);
}

// Handle reset button click
function handleReset() {
    applyColors(DEFAULT_COLORS);
    setupColorInputs(DEFAULT_COLORS);
    saveColors(DEFAULT_COLORS);
}

// Handle save button click
function handleSave() {
    const colors = getColorValues();
    saveColors(colors);
    hideColorSettings();
}

// Get current color values from inputs
function getColorValues() {
    const colors = {};
    document.querySelectorAll('.color-setting-group input[type="color"]').forEach(input => {
        colors[input.dataset.target] = input.value;
    });
    return colors;
}

// Save colors to localStorage
function saveColors(colors) {
    try {
        localStorage.setItem('jsonColors', JSON.stringify(colors));
    } catch (error) {
        console.error('Error saving color settings:', error);
    }
}

// Make init function available globally
window.initColorSettings = initColorSettings;