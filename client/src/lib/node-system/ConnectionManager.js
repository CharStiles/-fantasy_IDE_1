class ConnectionManager {
    constructor(nodeSystem) {
        this.nodeSystem = nodeSystem;
        this.connections = new Map();
        this.draggedConnection = null;
        this.tempConnection = null;
        this.chaosInterval = null;
        
        // Create event emitter
        this.events = new Map();
        
        // Create SVG element
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.classList.add('connections');
        this.svg.style.position = 'absolute';
        this.svg.style.top = '0';
        this.svg.style.left = '0';
        this.svg.style.width = '100%';
        this.svg.style.height = '100%';
        this.svg.style.pointerEvents = 'none';
        this.svg.style.zIndex = '1';
        this.nodeSystem.container.appendChild(this.svg); // Append to container instead of body
        
        // Initialize SVG size and position
        this.updateSVGSize();
        
        // Track node movements
        this.trackNodeMovements();
        
        console.log('ConnectionManager initialized');
    }

    trackNodeMovements() {
        let animationFrameId = null;
        
        const updateConnections = () => {
            this.updateSVGSize(); // Update SVG size and position
            this.updateConnections();
            animationFrameId = null;
        };

        // Listen for mousemove on container
        this.nodeSystem.container.addEventListener('mousemove', () => {
            if (!animationFrameId) {
                animationFrameId = requestAnimationFrame(updateConnections);
            }
        });

        // Listen for mouseup - this is crucial for updating SVG location
        document.addEventListener('mouseup', () => {
            if (!animationFrameId) {
                animationFrameId = requestAnimationFrame(updateConnections);
            }
        });

        // Listen for transform changes
        const observer = new MutationObserver(() => {
            if (!animationFrameId) {
                animationFrameId = requestAnimationFrame(updateConnections);
            }
        });

        observer.observe(this.nodeSystem.container, {
            attributes: true,
            attributeFilter: ['style', 'transform'],
            subtree: true
        });

        // Listen for window resize
        window.addEventListener('resize', () => {
            if (!animationFrameId) {
                animationFrameId = requestAnimationFrame(updateConnections);
            }
        });
    }

    createConnection(fromId, toId) {
        console.log('createConnection called with:', fromId, toId);
        if (!fromId || !toId) {
            console.error('Invalid node IDs:', fromId, toId);
            return;
        }
        this.connect(fromId, toId);
    }

    connect(fromId, toId) {
        console.log('connect called with:', fromId, toId);
        const connectionId = `${fromId}-${toId}`;
        
        if (this.connections.has(connectionId)) {
            console.log('Connection already exists');
            return;
        }
        
        const fromNode = document.getElementById(fromId);
        const toNode = document.getElementById(toId);
        
        if (!fromNode || !toNode) {
            console.error('Nodes not found:', fromId, toId);
            return;
        }

        const fromNodeData = this.nodeSystem.nodes.get(fromId);
        const toNodeData = this.nodeSystem.nodes.get(toId);

        if (!fromNodeData || !toNodeData) {
            console.error('Node data not found');
            return;
        }

        console.log('Creating connection between:', fromNodeData.type, 'and', toNodeData.type);

        // Create the connection
        this.connections.set(connectionId, { from: fromId, to: toId });
        
        // Emit connection event
        this.emit('connection', fromId, toId);
        
        // Handle webcam to WebGL connection
        if (fromNodeData.type === 'webcam' && toNodeData.type === 'webgl') {
            console.log('Setting up webcam to WebGL connection');
            this.nodeSystem.shaderManager.updateShaderConnection(fromNode, toNode);
        }
        if (fromNodeData.type === 'hdmi' && toNodeData.type === 'webgl') {
            console.log('Setting up webcam to WebGL connection');
            this.nodeSystem.shaderManager.updateShaderConnection(fromNode, toNode);
        }
        // Draw the connection
        this.drawConnection(fromId, toId);
        console.log('Connection created and drawn');
    }

    drawConnection(fromId, toId) {
        const fromNode = document.getElementById(fromId);
        const toNode = document.getElementById(toId);

        if (!fromNode || !toNode) return;

        const fromPort = fromNode.querySelector('.output-port');
        const toPort = toNode.querySelector('.input-port');

        if (!fromPort || !toPort) return;

        // Get positions relative to the container
        const containerRect = this.nodeSystem.container.getBoundingClientRect();
        const fromRect = fromPort.getBoundingClientRect();
        const toRect = toPort.getBoundingClientRect();

        const fromX = fromRect.left - containerRect.left + (fromRect.width / 2);
        const fromY = fromRect.top - containerRect.top + (fromRect.height / 2);
        const toX = toRect.left - containerRect.left + (toRect.width / 2);
        const toY = toRect.top - containerRect.top + (toRect.height / 2);

        // Create path
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        
        // Calculate bezier curve
        const dx = toX - fromX;
        const dy = toY - fromY;
        const curve = Math.min(Math.abs(dx) / 2, 100);
        
        const pathData = `M ${fromX},${fromY} 
                         C ${fromX + curve},${fromY}
                           ${toX - curve},${toY}
                           ${toX},${toY}`;

        // Set path attributes
        path.setAttribute('d', pathData);
        path.setAttribute('stroke', '#ffffff');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.id = `connection-${fromId}-${toId}`;

        // Add to SVG
        this.svg.appendChild(path);
        console.log('Drew connection:', fromId, toId);
    }

    updateConnections() {
        console.log('Updating all connections');
        // Clear existing paths
        while (this.svg.firstChild) {
            this.svg.removeChild(this.svg.firstChild);
        }

        // Redraw all connections
        this.connections.forEach((connection, connectionId) => {
            const fromNode = document.getElementById(connection.from);
            const toNode = document.getElementById(connection.to);
            if (!fromNode || !toNode) return;

            const fromPort = fromNode.querySelector('.output-port');
            const toPort = toNode.querySelector('.input-port');
            if (!fromPort || !toPort) return;

            // Get positions relative to the container
            const containerRect = this.nodeSystem.container.getBoundingClientRect();
            const fromRect = fromPort.getBoundingClientRect();
            const toRect = toPort.getBoundingClientRect();

            const fromX = fromRect.left - containerRect.left + (fromRect.width / 2);
            const fromY = fromRect.top - containerRect.top + (fromRect.height / 2);
            const toX = toRect.left - containerRect.left + (toRect.width / 2);
            const toY = toRect.top - containerRect.top + (toRect.height / 2);

            // Create path
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            
            // Calculate bezier curve
            const dx = toX - fromX;
            const dy = toY - fromY;
            const curve = Math.min(Math.abs(dx) / 2, 100);
            
            const pathData = `M ${fromX},${fromY} 
                             C ${fromX + curve},${fromY}
                               ${toX - curve},${toY}
                               ${toX},${toY}`;

            // Set path attributes
            path.setAttribute('d', pathData);
            path.setAttribute('stroke', '#ffffff');
            path.setAttribute('stroke-width', '2');
            path.setAttribute('fill', 'none');
            path.id = `connection-${connectionId}`;

            // Add to SVG
            this.svg.appendChild(path);
        });
    }

    removeConnection(connectionId) {
        if (this.connections.has(connectionId)) {
            const connection = this.connections.get(connectionId);
            this.connections.delete(connectionId);
            
            // Stop processing for JavaScript nodes
            const fromNode = this.nodeSystem.nodes.get(connection.from);
            const toNode = this.nodeSystem.nodes.get(connection.to);
            if (fromNode && fromNode.type === 'webgl' && toNode && toNode.type === 'javascript') {
                // Stop any ongoing processing
                this.nodeSystem.stopNodeProcessing(connection.from, connection.to);
            }
            
            this.updateConnections();
        }
    }

    createConnectionPath(from, to) {
        // Validate input points
        if (!from || !to || typeof from.x === 'undefined' || typeof to.x === 'undefined') {
            console.warn('Invalid points for connection path:', from, to);
            return '';
        }

        // Create a curved path between points
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const curve = Math.min(Math.abs(dx) / 2, 100); // Control point offset

        return `M ${from.x},${from.y} 
                C ${from.x + curve},${from.y} 
                  ${to.x - curve},${to.y} 
                  ${to.x},${to.y}`;
    }

    updateConnections(nodeId) {
        // Update all connections involving this node
        this.connections.forEach((connection, id) => {
            if (connection.from === nodeId || connection.to === nodeId) {
                this.updateConnection(id);
            }
        });
    }

    updateConnection(connectionId) {
        const connection = this.connections.get(connectionId);
        if (!connection) return;

        const fromNode = document.getElementById(connection.from);
        const toNode = document.getElementById(connection.to);
        if (!fromNode || !toNode) return;

        const fromPort = fromNode.querySelector('.output-port');
        const toPort = toNode.querySelector('.input-port');
        if (!fromPort || !toPort) return;

        // Get the current positions of the nodes
        const fromRect = fromPort.getBoundingClientRect();
        const toRect = toPort.getBoundingClientRect();
        const containerRect = this.nodeSystem.container.getBoundingClientRect();

        // Calculate port positions relative to container
        const from = {
            x: fromRect.left + fromRect.width / 2 - containerRect.left,
            y: fromRect.top + fromRect.height / 2 - containerRect.top
        };

        const to = {
            x: toRect.left + toRect.width / 2 - containerRect.left,
            y: toRect.top + toRect.height / 2 - containerRect.top
        };

        // Create curved path
        const dx = to.x - from.x;
        const curve = Math.min(Math.abs(dx) / 2, 100);

        const path = `M ${from.x} ${from.y} 
                     C ${from.x + curve} ${from.y},
                       ${to.x - curve} ${to.y},
                       ${to.x} ${to.y}`;

        // Update the SVG path
        connection.element.setAttribute('d', path);

        // Request animation frame for smooth updates during animation
        requestAnimationFrame(() => this.updateConnection(connectionId));
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

    removeConnectionsForNode(nodeId) {
        // Remove all connections involving this node
        this.connections.forEach((connection, id) => {
            if (connection.from === nodeId || connection.to === nodeId) {
                this.removeConnection(id);
            }
        });
    }

    getConnections(nodeId) {
        // Get all connections involving this node
        const nodeConnections = new Map();
        this.connections.forEach((connection, id) => {
            if (connection.from === nodeId || connection.to === nodeId) {
                nodeConnections.set(id, connection);
            }
        });
        return nodeConnections;
    }

    getInputConnections(nodeId) {
        // Get connections where this node is the target
        const inputConnections = new Map();
        this.connections.forEach((connection, id) => {
            if (connection.to === nodeId) {
                inputConnections.set(id, connection);
            }
        });
        return inputConnections;
    }

    getOutputConnections(nodeId) {
        // Get connections where this node is the source
        const outputConnections = new Map();
        this.connections.forEach((connection, id) => {
            if (connection.from === nodeId) {
                outputConnections.set(id, connection);
            }
        });
        return outputConnections;
    }

    updateSVGSize() {
        // Update SVG size and position to match container
        const containerRect = this.nodeSystem.container.getBoundingClientRect();
        
        // Update SVG dimensions
        this.svg.setAttribute('width', containerRect.width);
        this.svg.setAttribute('height', containerRect.height);
        
        // Ensure SVG is positioned correctly relative to container
        this.svg.style.width = `${containerRect.width}px`;
        this.svg.style.height = `${containerRect.height}px`;
        this.svg.style.top = '0px';
        this.svg.style.left = '0px';
        
        console.log('SVG updated - size:', containerRect.width, 'x', containerRect.height);
    }

    // Public method to manually trigger SVG update
    forceUpdateSVG() {
        this.updateSVGSize();
        this.updateConnections();
    }

    clearAllConnections() {
        // Remove all connection paths
        while (this.svg.firstChild) {
            this.svg.removeChild(this.svg.firstChild);
        }
        this.connections.clear();
    }

    serializeConnections() {
        // Convert connections to a serializable format
        const serialized = {};
        this.connections.forEach((connection, id) => {
            serialized[id] = {
                from: connection.from,
                to: connection.to
            };
        });
        return serialized;
    }

    deserializeConnections(serialized) {
        // Restore connections from serialized data
        this.clearAllConnections();
        Object.entries(serialized).forEach(([id, connection]) => {
            this.connections.set(id, connection);
            this.updateConnection(id);
        });
    }

    startChaosMode() {
        // Animate connection colors
        this.chaosInterval = setInterval(() => {
            const connections = document.querySelectorAll('.connection-line');
            connections.forEach(connection => {
                connection.style.stroke = `hsl(${Math.random() * 360}, 100%, 50%)`;
                connection.style.strokeWidth = `${Math.random() * 5 + 2}px`;
                connection.style.filter = `blur(${Math.random() * 2}px) brightness(${Math.random() + 1})`;
            });
        }, 100);
    }

    stopChaosMode() {
        if (this.chaosInterval) {
            clearInterval(this.chaosInterval);
            this.chaosInterval = null;
            
            // Reset connections to default style
            const connections = document.querySelectorAll('.connection-line');
            connections.forEach(connection => {
                connection.style.stroke = '#ff69b4';
                connection.style.strokeWidth = '3px';
                connection.style.filter = 'none';
            });
        }
    }

    // Add event emitter methods
    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(callback);
    }

    emit(event, ...args) {
        if (this.events.has(event)) {
            this.events.get(event).forEach(callback => callback(...args));
        }
    }
}

export default ConnectionManager; 