/**
 * Relationship Visualizer for Orion-LD Explorer
 * Uses vis.js Network to visualize entity relationships
 */

class RelationshipVisualizer {
    constructor() {
        // Network visualization properties
        this.nodes = new vis.DataSet([]);
        this.edges = new vis.DataSet([]);
        this.network = null;
        this.data = { nodes: this.nodes, edges: this.edges };
        
        // Configuration options for the network
        this.options = {
            nodes: {
                shape: 'dot',
                size: 16,
                font: {
                    size: 12,
                    face: 'Arial'
                },
                borderWidth: 2,
                shadow: true
            },
            edges: {
                width: 2,
                shadow: true,
                arrows: {
                    to: { enabled: true, scaleFactor: 0.5 }
                },
                smooth: {
                    type: 'continuous',
                    forceDirection: 'none'
                }
            },
            physics: {
                stabilization: true,
                barnesHut: {
                    gravitationalConstant: -8000,
                    springConstant: 0.04,
                    springLength: 95
                }
            },
            interaction: {
                navigationButtons: true,
                keyboard: true,
                tooltipDelay: 300,
                hover: true
            },
            groups: {
                entity: {
                    color: { background: '#97C2FC', border: '#2B7CE9' },
                    shape: 'dot'
                },
                selected: {
                    color: { background: '#FFCC00', border: '#FFA500' },
                    shape: 'dot'
                },
                relationship: {
                    color: { background: '#FB7E81', border: '#E7262B' },
                    shape: 'diamond'
                }
            }
        };
        
        // Keep track of processed entities to avoid duplicates
        this.processedEntities = new Set();
        
        // Reference to the main entity being visualized
        this.mainEntityId = null;
        
        // Initialize the visualization
        this.init();
    }
    
    /**
     * Initialize the network visualization
     */
    init() {
        // Create a network instance
        const container = document.getElementById('network-container');
        this.network = new vis.Network(container, this.data, this.options);
        
        // Set up event listeners
        this.setupEventListeners();
    }
    
    /**
     * Set up event listeners for the visualization
     */
    setupEventListeners() {
        // Setup button click handlers
        document.getElementById('visualizeRelationships').addEventListener('click', () => {
            this.visualizeEntityRelationships();
        });
        
        document.getElementById('clearGraph').addEventListener('click', () => {
            this.clearVisualization();
        });
        
        // Handle node click events to show entity details
        this.network.on('click', (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                const node = this.nodes.get(nodeId);
                this.showEntityDetails(node);
            }
        });
    }
    
    /**
     * Visualize relationships for the entity
     */
    async visualizeEntityRelationships() {
        try {
            const entityId = document.getElementById('entityId').value.trim();
            const depth = parseInt(document.getElementById('relationshipDepth').value);
            
            if (!entityId) {
                alert('Please enter an entity ID');
                return;
            }
            
            // Clear existing visualization first
            this.clearVisualization();
            
            // Set the main entity being visualized
            this.mainEntityId = entityId;
            
            // Add a loading indicator
            document.getElementById('entity-details-content').innerHTML = '<p>Loading relationships...</p>';
            
            // Start recursive relationship exploration
            await this.fetchAndVisualizeEntity(entityId, depth, true);
            
            // Fit the network to view all nodes
            this.network.fit({
                animation: {
                    duration: 1000,
                    easingFunction: 'easeInOutQuad'
                }
            });
            
            // Show completion message
            document.getElementById('entity-details-content').innerHTML = 
                `<p>Visualization complete. Showing relationships for entity: ${entityId}</p>`;
        } catch (error) {
            console.error('Error visualizing relationships:', error);
            document.getElementById('entity-details-content').innerHTML = 
                `<p>Error visualizing relationships: ${error.message}</p>`;
        }
    }
    
    /**
     * Fetch an entity and visualize its relationships recursively
     * @param {string} entityId - The entity ID to fetch
     * @param {number} depth - Maximum depth to explore
     * @param {boolean} isMainEntity - Whether this is the main entity being visualized
     */
    async fetchAndVisualizeEntity(entityId, depth, isMainEntity = false) {
        // Skip if we've already processed this entity or reached max depth
        if (this.processedEntities.has(entityId) || depth <= 0) {
            return;
        }
        
        // Mark this entity as processed
        this.processedEntities.add(entityId);
        
        try {
            // Fetch the entity from the Orion-LD context broker
            const entity = await this.fetchEntity(entityId);
            
            if (!entity) {
                console.warn(`Entity not found: ${entityId}`);
                return;
            }
            
            // Add the entity to the visualization
            this.addEntityNode(entity, isMainEntity);
            
            // If we're at depth 0, don't explore relationships
            if (depth <= 0) return;
            
            // Find all relationship attributes in the entity
            const relationships = this.findRelationshipAttributes(entity);
            
            // Process each relationship
            for (const rel of relationships) {
                const targetEntityId = this.getRelationshipTarget(rel.value);
                
                if (targetEntityId) {
                    // Add an edge for this relationship
                    this.addRelationshipEdge(entityId, targetEntityId, rel.name);
                    
                    // Recursively fetch and visualize the target entity with reduced depth
                    await this.fetchAndVisualizeEntity(targetEntityId, depth - 1);
                }
            }
        } catch (error) {
            console.error(`Error processing entity ${entityId}:`, error);
        }
    }
    
    /**
     * Fetch an entity from the Orion-LD context broker
     * @param {string} entityId - The entity ID to fetch
     * @returns {Promise<object>} - The entity data
     */
    async fetchEntity(entityId) {
        try {
            // Initialize the OrionLDClient for API requests
            const client = new OrionLDClient();
            
            // Create the endpoint URL
            const endpoint = `/api/ngsi-ld/v1/entities/${encodeURIComponent(entityId)}?options=keyValues`;
            
            // Make the request
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: client.headers,
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`Server responded with status ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`Error fetching entity ${entityId}:`, error);
            throw error;
        }
    }
    
    /**
     * Find all relationship attributes in an entity
     * @param {object} entity - The entity object
     * @returns {Array} - Array of relationship attributes
     */
    findRelationshipAttributes(entity) {
        const relationships = [];
        
        // Iterate through all entity properties
        for (const [key, value] of Object.entries(entity)) {
            // Skip type and id properties
            if (key === 'id' || key === 'type') continue;
            
            // Check if this is a relationship (object with object or URI value)
            if (typeof value === 'object' && value !== null) {
                // If it has a type property of Relationship or is a direct URI reference
                if (
                    (value.type === 'Relationship' || value.type === 'Reference') ||
                    (typeof value === 'string' && value.startsWith('urn:'))
                ) {
                    relationships.push({
                        name: key,
                        value: value
                    });
                }
            } else if (typeof value === 'string' && value.startsWith('urn:')) {
                // Handle direct URI strings
                relationships.push({
                    name: key,
                    value: value
                });
            }
        }
        
        return relationships;
    }
    
    /**
     * Extract the target entity ID from a relationship value
     * @param {object|string} relationshipValue - The relationship value
     * @returns {string|null} - The target entity ID or null
     */
    getRelationshipTarget(relationshipValue) {
        // Handle different formats of relationship values
        if (typeof relationshipValue === 'string' && relationshipValue.startsWith('urn:')) {
            return relationshipValue;
        } else if (relationshipValue && typeof relationshipValue === 'object') {
            // Check for object property which contains the target entity URI
            if (relationshipValue.object && typeof relationshipValue.object === 'string') {
                return relationshipValue.object;
            }
            
            // Some NGSI-LD implementations use different property names
            if (relationshipValue.value && typeof relationshipValue.value === 'string') {
                return relationshipValue.value;
            }
        }
        
        return null;
    }
    
    /**
     * Add an entity node to the visualization
     * @param {object} entity - The entity data
     * @param {boolean} isMainEntity - Whether this is the main entity
     */
    addEntityNode(entity, isMainEntity = false) {
        const entityId = entity.id;
        const entityType = entity.type || 'Unknown';
        
        // Create a node for the entity
        const node = {
            id: entityId,
            label: this.formatNodeLabel(entity),
            title: this.createNodeTooltip(entity),
            group: isMainEntity ? 'selected' : 'entity',
            entityData: entity
        };
        
        // Add the node to the visualization
        this.nodes.add(node);
    }
    
    /**
     * Add a relationship edge to the visualization
     * @param {string} sourceId - Source entity ID
     * @param {string} targetId - Target entity ID
     * @param {string} relationshipName - Name of the relationship
     */
    addRelationshipEdge(sourceId, targetId, relationshipName) {
        // Create a unique ID for the edge
        const edgeId = `${sourceId}_${relationshipName}_${targetId}`;
        
        // Create the edge
        const edge = {
            id: edgeId,
            from: sourceId,
            to: targetId,
            label: relationshipName,
            title: `${relationshipName} relationship`,
            arrows: {
                to: { enabled: true, scaleFactor: 0.5 }
            }
        };
        
        // Add the edge to the visualization
        this.edges.add(edge);
    }
    
    /**
     * Create a formatted label for a node
     * @param {object} entity - The entity data
     * @returns {string} - Formatted label
     */
    formatNodeLabel(entity) {
        // Extract type and a short ID for the label
        const type = entity.type || 'Unknown';
        const shortId = this.shortenId(entity.id);
        
        return `${type}\n${shortId}`;
    }
    
    /**
     * Create a tooltip for a node
     * @param {object} entity - The entity data
     * @returns {string} - HTML tooltip
     */
    createNodeTooltip(entity) {
        const id = entity.id;
        const type = entity.type || 'Unknown';
        
        return `<div>
            <strong>ID:</strong> ${id}<br>
            <strong>Type:</strong> ${type}<br>
            <em>Click for more details</em>
        </div>`;
    }
    
    /**
     * Shorten an entity ID for display
     * @param {string} id - The full entity ID
     * @returns {string} - Shortened ID
     */
    shortenId(id) {
        if (!id) return 'Unknown';
        
        // If it's a URN, extract the last part
        if (id.includes(':')) {
            const parts = id.split(':');
            return parts[parts.length - 1];
        }
        
        // If it's too long, truncate it
        if (id.length > 15) {
            return id.substring(0, 12) + '...';
        }
        
        return id;
    }
    
    /**
     * Show entity details in the details panel
     * @param {object} node - The selected node
     */
    showEntityDetails(node) {
        if (!node || !node.entityData) return;
        
        const entity = node.entityData;
        const detailsContainer = document.getElementById('entity-details-content');
        
        // Create a formatted JSON representation
        const entityJson = JSON.stringify(entity, null, 2);
        
        // Update the details panel
        detailsContainer.innerHTML = `
            <h4>${entity.type || 'Entity'}: ${this.shortenId(entity.id)}</h4>
            <p><strong>ID:</strong> ${entity.id}</p>
            <div class="entity-actions">
                <button onclick="window.handleGetQuery('/${encodeURIComponent(entity.id)}')" 
                        class="method-button get-button">View in Editor</button>
            </div>
            <pre class="entity-json">${entityJson}</pre>
        `;
    }
    
    /**
     * Clear the visualization
     */
    clearVisualization() {
        // Clear all nodes and edges
        this.nodes.clear();
        this.edges.clear();
        
        // Clear processed entities set
        this.processedEntities.clear();
        
        // Clear entity details
        document.getElementById('entity-details-content').innerHTML = 
            '<p>Select an entity in the graph to view its details</p>';
    }
}

// Initialize the relationship visualizer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Wait a moment to ensure the DOM is fully loaded
    setTimeout(() => {
        try {
            window.relationshipVisualizer = new RelationshipVisualizer();
            console.log('Relationship visualizer initialized');
        } catch (error) {
            console.error('Error initializing relationship visualizer:', error);
        }
    }, 500);
});