export class NodeEventHandler {
    constructor(nodeSystem) {
        this.nodeSystem = nodeSystem;
        this.draggedNode = null;
        this.dragOffset = { x: 0, y: 0 };
        this.draggedConnection = null;
        this.tempConnection = null;
        this.animationSpeed = 2;
        this.isAnimating = false;
        this.nodeVelocities = new Map();
        
        // Add animation control buttons
        this.setupAnimationControls();
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Node dragging
        this.nodeSystem.container.addEventListener('mousedown', (e) => {
            // Don't start drag if clicking buttons
            if (e.target.closest('.close-button') || 
                e.target.closest('.expand-button') || 
                e.target.closest('.header-buttons')) {
                return;
            }
            
            // Only start dragging if clicking the header
            const nodeHeader = e.target.closest('.node-header');
            const node = e.target.closest('.node');
            if (!nodeHeader || !node) return;

            // Don't initiate drag if node is expanded
            if (node.classList.contains('expanded')) {
                return;
            }

            this.draggedNode = node;
            const rect = node.getBoundingClientRect();
            this.dragOffset = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            
            // Disable transitions during drag for immediate response
            node.style.transition = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (this.draggedNode) {
                const x = e.clientX - this.dragOffset.x;
                const y = e.clientY - this.dragOffset.y;
                this.updateNodePosition(x, y);
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.draggedNode) {
                // Re-enable transitions after drag
                this.draggedNode.style.transition = '';
                
                // Final connection update
                if (this.nodeSystem.connectionManager) {
                    this.nodeSystem.connectionManager.updateConnections();
                }
                this.draggedNode = null;
            }
        });

        // Port connection handling
        this.nodeSystem.container.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('output-port')) {
                const nodeId = e.target.closest('.node').id;
                this.startConnectionDrag(nodeId, e);
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.draggedConnection) {
                this.updateConnectionDrag(e);
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (this.draggedConnection) {
                if (e.target.classList.contains('input-port')) {
                    const toNodeId = e.target.closest('.node').id;
                    this.completeConnection(this.draggedConnection.fromId, toNodeId);
                }
                this.cancelConnectionDrag();
            }
        });
        
        // Setup editor and close button events
        this.setupEditorEvents();
    }

    updateNodePosition(x, y) {
        if (!this.draggedNode) return;
        
        // Update node position
        this.draggedNode.style.left = `${x}px`;
        this.draggedNode.style.top = `${y}px`;
        
        // Force connection update immediately
        if (this.nodeSystem.connectionManager) {
            // Get the node's ID and update its connections
            const nodeId = this.draggedNode.id;
            const connections = this.nodeSystem.connectionManager.getConnections(nodeId);
            
            // Update each connection involving this node
            connections.forEach((connection) => {
                const fromNode = document.getElementById(connection.from);
                const toNode = document.getElementById(connection.to);
                
                if (fromNode && toNode) {
                    const fromPort = fromNode.querySelector('.output-port');
                    const toPort = toNode.querySelector('.input-port');
                    
                    if (fromPort && toPort) {
                        // Get positions relative to the container
                        const containerRect = this.nodeSystem.container.getBoundingClientRect();
                        const fromRect = fromPort.getBoundingClientRect();
                        const toRect = toPort.getBoundingClientRect();

                        const fromX = fromRect.left - containerRect.left + (fromRect.width / 2);
                        const fromY = fromRect.top - containerRect.top + (fromRect.height / 2);
                        const toX = toRect.left - containerRect.left + (toRect.width / 2);
                        const toY = toRect.top - containerRect.top + (toRect.height / 2);

                        // Calculate bezier curve
                        const dx = toX - fromX;
                        const dy = toY - fromY;
                        const curve = Math.min(Math.abs(dx) / 2, 100);
                        
                        const pathData = `M ${fromX},${fromY} 
                                        C ${fromX + curve},${fromY}
                                          ${toX - curve},${toY}
                                          ${toX},${toY}`;

                        // Update the path
                        const path = document.getElementById(`connection-${connection.from}-${connection.to}`);
                        if (path) {
                            path.setAttribute('d', pathData);
                        }
                    }
                }
            });
        }
    }

    setupConnectionEvents() {
        this.nodeSystem.container.addEventListener('mousedown', (e) => {
            const port = e.target.closest('.input-port, .output-port');
            if (!port || e.target.closest('.node.expanded')) return;

            const node = port.closest('.node');
            if (!node) return;

            this.draggedConnection = {
                start: port,
                startNode: node,
                isInput: port.classList.contains('input-port')
            };

            // Create temporary connection line
            this.tempConnection = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            this.tempConnection.setAttribute('class', 'connection-line temp');
            this.nodeSystem.connectionManager.svg.appendChild(this.tempConnection);

            // Get starting position
            const startPos = this.getPortPosition(port);
            if (startPos) {
                const mousePos = {
                    x: e.clientX - this.nodeSystem.container.getBoundingClientRect().left,
                    y: e.clientY - this.nodeSystem.container.getBoundingClientRect().top
                };
                this.updateTempConnection(startPos, mousePos);
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.draggedConnection && this.tempConnection) {
                const startPos = this.getPortPosition(this.draggedConnection.start);
                if (startPos) {
                    const mousePos = {
                        x: e.clientX - this.nodeSystem.container.getBoundingClientRect().left,
                        y: e.clientY - this.nodeSystem.container.getBoundingClientRect().top
                    };
                    this.updateTempConnection(startPos, mousePos);
                }
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (this.draggedConnection && this.tempConnection) {
                const endPort = e.target.closest('.input-port, .output-port');
                if (endPort && endPort !== this.draggedConnection.start) {
                    const endNode = endPort.closest('.node');
                    if (endNode && this.isValidConnection(this.draggedConnection, endPort, endNode)) {
                        this.createConnection(this.draggedConnection, endPort, endNode);
                    }
                }
                this.tempConnection.remove();
                this.tempConnection = null;
                this.draggedConnection = null;
            }
        });
    }

    setupResizeEvents() {
        window.addEventListener('resize', () => {
            if (this.nodeSystem.constructor.expandedNode) {
                const node = document.getElementById(this.nodeSystem.constructor.expandedNode);
                if (node) {
                    const canvas = node.querySelector('canvas');
                    if (canvas) {
                        const padding = 40;
                        canvas.width = window.innerWidth - padding * 2;
                        canvas.height = window.innerHeight - padding * 2;
                        
                        const nodeData = this.nodeSystem.nodes.get(this.nodeSystem.constructor.expandedNode);
                        if (nodeData?.data?.gl) {
                            const gl = nodeData.data.gl;
                            gl.viewport(0, 0, canvas.width, canvas.height);
                            if (nodeData.data.resolutionLocation) {
                                gl.uniform2f(nodeData.data.resolutionLocation, canvas.width, canvas.height);
                            }
                        }
                    }
                }
            }
        });
    }

    setupEditorEvents() {
        this.nodeSystem.container.addEventListener('click', (e) => {
            const editButton = e.target.closest('.expand-button');
            if (editButton) {
                const node = editButton.closest('.node');
                if (node) {
                    const type = node.getAttribute('data-type');
                    this.nodeSystem.editorManager.toggleEditor(node.id, type);
                }
                return;
            }
            
            // Handle close button click
            const closeButton = e.target.closest('.close-button');
            if (closeButton) {
                e.stopPropagation(); // Prevent triggering drag
                e.preventDefault(); // Prevent any default behavior
                const node = closeButton.closest('.node');
                if (node) {
                    const nodeId = node.id;
                    console.log('Closing node:', nodeId);
                    // Close any open editor for this node first
                    if (this.nodeSystem.editorManager._activeEditor && 
                        this.nodeSystem.editorManager._activeEditor.nodeId === nodeId) {
                        this.nodeSystem.editorManager.closeEditor(nodeId);
                    }
                    // Delete the node (this will also update the toggle view)
                    this.nodeSystem.deleteNode(nodeId);
                }
            }
        });
    }

    toggleCanvasExpand(nodeId) {
        const node = document.getElementById(nodeId);
        const isExpanded = node.classList.contains('expanded');
        const canvas = node.querySelector('canvas');
        
        // Reset previous expanded node if exists
        if (this.nodeSystem.constructor.expandedNode && 
            this.nodeSystem.constructor.expandedNode !== nodeId) {
            const prevNode = document.getElementById(this.nodeSystem.constructor.expandedNode);
            if (prevNode) {
                prevNode.classList.remove('expanded');
                const prevCanvas = prevNode.querySelector('canvas');
                if (prevCanvas) {
                    prevCanvas.width = 320;
                    prevCanvas.height = 240;
                }
                const ports = prevNode.querySelector('.node-ports');
                if (ports) ports.style.display = 'flex';
            }
        }

        if (!isExpanded) {
            node.classList.add('expanded');
            this.nodeSystem.constructor.expandedNode = nodeId;
            
            const ports = node.querySelector('.node-ports');
            if (ports) ports.style.display = 'none';
            
            if (canvas) {
                const padding = 40;
                canvas.width = window.innerWidth - padding * 2;
                canvas.height = window.innerHeight - padding * 2;
                
                const nodeData = this.nodeSystem.nodes.get(nodeId);
                if (nodeData?.data?.gl) {
                    const gl = nodeData.data.gl;
                    gl.viewport(0, 0, canvas.width, canvas.height);
                    if (nodeData.data.resolutionLocation) {
                        gl.uniform2f(nodeData.data.resolutionLocation, canvas.width, canvas.height);
                    }
                }
            }
        } else {
            node.classList.remove('expanded');
            this.nodeSystem.constructor.expandedNode = null;
            
            const ports = node.querySelector('.node-ports');
            if (ports) ports.style.display = 'flex';
            
            if (canvas) {
                canvas.width = 320;
                canvas.height = 240;
                
                const nodeData = this.nodeSystem.nodes.get(nodeId);
                if (nodeData?.data?.gl) {
                    const gl = nodeData.data.gl;
                    gl.viewport(0, 0, canvas.width, canvas.height);
                    if (nodeData.data.resolutionLocation) {
                        gl.uniform2f(nodeData.data.resolutionLocation, canvas.width, canvas.height);
                    }
                }
            }
        }
    }

    getPortPosition(port) {
        if (!port) return null;
        const rect = port.getBoundingClientRect();
        const containerRect = this.nodeSystem.container.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2 - containerRect.left,
            y: rect.top + rect.height / 2 - containerRect.top
        };
    }

    updateTempConnection(start, end) {
        if (!this.tempConnection || !start || !end) return;
        const path = this.nodeSystem.connectionManager.createConnectionPath(start, end);
        if (path) {
            this.tempConnection.setAttribute('d', path);
        }
    }

    isValidConnection(draggedConnection, endPort, endNode) {
        const isInput = endPort.classList.contains('input-port');
        return draggedConnection.isInput !== isInput && 
               draggedConnection.startNode !== endNode;
    }

    createConnection(draggedConnection, endPort, endNode) {
        const fromNode = draggedConnection.isInput ? endNode : draggedConnection.startNode;
        const toNode = draggedConnection.isInput ? draggedConnection.startNode : endNode;
        
        const connectionId = `connection-${Date.now()}`;
        this.nodeSystem.connectionManager.connections.set(connectionId, {
            from: fromNode.id,
            to: toNode.id
        });

        // If this is a WebGL connection, update shaders
        if (fromNode.getAttribute('data-type') === 'webgl' && 
            toNode.getAttribute('data-type') === 'webgl') {
            this.nodeSystem.shaderManager.updateShaderConnection(fromNode, toNode);
        }
    }

    setupAnimationControls() {
        // No longer creating buttons here
        this.animationSpeed = 1;
        this.isAnimating = false;
        this.nodeVelocities = new Map();
    }

    toggleBounce() {
        if (!this.isAnimating) {
            this.startBouncing();
        } else {
            this.stopBouncing();
        }
    }

    startBouncing() {
        this.isAnimating = true;
        
        // Initialize random velocities for each node if they don't have one
        this.nodeSystem.nodes.forEach((nodeData, id) => {
            if (!this.nodeVelocities.has(id)) {
                this.initializeNodeVelocity(id);
            }
        });
        
        const animate = () => {
            if (!this.isAnimating) return;
            
            this.nodeSystem.nodes.forEach((nodeData, id) => {
                const node = nodeData.element;
                if (!this.nodeVelocities.has(id)) {
                    this.initializeNodeVelocity(id);
                }
                const velocity = this.nodeVelocities.get(id);
                
                let rect = node.getBoundingClientRect();
                let newX = rect.left + velocity.x * this.animationSpeed;
                let newY = rect.top + velocity.y * this.animationSpeed;
                
                // Add dampening on bounce
                const dampeningFactor = 0.85;
                const minSpeed = 0.5;
                const edgeBuffer = 20; // Buffer from edges to prevent sticking
                
                // Bounce off walls with dampening
                if (newX <= edgeBuffer || newX + rect.width >= window.innerWidth - edgeBuffer) {
                    velocity.x *= -dampeningFactor;
                    // Ensure minimum speed and prevent sticking
                    if (Math.abs(velocity.x) < minSpeed) {
                        velocity.x = minSpeed * Math.sign(velocity.x);
                    }
                    newX = Math.max(edgeBuffer, Math.min(newX, window.innerWidth - rect.width - edgeBuffer));
                }
                
                if (newY <= edgeBuffer || newY + rect.height >= window.innerHeight - edgeBuffer) {
                    velocity.y *= -dampeningFactor;
                    // Ensure minimum speed and prevent sticking
                    if (Math.abs(velocity.y) < minSpeed) {
                        velocity.y = minSpeed * Math.sign(velocity.y);
                    }
                    newY = Math.max(edgeBuffer, Math.min(newY, window.innerHeight - rect.height - edgeBuffer));
                }
                
                // Add slight randomization to prevent synchronization
                if (Math.random() < 0.01) {  // 1% chance per frame
                    velocity.x += (Math.random() - 0.5) * 0.1;
                    velocity.y += (Math.random() - 0.5) * 0.1;
                }
                
                // Apply position
                node.style.left = `${newX}px`;
                node.style.top = `${newY}px`;
            });
            
            // Update connections
            if (this.nodeSystem.connectionManager) {
                this.nodeSystem.connectionManager.updateConnections();
            }
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    stopBouncing() {
        this.isAnimating = false;
    }

    speedUp() {
        this.animationSpeed = Math.min(this.animationSpeed + 39, 1000);
    }

    slowDown() {
        this.animationSpeed = Math.max(this.animationSpeed - 39, 1);
    }

    startConnectionDrag(fromId, event) {
        this.draggedConnection = {
            fromId,
            fromPos: this.getPortPosition(fromId, 'output')
        };

        // Create temporary SVG connection line
        this.tempConnection = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.tempConnection.setAttribute('class', 'connection-line temp');
        
        const svg = document.getElementById('connections');
        if (svg) {
            svg.appendChild(this.tempConnection);
        }
    }

    updateConnectionDrag(event) {
        if (!this.tempConnection || !this.draggedConnection) return;

        const fromPos = this.draggedConnection.fromPos;
        const toPos = {
            x: event.clientX - this.nodeSystem.container.getBoundingClientRect().left,
            y: event.clientY - this.nodeSystem.container.getBoundingClientRect().top
        };
        
        const path = this.createConnectionPath(fromPos, toPos);
        this.tempConnection.setAttribute('d', path);
    }

    cancelConnectionDrag() {
        if (this.tempConnection && this.tempConnection.parentNode) {
            this.tempConnection.parentNode.removeChild(this.tempConnection);
        }
        this.draggedConnection = null;
        this.tempConnection = null;
    }

    completeConnection(fromId, toId) {
        // Create the connection in the node system
        if (this.nodeSystem.connectionManager) {
            this.nodeSystem.connectionManager.createConnection(fromId, toId);
        }
    }

    getPortPosition(nodeId, portType) {
        const node = document.getElementById(nodeId);
        if (!node) return null;
        
        const port = node.querySelector(`.${portType}-port`);
        if (!port) return null;

        const rect = port.getBoundingClientRect();
        const containerRect = this.nodeSystem.container.getBoundingClientRect();
        
        return {
            x: rect.left + rect.width / 2 - containerRect.left,
            y: rect.top + rect.height / 2 - containerRect.top
        };
    }

    createConnectionPath(from, to) {
        if (!from || !to) return '';
        
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const curve = Math.min(Math.abs(dx) / 2, 100); // Control point offset

        return `M ${from.x} ${from.y} 
                C ${from.x + curve} ${from.y},
                  ${to.x - curve} ${to.y},
                  ${to.x} ${to.y}`;
    }

    // Helper method to initialize velocity for a node
    initializeNodeVelocity(id) {
        // Reduced initial velocity range and added minimum speed
        const minSpeed = 0.5;
        const maxSpeed = 2;
        const angle = Math.random() * Math.PI * 2; // Random direction in radians
        
        // Use trigonometry to ensure consistent speed regardless of direction
        this.nodeVelocities.set(id, {
            x: Math.cos(angle) * (minSpeed + Math.random() * (maxSpeed - minSpeed)),
            y: Math.sin(angle) * (minSpeed + Math.random() * (maxSpeed - minSpeed))
        });
    }

    startCircularAnimation() {
        this.isAnimating = true;
        
        // Calculate center of screen
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        
        // Calculate radius based on screen size
        const radius = Math.min(window.innerWidth, window.innerHeight) * 0.3;
        
        // Get all nodes
        const nodes = Array.from(this.nodeSystem.nodes.entries());
        const nodeCount = nodes.length;
        
        const animate = () => {
            if (!this.isAnimating) return;
            
            const time = performance.now() * 0.001; // Convert to seconds
            
            nodes.forEach(([id, nodeData], index) => {
                const node = nodeData.element;
                if (!node) return;
                
                // Calculate angle for this node
                const angle = (index / nodeCount) * Math.PI * 2 + time * 0.5;
                
                // Calculate position on circle
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                
                // Add some vertical oscillation
                const verticalOffset = Math.sin(time * 2 + index) * 20;
                
                // Apply position with smooth transition
                node.style.transition = 'all 0.3s ease-out';
                node.style.left = `${x}px`;
                node.style.top = `${y + verticalOffset}px`;
                
                // Add slight rotation
                node.style.transform = `rotate(${Math.sin(time + index) * 5}deg)`;
            });
            
            // Update connections
            if (this.nodeSystem.connectionManager) {
                this.nodeSystem.connectionManager.updateConnections();
            }
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    stopCircularAnimation() {
        this.isAnimating = false;
        
        // Reset node positions and transforms
        this.nodeSystem.nodes.forEach((nodeData) => {
            const node = nodeData.element;
            if (node) {
                node.style.transition = 'all 0.5s ease-out';
                node.style.transform = 'none';
            }
        });
    }
}

export default NodeEventHandler; 