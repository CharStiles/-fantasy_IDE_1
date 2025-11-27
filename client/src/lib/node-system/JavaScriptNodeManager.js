/**
 * JavaScriptNodeManager - Manages JavaScript nodes with p5.js-like setup/draw pattern
 * 
 * Features:
 * - p5.js-like model with setup() and draw() functions
 * - Connection utilities (getInputs, getOutputs, hasInput, hasOutput)
 * - Multiple code templates (checkbox grid, pixel analyzer, data logger, custom)
 * - Real-time shader input processing
 */
class JavaScriptNodeManager {
    constructor(nodeSystem) {
        this.nodeSystem = nodeSystem;
    }

    initializeJavaScript(node) {
        const nodeData = this.nodeSystem.nodes.get(node.id);
        
        // Create the checkbox grid container
        const content = node.querySelector('.node-content');
        const grid = document.createElement('div');
        grid.className = 'checkbox-grid';
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(32, 13px)';
        grid.style.width = '416px';
        grid.style.height = '480px';
        grid.style.gap = '0';
        content.appendChild(grid);

        // Store initial node data
        nodeData.data = {
            grid: grid
        };

        // Add event listeners for the edit button
        const editButton = node.querySelector('.expand-button');
        if (editButton) {
            editButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.nodeSystem.editorManager.toggleEditor(node.id, 'javascript');
            });
        }

        // Add event listener for run button
        const runButton = node.querySelector('.run-button');
        if (runButton) {
            runButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.executeCode(node.id, nodeData.code);
            });
        }

        // Add event listener for template button
        const templateButton = node.querySelector('.template-button');
        if (templateButton) {
            templateButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showTemplateMenu(node, nodeData);
            });
        }

        // Set default code and execute it
        nodeData.code = this.getDefaultCode();
        this.executeCode(node.id, nodeData.code);
    }

    /**
     * Get the default JavaScript code template (checkbox grid)
     * Uses p5.js-like setup() and draw() pattern
     */
    getDefaultCode() {
        return `// JavaScript Node - p5.js-like model with setup() and draw()
// This code runs in the node and has access to connection information

// Get the grid container (created by the node system)
const grid = nodeData.data.grid;
const size = 32;

// Setup function - runs once to initialize
function setup() {
    // Clear existing content
    grid.innerHTML = '';
    
    // Create checkboxes for visual output
    for (let i = 0; i < size * size; i++) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.style.width = '100%';
        checkbox.style.height = '100%';
        checkbox.style.margin = '0';
        grid.appendChild(checkbox);
    }
    
    grid.style.gridTemplateColumns = \`repeat(\${size}, 1fr)\`;
}

// Draw function - runs continuously to update
function draw() {
    // Get all connected shader nodes
    const shaderInputs = getInputs('webgl');
    
    if (shaderInputs.length > 0) {
        // Process the first shader input
        const shaderCanvas = shaderInputs[0].canvas;
        if (shaderCanvas) {
            processShaderInput(shaderCanvas);
        }
    }
}

// Process shader input data
function processShaderInput(shaderCanvas) {
    const checkboxes = grid.querySelectorAll('input');
    if (checkboxes.length === 0) return;

    // Create a temporary canvas for scaling
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = size;
    tempCanvas.height = size;

    // Draw the shader canvas to temp canvas, scaling it down
    tempCtx.drawImage(shaderCanvas, 0, 0, shaderCanvas.width, shaderCanvas.height, 0, 0, size, size);
    
    // Read the scaled pixels
    const imageData = tempCtx.getImageData(0, 0, size, size).data;

    // Update checkboxes based on scaled pixel data
    checkboxes.forEach((checkbox, i) => {
        const r = imageData[i * 4];
        const g = imageData[i * 4 + 1];
        const b = imageData[i * 4 + 2];
        const brightness = (r + g + b) / 3;
        checkbox.checked = brightness < 127;
    });
}

// Initialize and start the p5-like loop
setup();

// Set up a loop to check for inputs
function updateLoop() {
    draw();
    requestAnimationFrame(updateLoop);
}

// Start the update loop
updateLoop();`;
    }

    getNodeTemplate() {
        return `
            <div class="node-header">
                <span>JavaScript</span>
                <div class="header-buttons">
                    <button class="expand-button">Edit</button>
                    <button class="run-button" style="margin-left: 5px;">Run</button>
                    <button class="template-button" style="margin-left: 5px;">templates</button>
                    <button class="close-button" title="Delete tile">X</button>
                </div>
            </div>
            <div class="node-content">
            </div>
            <div class="node-ports">
                <div class="input-port"></div>
                <div class="output-port"></div>
            </div>`;
    }

    /**
     * Get all available code templates
     * Returns object with template names as keys and code as values
     */
    getCodeTemplates() {
        return {
            'checkbox-grid': this.getDefaultCode(),
            'pixel-analyzer': `// Pixel Analyzer - p5.js-like model for shader analysis
const grid = nodeData.data.grid;
const size = 16;

// Setup function - runs once to initialize
function setup() {
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = \`repeat(\${size}, 1fr)\`;
    
    // Create pixel divs
    for (let i = 0; i < size * size; i++) {
        const div = document.createElement('div');
        div.style.width = '100%';
        div.style.height = '100%';
        div.style.border = '1px solid #333';
        div.style.fontSize = '8px';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.justifyContent = 'center';
        div.textContent = '0';
        div.style.backgroundColor = '#222';
        div.style.color = '#666';
        grid.appendChild(div);
    }
    
    // Add a status indicator
    const statusDiv = document.createElement('div');
    statusDiv.style.cssText = \`
        position: absolute;
        top: -25px;
        left: 0;
        color: #888;
        font-size: 10px;
        font-family: monospace;
    \`;
    grid.parentElement.style.position = 'relative';
    grid.parentElement.appendChild(statusDiv);
}

function processShaderInput(shaderCanvas) {
    const divs = grid.querySelectorAll('div');
    
    if (divs.length === 0) return;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = size;
    tempCanvas.height = size;

    tempCtx.drawImage(shaderCanvas, 0, 0, shaderCanvas.width, shaderCanvas.height, 0, 0, size, size);
    const imageData = tempCtx.getImageData(0, 0, size, size).data;

    divs.forEach((div, i) => {
        const r = imageData[i * 4];
        const g = imageData[i * 4 + 1];
        const b = imageData[i * 4 + 2];
        const brightness = Math.round((r + g + b) / 3);
        
        div.textContent = brightness;
        div.style.backgroundColor = \`rgb(\${r}, \${g}, \${b})\`;
        div.style.color = brightness > 127 ? 'black' : 'white';
    });
    
    // Update status
    const statusDiv = grid.parentElement.querySelector('div[style*="position: absolute"]');
    if (statusDiv) {
        statusDiv.textContent = \`Pixel Analyzer - Processing \${size}x\${size} pixels\`;
    }
}

// Draw function - runs continuously to update
function draw() {
    const shaderInputs = getInputs('webgl');
    
    if (shaderInputs.length > 0) {
        const shaderCanvas = shaderInputs[0].canvas;
        if (shaderCanvas) {
            processShaderInput(shaderCanvas);
        }
    } else {
        // Show waiting state
        const statusDiv = grid.parentElement.querySelector('div[style*="position: absolute"]');
        if (statusDiv) {
            statusDiv.textContent = 'Pixel Analyzer - Waiting for shader input...';
        }
    }
}

// Initialize and start the p5-like loop
setup();

// Set up a loop to check for inputs
function updateLoop() {
    draw();
    requestAnimationFrame(updateLoop);
}

// Start the update loop
updateLoop();`,

            'data-logger': `// Data Logger - p5.js-like model for logging shader data
const grid = nodeData.data.grid;

// Setup function - runs once to initialize
function setup() {
    grid.innerHTML = '<div style="padding: 10px; font-family: monospace; font-size: 12px;">Data Logger<br/>Check console for output</div>';
}

function processShaderInput(shaderCanvas) {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = 32;
    tempCanvas.height = 32;

    tempCtx.drawImage(shaderCanvas, 0, 0, shaderCanvas.width, shaderCanvas.height, 0, 0, 32, 32);
    const imageData = tempCtx.getImageData(0, 0, 32, 32).data;
    
    // Calculate statistics
    let totalBrightness = 0;
    let maxBrightness = 0;
    let minBrightness = 255;
    
    for (let i = 0; i < imageData.length; i += 4) {
        const brightness = (imageData[i] + imageData[i + 1] + imageData[i + 2]) / 3;
        totalBrightness += brightness;
        maxBrightness = Math.max(maxBrightness, brightness);
        minBrightness = Math.min(minBrightness, brightness);
    }
    
    const avgBrightness = totalBrightness / (imageData.length / 4);
    
    console.log('Shader Data:', {
        averageBrightness: avgBrightness.toFixed(2),
        maxBrightness: maxBrightness.toFixed(2),
        minBrightness: minBrightness.toFixed(2),
        timestamp: new Date().toISOString()
    });
}

// Draw function - runs continuously to update
function draw() {
    const shaderInputs = getInputs('webgl');
    if (shaderInputs.length > 0) {
        const shaderCanvas = shaderInputs[0].canvas;
        if (shaderCanvas) {
            processShaderInput(shaderCanvas);
        }
    }
}

// Initialize and start the p5-like loop
setup();

// Set up a loop to check for inputs
function updateLoop() {
    draw();
    requestAnimationFrame(updateLoop);
}

// Start the update loop
updateLoop();`,

            'custom': `// Custom JavaScript Node - p5.js-like model
// Use the following functions to interact with the node system:
// - getInputs(nodeType) - Get connected input nodes
// - getOutputs(nodeType) - Get connected output nodes  
// - hasInput(nodeType) - Check if has input of specific type
// - hasOutput(nodeType) - Check if has output of specific type

const grid = nodeData.data.grid;

// Setup function - runs once to initialize
function setup() {
    grid.innerHTML = '<div style="padding: 10px;">Custom Node<br/>Edit this code to create your own logic</div>';
}

// Draw function - runs continuously to update
function draw() {
    // Your update logic here
    // Example: Check for inputs
    const shaderInputs = getInputs('webgl');
    if (shaderInputs.length > 0) {
        // Process shader input here
        const shaderCanvas = shaderInputs[0].canvas;
        if (shaderCanvas) {
            // Your custom processing logic
        }
    }
}

// Initialize and start the p5-like loop
setup();

// Set up a loop to check for inputs
function updateLoop() {
    draw();
    requestAnimationFrame(updateLoop);
}

// Start the update loop
updateLoop();`
        };
    }

    /**
     * Execute JavaScript code in a sandboxed environment with connection utilities
     * @param {string} nodeId - The ID of the node
     * @param {string} code - The JavaScript code to execute
     */
    executeCode(nodeId, code) {
        const nodeData = this.nodeSystem.nodes.get(nodeId);
        if (!nodeData || !nodeData.data) return;

        try {
            // Create a safe execution context with connection utilities
            const executionContext = `
                const nodeData = {
                    data: {
                        grid: document.querySelector('#${nodeId} .checkbox-grid')
                    },
                    element: document.getElementById('${nodeId}')
                };
                
                // Connection utilities available to the JavaScript code
                function getInputs(nodeType = null) {
                    if (!nodeSystem?.connectionManager?.connections || !nodeSystem?.nodes) {
                        return [];
                    }
                    
                    const allConnections = Array.from(nodeSystem.connectionManager.connections.values());
                    const filteredConnections = allConnections.filter(conn => conn.to === '${nodeId}');
                    const mappedNodes = filteredConnections.map(conn => nodeSystem.nodes.get(conn.from));
                    const validNodes = mappedNodes.filter(node => node && (!nodeType || node.type === nodeType));
                    
                    return validNodes.map(node => ({
                        id: node.element.id,
                        type: node.type,
                        canvas: node.element.querySelector('canvas'),
                        data: node.data,
                        code: node.code
                    }));
                }
                
                function getOutputs(nodeType = null) {
                    if (!nodeSystem?.connectionManager?.connections || !nodeSystem?.nodes) {
                        return [];
                    }
                    
                    const connections = Array.from(nodeSystem.connectionManager.connections.values())
                        .filter(conn => conn.from === '${nodeId}')
                        .map(conn => nodeSystem.nodes.get(conn.to))
                        .filter(node => node && (!nodeType || node.type === nodeType));
                    
                    return connections.map(node => ({
                        id: node.element.id,
                        type: node.type,
                        canvas: node.element.querySelector('canvas'),
                        data: node.data,
                        code: node.code
                    }));
                }
                
                function hasInput(nodeType) {
                    return getInputs(nodeType).length > 0;
                }
                
                function hasOutput(nodeType) {
                    return getOutputs(nodeType).length > 0;
                }
                
                // Make nodeSystem available for advanced usage
                const nodeSystem = this;
                
                ${code}
            `;
            
            // Execute the code with proper context binding
            const executeFunction = new Function(executionContext);
            executeFunction.call(this.nodeSystem);

        } catch (err) {
            console.error('Error executing JavaScript node code:', err);
        }
    }

    /**
     * Handle connections to JavaScript nodes
     * Re-executes the JavaScript code when new connections are made
     * @param {Object} fromNode - The source node
     * @param {Object} toNode - The target node
     */
    handleConnection(fromNode, toNode) {
        // Connection handling is now done in the JavaScript code itself
        // The code can use getInputs() to detect new connections
        
        // Re-execute the JavaScript code to pick up new connections
        if (toNode.type === 'javascript') {
            const nodeData = this.nodeSystem.nodes.get(toNode.element.id);
            if (nodeData && nodeData.code) {
                this.executeCode(toNode.element.id, nodeData.code);
            }
        }
    }

    showTemplateMenu(node, nodeData) {
        // Remove existing menu if it exists
        const existingMenu = document.querySelector('.template-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        // Create template menu
        const menu = document.createElement('div');
        menu.className = 'template-menu';
        menu.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            background: #2a2a2a;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 8px;
            z-index: 1000;
            min-width: 200px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;

        const templates = this.getCodeTemplates();
        
        Object.entries(templates).forEach(([name, code]) => {
            const button = document.createElement('button');
            button.textContent = name.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
            button.style.cssText = `
                display: block;
                width: 100%;
                padding: 8px 12px;
                margin: 2px 0;
                background: #3a3a3a;
                border: none;
                border-radius: 3px;
                color: white;
                cursor: pointer;
                text-align: left;
                font-size: 12px;
            `;
            
            button.addEventListener('mouseenter', () => {
                button.style.background = '#4a4a4a';
            });
            
            button.addEventListener('mouseleave', () => {
                button.style.background = '#3a3a3a';
            });
            
            button.addEventListener('click', () => {
                nodeData.code = code;
                this.executeCode(node.id, code);
                menu.remove();
            });
            
            menu.appendChild(button);
        });

        // Position menu relative to the template button
        const templateButton = node.querySelector('.template-button');
        templateButton.style.position = 'relative';
        templateButton.appendChild(menu);

        // Close menu when clicking outside
        const closeMenu = (e) => {
            if (!menu.contains(e.target) && !templateButton.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 0);
    }
}

export default JavaScriptNodeManager; 