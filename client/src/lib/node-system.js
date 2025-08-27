// Import any required dependencies at the top
// import { CodeMirror } from 'codemirror';  // Uncomment if needed
import { fragmentShaders } from './defaultShaders.js';
import DiffManager from './node-system/DiffManager.js';

// Global state (move inside the class as static or private fields)
class NodeSystem {
    static #editor;
    static #isExpanded = false;
    static #isDirty = false;
    static #fragmentShader;
    static #activeEditor = null;
    static #activeNodeId = null;
    static #expandedNode = null;

    constructor() {
        this.container = document.getElementById('node-container');
        this.nodes = new Map();
        this.connections = new Map();
        this.draggedNode = null;
        this.dragOffset = { x: 0, y: 0 };
        this.draggedConnection = null;
        this.tempConnection = null;
        this.diffManager = new DiffManager(this);
        this.setupEventListeners();
        this.initializeShaderEditor();
        this.setupConnectionEventListeners();
        this.setupHotkeys();
        this.createWebGLButton();

        // Add resize handler
        window.addEventListener('resize', () => {
            if (NodeSystem.#expandedNode) {
                const node = document.getElementById(NodeSystem.#expandedNode);
                if (node) {
                    const canvas = node.querySelector('canvas');
                    if (canvas) {
                        const padding = 40;
                        canvas.width = window.innerWidth - padding * 2;
                        canvas.height = window.innerHeight - padding * 2;
                        
                        // Update WebGL viewport and uniforms
                        const nodeData = this.nodes.get(NodeSystem.#expandedNode);
                        if (nodeData && nodeData.data && nodeData.data.gl) {
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

    initializeShaderEditor() {
        const editorContainer = document.getElementById("editor");
        if (!editorContainer) {
            console.error("Editor container not found");
            return;
        }

        // Initialize with default shader code
        NodeSystem.#fragmentShader = this.getDefaultShaderCode();

        NodeSystem.#editor = CodeMirror(editorContainer, {
            value: NodeSystem.#fragmentShader,
            lineNumbers: true,
            mode: "x-shader/x-vertex",
            gutters: ["CodeMirror-lint-markers"],
            lint: true,
            lineWrapping: true
        });

        NodeSystem.#editor.on('change', () => {
            const code = NodeSystem.#editor.getValue();
            if (NodeSystem.#activeEditor === 'shader') {
                this.updateShader(code);
            } else if (NodeSystem.#activeEditor) {
                this.updateNodeCode(NodeSystem.#activeEditor, code);
            }
        });

        // Initial visibility
        this.updateEditorVisibility();

        // Setup escape key handler
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && NodeSystem.#isExpanded) {
                NodeSystem.#isExpanded = false;
                NodeSystem.#activeEditor = null;
                NodeSystem.#activeNodeId = null;
                this.updateEditorVisibility();
            }
        });
    }

    getDefaultNodeCode(type) {
        switch (type) {
            case 'webcam':
                return `// Webcam processing code
function processWebcamFrame(video) {
  // Add your webcam processing logic here
  // This function is called for each video frame
  console.log('Processing webcam frame:', video);
}`;
            case 'checkbox':
                return `// Checkbox grid processing code
function processCheckboxGrid(grid) {
  // Add your checkbox grid processing logic here
  // This function is called when checkboxes are updated
  const checkboxes = grid.querySelectorAll('input');
  checkboxes.forEach((checkbox, index) => {
    // Your custom logic here
    console.log('Checkbox', index, 'state:', checkbox.checked);
  });
}`;
            default:
                return '';
        }
    }

    updateNodeCode(nodeId, code) {
        const node = this.nodes.get(nodeId);
        if (!node) return;

        try {
            // Create a new Function to test if code is valid
            new Function(code);
            node.code = code;
            console.log(`Updated ${node.type} code successfully`);
        } catch (error) {
            console.error(`Error in ${node.type} code:`, error);
        }
    }

    createNode(type, x, y) {
        const id = `node-${Date.now()}`;
        const node = document.createElement('div');
        node.className = 'node';
        node.id = id;
        node.setAttribute('data-type', type);

        const defaultCode = type === 'webgl' ? this.getDefaultShaderCode() : this.getDefaultNodeCode(type);

        node.innerHTML = `
          <div class="node-header">
            <span>${type}</span>
            <div class="header-buttons">
              <button class="expand-button">Edit</button>
            </div>
          </div>
          <div class="node-content">
            ${type === 'webcam' ? '<video autoplay playsinline></video>' : ''}
            ${type === 'webgl' ? '<canvas></canvas>' : ''}
            ${type === 'checkbox' ? '<div class="checkbox-grid"></div>' : ''}
          </div>
          <div class="node-ports">
            <div class="input-port"></div>
            <div class="output-port"></div>
          </div>
        `;

        node.style.left = `${x}px`;
        node.style.top = `${y}px`;

        // Add canvas click handler for WebGL nodes
        if (type === 'webgl') {
            const canvas = node.querySelector('canvas');
            canvas.addEventListener('click', () => {
                this.toggleCanvasExpand(id);
            });
        }

        // Update edit button handler
        node.querySelector('.expand-button').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent canvas click from triggering
            this.toggleEditor(id, type);
        });

        this.container.appendChild(node);
        this.nodes.set(id, {
            type,
            element: node,
            data: null,
            code: defaultCode,
            lastWorkingCode: defaultCode
        });

        this.initializeNode(id, type);
        return id;
    }

    toggleEditor(nodeId, type) {
        NodeSystem.#isExpanded = !NodeSystem.#isExpanded;
        const editorContainer = document.getElementById('editor');
        
        if (NodeSystem.#isExpanded) {
            NodeSystem.#activeEditor = type === 'webgl' ? 'shader' : nodeId;
            NodeSystem.#activeNodeId = nodeId;
            
            const node = this.nodes.get(nodeId);
            if (type === 'webgl') {
                console.log('Setting editor content for WebGL node:', nodeId);
                // Force a refresh of the editor content
                setTimeout(() => {
                    NodeSystem.#editor.refresh();
                    NodeSystem.#editor.setValue(node.code || this.getDefaultShaderCode());
                    NodeSystem.#editor.focus();
                }, 0);
            } else {
                NodeSystem.#editor.setValue(node.code || this.getDefaultNodeCode(type));
            }
            NodeSystem.#editor.setOption('mode', type === 'webgl' ? 'x-shader/x-vertex' : 'javascript');
            
            const compileButton = document.getElementById('compile-button');
            if (!compileButton && type !== 'webgl') {
                this.createCompileButton();
            }
            if (compileButton) {
                compileButton.style.display = type === 'webgl' ? 'none' : 'block';
            }

            editorContainer.classList.add('transparent');
        } else {
            NodeSystem.#activeEditor = null;
            NodeSystem.#activeNodeId = null;
            editorContainer.classList.remove('transparent');
        }

        this.updateEditorVisibility();
    }

    createCompileButton() {
        const editorContainer = document.getElementById('editor');
        const compileButton = document.createElement('button');
        compileButton.id = 'compile-button';
        compileButton.textContent = 'Compile';
        compileButton.className = 'compile-button';
        
        compileButton.addEventListener('click', () => {
            if (NodeSystem.#activeEditor && NodeSystem.#activeEditor !== 'shader') {
                const code = NodeSystem.#editor.getValue();
                this.updateNodeCode(NodeSystem.#activeEditor, code);
            }
        });
        
        editorContainer.appendChild(compileButton);
    }

    updateEditorVisibility() {
        const editorElement = document.querySelector('.CodeMirror');
        const editorContainer = document.getElementById('editor');

        if (editorElement) {
            editorElement.style.display = NodeSystem.#isExpanded ? 'block' : 'none';
        }

        if (editorContainer) {
            editorContainer.classList.toggle('visible', NodeSystem.#isExpanded);
            editorContainer.style.zIndex = NodeSystem.#isExpanded ? '1000' : '-1';
        }
    }


    getDefaultShaderCode() {
      // Get a random shader from the array
      const randomIndex = Math.floor(Math.random() * fragmentShaders.length);
      return fragmentShaders[6];//randomIndex];
  }


    initializeNode(id, type) {
        const node = this.nodes.get(id);
        if (!node) return;

        switch (type) {
            case 'webcam':
                this.initializeWebcam(node);
                break;
            case 'webgl':
                this.initializeWebGL(node);
                this.updateShader(node,"");
                break;
            case 'checkbox':
                this.initializeCheckboxGrid(node);
                break;
        }
    }

    async initializeWebcam(node) {
        try {
            console.log('Requesting webcam access...');
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: 320,
                    height: 240
                }
            });

            const video = node.element.querySelector('video');
            video.srcObject = stream;

            // Show loading state
            const content = node.element.querySelector('.node-content');
            content.innerHTML = '<div class="loading">Initializing webcam...</div>';

            video.onloadedmetadata = () => {
                console.log('Webcam stream loaded');
                content.innerHTML = '';
                content.appendChild(video);
                node.data = video;
                video.play();
                this.processNode(node);
            };

            video.onerror = (err) => {
                console.error('Video element error:', err);
                content.innerHTML = `<div class="error">Video error: ${err.message}</div>`;
            };

        } catch (error) {
            console.error('Webcam initialization error:', error);
            let errorMessage = 'Failed to access webcam';

            if (error.name === 'NotAllowedError') {
                errorMessage = 'Webcam access denied. Please allow camera access.';
            } else if (error.name === 'NotFoundError') {
                errorMessage = 'No webcam found. Please connect a camera.';
            } else if (error.name === 'NotReadableError') {
                errorMessage = 'Webcam is already in use by another application.';
            }

            node.element.querySelector('.node-content').innerHTML =
                `<div class="error">${errorMessage}</div>`;
        }
    }

    initializeWebGL(node) {
        const content = node.element.querySelector('.node-content');
        const canvas = content.querySelector('canvas');
        if (!canvas) return;

        canvas.width = 320;
        canvas.height = 240;

        try {
            console.log('Initializing WebGL context for node:', node.element.id);
            const gl = canvas.getContext('webgl');

            if (!gl) {
                throw new Error('WebGL not supported');
            }

            // Create shader program
            const program = this.createShaderProgram(gl, node.code || this.getDefaultShaderCode());

            // Create buffers
            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
                -1, -1,  // Bottom left
                1, -1,   // Bottom right
                -1, 1,   // Top left
                1, 1     // Top right
            ]), gl.STATIC_DRAW);

            // Store WebGL context and program in node data
            node.data = {
                gl,
                program,
                buffer,
                canvas,
                positionLocation: gl.getAttribLocation(program, 'position'),
                textureLocation: gl.getUniformLocation(program, 'u_texture'),
                timeLocation: gl.getUniformLocation(program, 'u_time'),
                resolutionLocation: gl.getUniformLocation(program, 'u_resolution')
            };

            // Start animation loop
            this.startRenderLoop(node);

            console.log('WebGL initialization complete for node:', node.element.id);

        } catch (error) {
            console.error('WebGL initialization error:', error);
            content.innerHTML = `<div class="error">${error.message}</div>`;
        }
    }

    createShaderProgram(gl, fragmentCode) {
        // Create vertex shader with proper texture coordinates
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, `
            attribute vec2 position;
            varying vec2 texCoord;
            void main() {
                // Convert position to texture coordinates
                texCoord = position * 0.5 + 0.5;
                gl_Position = vec4(position, 0.0, 1.0);
            }
        `);
        gl.compileShader(vertexShader);

        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            throw new Error(`Vertex shader compilation failed: ${gl.getShaderInfoLog(vertexShader)}`);
        }

        // Create fragment shader
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fragmentCode);
        gl.compileShader(fragmentShader);

        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            throw new Error(`Fragment shader compilation failed: ${gl.getShaderInfoLog(fragmentShader)}`);
        }

        // Create and link program
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error(`Program linking failed: ${gl.getProgramInfoLog(program)}`);
        }

        return program;
    }

    startRenderLoop(node) {
        if (!node || !node.data) return;

        const render = () => {
            this.renderWebGLNode(node);
            node.animationFrame = requestAnimationFrame(render);
        };

        render();
    }

    renderWebGLNode(node) {
        if (!node || !node.data || !node.data.gl) return;

        const { gl, program, buffer, positionLocation, timeLocation, resolutionLocation } = node.data;
        const canvas = node.data.canvas;

        // Save current WebGL state
        const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
        const previousProgram = gl.getParameter(gl.CURRENT_PROGRAM);

        // If this node has input connections, render them first
        const inputConnections = Array.from(this.connections.values())
            .filter(conn => conn.to === node.element.id)
            .map(conn => this.nodes.get(conn.from))
            .filter(Boolean);

        inputConnections.forEach(inputNode => {
            this.renderWebGLNode(inputNode);
        });

        // Bind appropriate framebuffer
        if (node.data.frameBuffer) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, node.data.frameBuffer);
            console.log(`Rendering to framebuffer for node ${node.element.id}`);
        } else {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            console.log(`Rendering to screen for node ${node.element.id}`);
        }

        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(1.0, 0.0, 0.0, 1.0); // Clear to red for debugging
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);

        // Set up position attribute
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        // Set uniforms
        if (timeLocation !== null) {
            gl.uniform1f(timeLocation, performance.now() / 1000);
        }
        if (resolutionLocation !== null) {
            gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
        }

        // Call custom render function if it exists
        if (node.data.render) {
            node.data.render();
        }

        // Draw
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Debug: Check what was rendered
        const pixels = new Uint8Array(4);
        gl.readPixels(canvas.width/2, canvas.height/2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        console.log(`Content at center for node ${node.element.id}:`, pixels);

        // If this node has a framebuffer, copy the result to its texture
        if (node.data.frameBuffer && node.data.outputTexture) {
            gl.bindTexture(gl.TEXTURE_2D, node.data.outputTexture);
            gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, canvas.width, canvas.height, 0);
            
            // Debug: Verify texture content after copy
            gl.bindFramebuffer(gl.FRAMEBUFFER, node.data.frameBuffer);
            gl.readPixels(canvas.width/2, canvas.height/2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            console.log(`Texture content at center after copy for node ${node.element.id}:`, pixels);
        }

        // Restore previous WebGL state
        gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);
        gl.useProgram(previousProgram);
    }

    initializeCheckboxGrid(node) {
        const grid = node.element.querySelector('.checkbox-grid');
        const size = 32;
        for (let i = 0; i < size * size; i++) {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            grid.appendChild(checkbox);
        }
        grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
        node.data = grid;
    }

    updateNodePosition(id, x, y) {
        const node = this.nodes.get(id);
        if (!node) return;

        node.element.style.left = `${x}px`;
        node.element.style.top = `${y}px`;
        this.updateConnections();
    }

    processNode(sourceNode) {
        if (!sourceNode || !sourceNode.data) return;

        // Find connected nodes
        const connections = Array.from(this.connections.values())
            .filter(conn => conn.from === sourceNode.element.id)
            .map(conn => this.nodes.get(conn.to))
            .filter(Boolean);

        connections.forEach(targetNode => {
            if (targetNode.type === 'webgl' && sourceNode.type === 'webcam') {
                this.processWebGLNode(sourceNode, targetNode);
            } else if (targetNode.type === 'checkbox' && sourceNode.type === 'webgl') {
                this.processCheckboxNode(sourceNode, targetNode);
            }
        });

        // Continue processing in animation loop
        requestAnimationFrame(() => this.processNode(sourceNode));
    }

    processWebGLNode(webcamNode, webglNode) {
        try {
            const { gl, program, texture, canvas, positionLocation, textureLocation,
                    timeLocation, resolutionLocation, volLocation, dropLocation, midiLocation } = webglNode.data;
            const video = webcamNode.data;

            gl.useProgram(program);

            // Update texture with video frame
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

            // Set uniforms
            gl.uniform1i(textureLocation, 0);
            if (timeLocation) gl.uniform1f(timeLocation, performance.now() / 1000);
            if (resolutionLocation) gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
            if (volLocation) gl.uniform1f(volLocation, 1.0); // You can update this with actual volume
            if (dropLocation) gl.uniform1f(dropLocation, 0.5); // You can update this as needed
            if (midiLocation) gl.uniform1f(midiLocation, 0.0); // You can update this with MIDI data

            // Draw
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

            // Process any connected nodes (like checkbox)
            const checkboxConnections = Array.from(this.connections.values())
                .filter(conn => conn.from === webglNode.element.id)
                .map(conn => this.nodes.get(conn.to))
                .filter(node => node && node.type === 'checkbox');

            checkboxConnections.forEach(checkboxNode => {
                this.processCheckboxNode(webglNode, checkboxNode);
            });

        } catch (error) {
            console.error('WebGL processing error:', error);
            webglNode.element.querySelector('.node-content').innerHTML =
                `<div class="error">Processing error: ${error.message}</div>`;
        }
    }

    processCheckboxNode(webglNode, checkboxNode) {
        const { gl, canvas } = webglNode.data;
        const grid = checkboxNode.data;
        const checkboxes = grid.querySelectorAll('input');

        // Create a temporary canvas to read pixels from WebGL
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;

        // Copy WebGL canvas to temp canvas
        tempCtx.drawImage(canvas, 0, 0);
        const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height).data;

        // Calculate step sizes to sample the image
        const sampleWidth = Math.floor(canvas.width / 32);
        const sampleHeight = Math.floor(canvas.height / 32);

        checkboxes.forEach((checkbox, i) => {
            const gridX = i % 32;
            const gridY = Math.floor(i / 32);

            // Sample from the center of each grid cell
            const x = gridX * sampleWidth + Math.floor(sampleWidth / 2);
            const y = gridY * sampleHeight + Math.floor(sampleHeight / 2);

            // Get the pixel index in the image data array (RGBA format)
            const pixelIndex = (y * canvas.width + x) * 4;

            // Use the red channel since our WebGL shader outputs black/white
            const brightness = imageData[pixelIndex];

            // Update checkbox state - checked if dark, unchecked if bright
            checkbox.checked = brightness < 128;
        });
    }

    connect(fromId, toId) {
        const connectionId = `${fromId}-${toId}`;
        this.connections.set(connectionId, { from: fromId, to: toId });
        this.updateConnections();
    }

    updateConnections() {
        const svg = document.getElementById('connections');
        if (!svg) return;

        // Clear existing connections
        while (svg.firstChild) {
            svg.removeChild(svg.firstChild);
        }

        this.connections.forEach((connection, connectionId) => {
            const fromPos = this.getPortPosition(connection.from, 'output');
            const toPos = this.getPortPosition(connection.to, 'input');

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('class', 'connection-line');
            path.setAttribute('d', this.createConnectionPath(fromPos, toPos));
            path.setAttribute('data-connection-id', connectionId);
            
            svg.appendChild(path);

            // Update port visual states
            this.updatePortState(connection.from, 'output', true);
            this.updatePortState(connection.to, 'input', true);
        });
    }

    updatePortState(nodeId, portType, isConnected) {
        const node = document.getElementById(nodeId);
        const port = node.querySelector(`.${portType}-port`);
        port.classList.toggle('connected', isConnected);
    }

    createConnectionPath(from, to) {
        // Create a curved path between points
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const curve = Math.min(Math.abs(dx) / 2, 100); // Control point offset

        return `M ${from.x} ${from.y} 
                C ${from.x + curve} ${from.y},
                  ${to.x - curve} ${to.y},
                  ${to.x} ${to.y}`;
    }

    getPortPosition(nodeId, portType) {
        const node = document.getElementById(nodeId);
        const port = node.querySelector(`.${portType}-port`);
        const rect = port.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    }

    updateShader(fragmentCode) {
        if (!NodeSystem.#activeNodeId) {
            console.error('No active node ID found');
            return;
        }

        const node = this.nodes.get(NodeSystem.#activeNodeId);
        if (!node || !node.data || !node.data.gl) {
            console.error('Invalid node data for node:', NodeSystem.#activeNodeId);
            return;
        }

        const errors = this.checkShaderErrors(node.data.gl, fragmentCode);
        if (errors.length > 0) {
            console.log("Shader errors:", errors);
            return;
        }

        // Store old code for diff
        const oldCode = node.code || '';

        console.log("Shader updated successfully for node:", NodeSystem.#activeNodeId);
        node.code = fragmentCode;
        node.lastWorkingCode = fragmentCode;
        NodeSystem.#isDirty = true;
        this.updateShaderProgram(node);

        // Save diff if code actually changed
        if (oldCode !== fragmentCode && this.diffManager) {
            this.diffManager.saveDiff(NodeSystem.#activeNodeId, oldCode, fragmentCode);
        }
    }

    checkShaderErrors(gl, code) {
        const shader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(shader, code);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const infoLog = gl.getShaderInfoLog(shader);
            return infoLog.split('\n').filter(Boolean);
        }

        return [];
    }

    setupEventListeners() {
        // Modify your existing drag handling
        this.container.addEventListener('mousedown', (e) => {
            const node = e.target.closest('.node');
            if (!node) return;

            // Don't initiate drag if clicking canvas or if node is expanded
            if (e.target.tagName === 'CANVAS' || node.classList.contains('expanded')) {
                return;
            }

            this.draggedNode = node;
            const rect = node.getBoundingClientRect();
            this.dragOffset = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        });

        document.addEventListener('mousemove', (e) => {
            if (this.draggedNode) {
                const x = e.clientX - this.dragOffset.x;
                const y = e.clientY - this.dragOffset.y;
                this.updateNodePosition(this.draggedNode.id, x, y);
            }
        });

        document.addEventListener('mouseup', () => {
            this.draggedNode = null;
        });
    }

    setupConnectionEventListeners() {
        // Handle starting connection drag from output port
        document.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('output-port')) {
                const nodeId = e.target.closest('.node').id;
                this.startConnectionDrag(nodeId, e);
            }
        });

        // Handle dragging connection
        document.addEventListener('mousemove', (e) => {
            if (this.draggedConnection) {
                this.updateTempConnection(e);
            }
        });

        // Handle completing or canceling connection
        document.addEventListener('mouseup', (e) => {
            if (this.draggedConnection) {
                if (e.target.classList.contains('input-port')) {
                    const toNodeId = e.target.closest('.node').id;
                    this.completeConnection(this.draggedConnection.fromId, toNodeId);
                }
                this.cancelConnectionDrag();
            }
        });

        // Handle removing connections
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('connection-line')) {
                const connectionId = e.target.dataset.connectionId;
                this.removeConnection(connectionId);
            }
        });
    }

    startConnectionDrag(fromId, event) {
        this.draggedConnection = {
            fromId,
            fromPos: this.getPortPosition(fromId, 'output')
        };

        // Create temporary SVG connection line
        this.tempConnection = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.tempConnection.setAttribute('class', 'connection-line temp');
        this.tempConnection.setAttribute('stroke', '#666');
        this.tempConnection.setAttribute('stroke-width', '3');
        this.tempConnection.setAttribute('fill', 'none');
        this.tempConnection.setAttribute('fill-rule', 'evenodd');
        
        const svg = document.getElementById('connections');
        svg.appendChild(this.tempConnection);
    }

    updateTempConnection(event) {
        if (!this.tempConnection || !this.draggedConnection) return;

        const fromPos = this.draggedConnection.fromPos;
        const toPos = { x: event.clientX, y: event.clientY };
        
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
        // Check if connection already exists
        const connectionId = `${fromId}-${toId}`;
        if (this.connections.has(connectionId)) return;

        const fromNode = this.nodes.get(fromId);
        const toNode = this.nodes.get(toId);

        // Only allow connections between valid nodes
        if (!fromNode || !toNode) return;

        // Create the connection
        this.connect(fromId, toId);

        // If both are WebGL nodes, update the shader code
        if (fromNode.type === 'webgl' && toNode.type === 'webgl') {
            this.updateShaderConnection(fromNode, toNode);
        }
    }

    updateShaderConnection(fromNode, toNode) {
        const gl = toNode.data.gl;
        
        // Set up framebuffer and texture for source node
        if (!fromNode.data.frameBuffer) {
            console.log('Creating new framebuffer for source node:', fromNode.element.id);
            
            const frameBuffer = gl.createFramebuffer();
            const texture = gl.createTexture();
            
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 
                fromNode.data.canvas.width, 
                fromNode.data.canvas.height, 
                0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            
            gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
            
            const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
            console.log('Framebuffer status:', status === gl.FRAMEBUFFER_COMPLETE ? 'complete' : 'incomplete');
            
            fromNode.data.frameBuffer = frameBuffer;
            fromNode.data.outputTexture = texture;

            // Initial render to texture
            gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
            gl.viewport(0, 0, fromNode.data.canvas.width, fromNode.data.canvas.height);
            gl.clearColor(0.0, 1.0, 0.0, 1.0); // Clear to green for debugging
            gl.clear(gl.COLOR_BUFFER_BIT);
            
            // Debug: Check initial texture content
            const pixels = new Uint8Array(4);
            gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            console.log('Initial texture content for source node:', pixels);
            
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }

        // Keep the original shader code mostly intact, just add the texture uniform
        let shaderCode = toNode.code || this.getDefaultShaderCode();
        
        // Add texture uniform if it doesn't exist
        if (!shaderCode.includes('uniform sampler2D u_texture;')) {
            const textureUniform = 'uniform sampler2D u_texture;\n';
            // Add after other uniforms
            const lastUniformIndex = shaderCode.lastIndexOf('uniform');
            if (lastUniformIndex !== -1) {
                const endOfLine = shaderCode.indexOf(';', lastUniformIndex) + 1;
                shaderCode = shaderCode.slice(0, endOfLine) + '\n' + textureUniform + shaderCode.slice(endOfLine);
            } else {
                shaderCode = textureUniform + shaderCode;
            }
        }

        // Update the node's program
        toNode.code = shaderCode;
        const newProgram = this.createShaderProgram(gl, shaderCode);
        
        if (toNode.data.program) {
            gl.deleteProgram(toNode.data.program);
        }
        
        toNode.data.program = newProgram;
        toNode.data.positionLocation = gl.getAttribLocation(newProgram, 'position');
        toNode.data.textureLocation = gl.getUniformLocation(newProgram, 'u_texture');
        toNode.data.timeLocation = gl.getUniformLocation(newProgram, 'u_time');
        toNode.data.resolutionLocation = gl.getUniformLocation(newProgram, 'u_resolution');

        // Update render function
        toNode.data.render = () => {
            if (fromNode.data.outputTexture) {
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, fromNode.data.outputTexture);
                if (toNode.data.textureLocation !== null) {
                    gl.uniform1i(toNode.data.textureLocation, 0);
                }
                
                // Debug: verify texture content
                const pixels = new Uint8Array(4);
                gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                console.log('Source texture content at (0,0):', pixels);
            }
        };

        // Force immediate render of both nodes
        console.log('Forcing render of source node:', fromNode.element.id);
        this.renderWebGLNode(fromNode);
        console.log('Forcing render of target node:', toNode.element.id);
        this.renderWebGLNode(toNode);
    }

    removeConnection(connectionId) {
        const connection = this.connections.get(connectionId);
        if (connection) {
            this.connections.delete(connectionId);
            this.updateConnections();
            this.stopNodeProcessing(connection.from, connection.to);
        }
    }

    hasConnection(fromId, toId) {
        const connectionId = `${fromId}-${toId}`;
        return this.connections.has(connectionId);
    }

    setupHotkeys() {
        document.addEventListener('keydown', (e) => {
            // Prevent hotkey handling when typing in editor
            if (e.target.closest('.CodeMirror')) return;

            // Add node hotkeys
            if (e.key === '1') {
                this.createNode('webcam', 100, 100);
            } else if (e.key === '2') {
                this.createNode('webgl', 300, 100);
            } else if (e.key === '3') {
                this.createNode('checkbox', 500, 100);
            }

            // Delete node hotkey
            if (e.key === 'Delete' || e.key === 'Backspace') {
                // Add node deletion logic here if needed
            }
        });
    }

    createWebGLButton() {
        const button = document.createElement('button');
        button.textContent = 'Add WebGL Node';
        button.className = 'webgl-button';
        button.addEventListener('click', () => {
            // Generate random position within viewport
            const x = Math.random() * (window.innerWidth - 320);  // 320 is node width
            const y = Math.random() * (window.innerHeight - 240); // 240 is node height
            this.createNode('webgl', x, y);
        });
        
        const container = document.getElementById('node-container');
        if (container) {
            container.appendChild(button);
        }

        // Add diff visualization button
       // this.diffManager.createVisualizationButton();
    }

    updateShaderProgram(node) {
        if (!node || !node.data || !node.data.gl) return;

        const { gl } = node.data;

        try {
            // Create new fragment shader
            const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
            gl.shaderSource(fragmentShader, node.code);
            gl.compileShader(fragmentShader);

            if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
                throw new Error(`Fragment shader compilation failed: ${gl.getShaderInfoLog(fragmentShader)}`);
            }

            // Create vertex shader
            const vertexShader = gl.createShader(gl.VERTEX_SHADER);
            gl.shaderSource(vertexShader, `
                attribute vec2 position;
                varying vec2 texCoord;
                void main() {
                    texCoord = vec2(position.x * 0.5 + 0.5, position.y * -0.5 + 0.5);
                    gl_Position = vec4(position, 0.0, 1.0);
                }
            `);
            gl.compileShader(vertexShader);

            if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
                throw new Error(`Vertex shader compilation failed: ${gl.getShaderInfoLog(vertexShader)}`);
            }

            // Create and link new program
            const newProgram = gl.createProgram();
            gl.attachShader(newProgram, vertexShader);
            gl.attachShader(newProgram, fragmentShader);
            gl.linkProgram(newProgram);

            if (!gl.getProgramParameter(newProgram, gl.LINK_STATUS)) {
                throw new Error(`Program linking failed: ${gl.getProgramInfoLog(newProgram)}`);
            }

            // Delete old program and update node data with new program
            if (node.data.program) {
                gl.deleteProgram(node.data.program);
            }
            node.data.program = newProgram;

            // Update attribute and uniform locations
            node.data.positionLocation = gl.getAttribLocation(newProgram, 'position');
            node.data.textureLocation = gl.getUniformLocation(newProgram, 'texture');
            node.data.timeLocation = gl.getUniformLocation(newProgram, 'u_time');
            node.data.resolutionLocation = gl.getUniformLocation(newProgram, 'u_resolution');
            node.data.volLocation = gl.getUniformLocation(newProgram, 'u_vol');
            node.data.dropLocation = gl.getUniformLocation(newProgram, 'drop');
            node.data.midiLocation = gl.getUniformLocation(newProgram, 'midi');

            // Initial render with new program
            this.renderWebGLNode(node);

            console.log("Shader program updated successfully for node:", node.element.id);
        } catch (error) {
            console.error('Error updating shader program:', error);
            // Revert to last working code if available
            if (node.lastWorkingCode) {
                node.code = node.lastWorkingCode;
            }
        }
    }

    toggleCanvasExpand(nodeId) {
        const node = document.getElementById(nodeId);
        const isExpanded = node.classList.contains('expanded');
        const canvas = node.querySelector('canvas');
        
        // Reset previous expanded node if exists
        if (NodeSystem.#expandedNode && NodeSystem.#expandedNode !== nodeId) {
            const prevNode = document.getElementById(NodeSystem.#expandedNode);
            if (prevNode) {
                prevNode.classList.remove('expanded');
                const prevCanvas = prevNode.querySelector('canvas');
                if (prevCanvas) {
                    prevCanvas.width = 320;  // Reset to original size
                    prevCanvas.height = 240;
                }
            }
        }

        if (!isExpanded) {
            node.classList.add('expanded');
            NodeSystem.#expandedNode = nodeId;
            
            // Resize canvas to window size with some padding
            if (canvas) {
                const padding = 40; // Account for padding and header
                canvas.width = window.innerWidth - padding * 2;
                canvas.height = window.innerHeight - padding * 2;
                
                // Update WebGL viewport and uniforms
                const nodeData = this.nodes.get(nodeId);
                if (nodeData && nodeData.data && nodeData.data.gl) {
                    const gl = nodeData.data.gl;
                    gl.viewport(0, 0, canvas.width, canvas.height);
                    if (nodeData.data.resolutionLocation) {
                        gl.uniform2f(nodeData.data.resolutionLocation, canvas.width, canvas.height);
                    }
                }
            }
        } else {
            node.classList.remove('expanded');
            NodeSystem.#expandedNode = null;
            
            // Reset canvas to original size
            if (canvas) {
                canvas.width = 320;
                canvas.height = 240;
                
                // Update WebGL viewport and uniforms
                const nodeData = this.nodes.get(nodeId);
                if (nodeData && nodeData.data && nodeData.data.gl) {
                    const gl = nodeData.data.gl;
                    gl.viewport(0, 0, canvas.width, canvas.height);
                    if (nodeData.data.resolutionLocation) {
                        gl.uniform2f(nodeData.data.resolutionLocation, canvas.width, canvas.height);
                    }
                }
            }
        }
    }
}

// Export the class
export default NodeSystem;