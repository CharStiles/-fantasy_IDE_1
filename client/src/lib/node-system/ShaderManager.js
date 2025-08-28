import { fragmentShaders } from '../defaultShaders.js';

class ShaderManager {
    constructor(nodeSystem) {
        this.nodeSystem = nodeSystem;
        //random shader
        this.defaultShaderCode = fragmentShaders[Math.floor(Math.random() * fragmentShaders.length)];
        this.initAudio();
        
        // Add mouse tracking with initial values
        this.mouseX = window.innerWidth / 2;
        this.mouseY = window.innerHeight / 2;
        
        // Update mouse position with proper bounds checking
        document.addEventListener('mousemove', (e) => {
            this.mouseX = Math.max(0, Math.min(window.innerWidth, e.clientX));
            this.mouseY = Math.max(0, Math.min(window.innerHeight, e.clientY));
        });
    }

    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyzer = this.audioContext.createAnalyser();
            this.analyzer.fftSize = 128; // This will give us 64 data points
            
            // Create audio input
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    // Resume audio context if suspended
                    if (this.audioContext.state === 'suspended') {
                        this.audioContext.resume();
                    }
                    
                    const source = this.audioContext.createMediaStreamSource(stream);
                    source.connect(this.analyzer);
                    console.log('Audio analyzer initialized successfully');
                    console.log('Audio context state:', this.audioContext.state);
                    console.log('Analyzer frequency bin count:', this.analyzer.frequencyBinCount);
                })
                .catch(err => {
                    console.error('Error accessing microphone:', err);
                    // Create a fallback analyzer with dummy data
                    this.createFallbackAudio();
                });
        } catch (err) {
            console.error('Error initializing audio context:', err);
            // Create a fallback analyzer with dummy data
            this.createFallbackAudio();
        }
    }

    createFallbackAudio() {
        console.log('Creating fallback audio analyzer');
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyzer = this.audioContext.createAnalyser();
            this.analyzer.fftSize = 128;
            console.log('Fallback audio analyzer created');
        } catch (err) {
            console.error('Failed to create fallback audio:', err);
        }
    }

    initializeWebGL(node) {
        this.defaultShaderCode = fragmentShaders[Math.floor(Math.random() * fragmentShaders.length)];

        console.log('Initializing WebGL for node:', node.id);
        const content = node.querySelector('.node-content');
        const canvas = content.querySelector('canvas');
        if (!canvas) {
            console.error('No canvas found');
            return;
        }

        // Set back to original size
        canvas.width = 320;
        canvas.height = 240;
        canvas.style.width = '320px';
        canvas.style.height = '240px';

        const gl = canvas.getContext('webgl');
        if (!gl) {
            console.error('WebGL context creation failed');
            return;
        }

        // Store node data first
        const nodeData = this.nodeSystem.nodes.get(node.id);
        if (!nodeData) {
            console.error('No node data found');
            return;
        }

        // Add click handler for expanding
        node.addEventListener('click', (e) => {
            // Don't trigger on edit button, header buttons, or header area click
            if (e.target.closest('.header-buttons') || e.target.closest('.node-header')) return;
            
            const isExpanded = node.classList.contains('expanded');
            if (!isExpanded) {
                node.classList.add('expanded');
                // Wait for animation to complete before resizing
                setTimeout(() => {
                    this.resizeCanvas(node.id, window.innerWidth - 40, window.innerHeight - 40);
                }, 300);
            } else {
                node.classList.remove('expanded');
                this.resizeCanvas(node.id, 320, 240);
            }
        });

        // Add specific handler for edit button
        const editButton = node.querySelector('.expand-button');
        if (editButton) {
            editButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent node expansion
                this.nodeSystem.editorManager.toggleEditor(node.id, 'webgl');
            });
        }

        // Create initial program
        const program = this.createShaderProgram(gl, this.defaultShaderCode);
        if (!program) return;

        // Create buffer
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1,
            1, -1,
            -1, 1,
            1, 1,
        ]), gl.STATIC_DRAW);

        // Get locations
        const positionLocation = gl.getAttribLocation(program, 'position');
        const timeLocation = gl.getUniformLocation(program, 'u_time');
        const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');

        // Create framebuffers for ping-pong rendering
        const fb1 = gl.createFramebuffer();
        const tex1 = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb1);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex1, 0);

        const fb2 = gl.createFramebuffer();
        const tex2 = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex2);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb2);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex2, 0);

        // Get uniform locations
        const prevFrameLocation = gl.getUniformLocation(program, 'u_prevFrame');
        const mouseLocation = gl.getUniformLocation(program, 'u_mouse');
        
        // Store WebGL context and program
        nodeData.data = {
            gl,
            program,
            positionBuffer,
            positionLocation,
            timeLocation,
            resolutionLocation,
            startTime: performance.now(),
            connectedNodes: new Set(),  // Add this to track connections
            framebuffers: { fb1, fb2 },
            textures: { tex1, tex2 },
            currentFb: fb1,
            currentTex: tex1,
            prevFb: fb2,
            prevTex: tex2,
            prevFrameLocation,
            mouseLocation
        };
        nodeData.code = this.defaultShaderCode;

        // Initial setup
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        // Add spectrum uniform
        const spectrumLocation = gl.getUniformLocation(program, 'u_spectrum');
        nodeData.uniforms = {
            ...nodeData.uniforms,
            u_spectrum: spectrumLocation
        };

        // Modify render loop
        const render = () => {
            if (!nodeData.data || !nodeData.data.program) return;

            // Swap framebuffers
            const temp = nodeData.data.currentFb;
            nodeData.data.currentFb = nodeData.data.prevFb;
            nodeData.data.prevFb = temp;
            const tempTex = nodeData.data.currentTex;
            nodeData.data.currentTex = nodeData.data.prevTex;
            nodeData.data.prevTex = tempTex;

            // First pass: render to framebuffer
            gl.bindFramebuffer(gl.FRAMEBUFFER, nodeData.data.currentFb);
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.useProgram(nodeData.data.program);

            // Set up vertex attributes
            gl.bindBuffer(gl.ARRAY_BUFFER, nodeData.data.positionBuffer);
            gl.enableVertexAttribArray(nodeData.data.positionLocation);
            gl.vertexAttribPointer(nodeData.data.positionLocation, 2, gl.FLOAT, false, 0, 0);

            // Bind previous frame texture
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, nodeData.data.prevTex);
            if (nodeData.data.prevFrameLocation !== null) {
                gl.uniform1i(nodeData.data.prevFrameLocation, 0);
            }

            // Update mouse uniform with proper scaling and offset
            if (nodeData.data.mouseLocation !== null) {
                const rect = canvas.getBoundingClientRect();
                const mouseX = (this.mouseX - rect.left) / rect.width;
                const mouseY = 1.0 - (this.mouseY - rect.top) / rect.height;
                
                // Clamp values between 0 and 1
                const clampedX = Math.max(0, Math.min(1, mouseX));
                const clampedY = Math.max(0, Math.min(1, mouseY));
                
                gl.uniform2f(nodeData.data.mouseLocation, clampedX, clampedY);
                // console.log('Mouse position:', clampedX, clampedY); // Debug output
            }

            // Update other uniforms
            if (nodeData.data.timeLocation !== null) {
                const time = (performance.now() - nodeData.data.startTime) / 1000;
                gl.uniform1f(nodeData.data.timeLocation, time);
            }
            if (nodeData.data.resolutionLocation !== null) {
                gl.uniform2f(nodeData.data.resolutionLocation, canvas.width, canvas.height);
            }

            // Update spectrum data if available
            if (nodeData.uniforms && nodeData.uniforms.u_spectrum && this.analyzer) {
                const dataArray = new Uint8Array(this.analyzer.frequencyBinCount);
                this.analyzer.getByteFrequencyData(dataArray);
                
                const bass = this.getAverageVolume(dataArray, 0, 4);
                const lowMid = this.getAverageVolume(dataArray, 4, 10);
                const highMid = this.getAverageVolume(dataArray, 10, 20);
                const treble = this.getAverageVolume(dataArray, 20, 64);
                
                gl.uniform4f(nodeData.uniforms.u_spectrum, bass, lowMid, highMid, treble);
            }

            // Draw to framebuffer
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

            // Second pass: render to screen
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.useProgram(nodeData.data.program);
            
            // Use the result from the first pass
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, nodeData.data.currentTex);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

            // Check for connected nodes after each render
            const connections = Array.from(this.nodeSystem.connectionManager.connections.values())
                .filter(conn => conn.from === node.id);

            connections.forEach(connection => {
                const targetNode = document.getElementById(connection.to);
                if (targetNode) {
                    console.log('Updating connected node:', connection.to);
                    this.updateCheckboxGrid(gl, targetNode);
                }
            });

            nodeData.data.animationFrame = requestAnimationFrame(render);
        };

        render();
    }

    // Helper function to calculate average volume for a frequency range
    getAverageVolume(dataArray, startIndex, endIndex) {
        let sum = 0;
        for (let i = startIndex; i < endIndex; i++) {
            sum += dataArray[i];
        }
        return (sum / (endIndex - startIndex)) / 255.0;
    }

    resizeCanvas(nodeId, width, height) {
        const nodeData = this.nodeSystem.nodes.get(nodeId);
        if (!nodeData || !nodeData.data || !nodeData.data.gl) return;

        const gl = nodeData.data.gl;
        const canvas = gl.canvas;
        
        // Update canvas dimensions
        canvas.width = width;
        canvas.height = height;
        
        // Update canvas style
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        
        // Update WebGL viewport
        gl.viewport(0, 0, width, height);
        
        // Update resolution uniform if it exists
        if (nodeData.data.resolutionLocation) {
            gl.useProgram(nodeData.data.program);
            gl.uniform2f(nodeData.data.resolutionLocation, width, height);
        }

        // Resize framebuffer textures
        const { tex1, tex2 } = nodeData.data.textures;
        
        // Resize texture 1
        gl.bindTexture(gl.TEXTURE_2D, tex1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        
        // Resize texture 2
        gl.bindTexture(gl.TEXTURE_2D, tex2);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        console.log('Resized canvas and framebuffers to:', width, height);
    }

    createShaderProgram(gl, shaderCode) {
        // Create vertex shader
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, `
            attribute vec2 position;
            void main() {
                gl_Position = vec4(position, 0.0, 1.0);
            }
        `);
        gl.compileShader(vertexShader);

        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            console.error('Vertex shader compilation failed:', gl.getShaderInfoLog(vertexShader));
            return null;
        }

        // Create fragment shader
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, shaderCode);
        gl.compileShader(fragmentShader);

        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            console.error('Fragment shader compilation failed:', gl.getShaderInfoLog(fragmentShader));
            return null;
        }

        // Create program
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program linking failed:', gl.getProgramInfoLog(program));
            return null;
        }

        // Clean up shaders
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);

        // Initialize uniforms
        gl.useProgram(program);
        const mouseLocation = gl.getUniformLocation(program, 'u_mouse');
        if (mouseLocation) {
            gl.uniform2f(mouseLocation, 0.5, 0.5); // Set initial mouse position to center
        }

        return program;
    }

    async updateShader(nodeId, code) {
        console.log('Updating shader for node:', nodeId);
        const nodeData = this.nodeSystem.nodes.get(nodeId);
        if (!nodeData || !nodeData.data || !nodeData.data.gl) {
            console.error('No node data found for shader update');
            return;
        }

        const { gl } = nodeData.data;
        console.log('Creating new shader program with code:', code);
        
        // Store old code for diff
        const oldCode = nodeData.code || '';
        
        // Create new program
        const newProgram = this.createShaderProgram(gl, code);
        if (!newProgram) {
            console.error('Failed to create new shader program');
            return;
        }

        // Get new locations
        const positionLocation = gl.getAttribLocation(newProgram, 'position');
        const timeLocation = gl.getUniformLocation(newProgram, 'u_time');
        const resolutionLocation = gl.getUniformLocation(newProgram, 'u_resolution');
        const mouseLocation = gl.getUniformLocation(newProgram, 'u_mouse');
        const prevFrameLocation = gl.getUniformLocation(newProgram, 'u_prevFrame');
        const webcamLocation = gl.getUniformLocation(newProgram, 'u_webcam');

        // Only after successful creation, update the node data
        const oldProgram = nodeData.data.program;
        nodeData.data.program = newProgram;
        nodeData.data.positionLocation = positionLocation;
        nodeData.data.timeLocation = timeLocation;
        nodeData.data.resolutionLocation = resolutionLocation;
        nodeData.data.mouseLocation = mouseLocation;
        nodeData.data.prevFrameLocation = prevFrameLocation;
        
        // Preserve webcam connection if it exists
        if (webcamLocation !== null) {
            gl.useProgram(newProgram);
            gl.uniform1i(webcamLocation, 2);
            nodeData.data.webcamLocation = webcamLocation;
        }
        
        nodeData.code = code;

        console.log('Shader updated successfully');

        // Capture the canvas immediately after successful shader update
        console.log('Checking capture condition in shader manager:', {
            hasDiffManager: !!this.nodeSystem.diffManager,
            pendingCaptureNodeId: this.nodeSystem.diffManager?.pendingCaptureNodeId,
            currentNodeId: nodeId,
            shouldCapture: this.nodeSystem.diffManager && this.nodeSystem.diffManager.pendingCaptureNodeId === nodeId
        });
        
        if (this.nodeSystem.diffManager && this.nodeSystem.diffManager.pendingCaptureNodeId === nodeId) {
            console.log('Capturing canvas after successful shader update for node:', nodeId);
            try {
                // Get the canvas
                const canvas = document.getElementById(nodeId)?.querySelector('canvas');
                if (canvas) {
                    // Force a render with the new shader
                    gl.useProgram(newProgram);
                    gl.viewport(0, 0, canvas.width, canvas.height);
                    gl.clearColor(0.0, 0.0, 0.0, 1.0);
                    gl.clear(gl.COLOR_BUFFER_BIT);
                    
                    // Set up basic uniforms if they exist
                    if (timeLocation !== null) {
                        gl.uniform1f(timeLocation, performance.now() / 1000);
                    }
                    if (resolutionLocation !== null) {
                        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
                    }
                    
                    // Draw a full-screen quad
                    const positions = new Float32Array([
                        -1, -1,
                         1, -1,
                        -1,  1,
                         1,  1
                    ]);
                    
                    const positionBuffer = gl.createBuffer();
                    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
                    
                    if (positionLocation !== -1) {
                        gl.enableVertexAttribArray(positionLocation);
                        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
                    }
                    
                    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                    
                    // Capture immediately after drawing
                    const imageBitmap = await createImageBitmap(canvas);
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = canvas.width;
                    tempCanvas.height = canvas.height;
                    const tempCtx = tempCanvas.getContext('2d');
                    
                    // Fill with white background
                    tempCtx.fillStyle = 'white';
                    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                    
                    // Draw the image bitmap
                    tempCtx.drawImage(imageBitmap, 0, 0);
                    
                    const dataURL = tempCanvas.toDataURL('image/png', 0.8);
                    const base64Data = dataURL.split(',')[1];
                    
                    this.nodeSystem.diffManager.capturedImageData = {
                        image: base64Data,
                        type: 'image/png',
                        width: canvas.width,
                        height: canvas.height
                    };
                    
                    console.log('Canvas captured after shader update successfully');
                    this.nodeSystem.diffManager.pendingCaptureNodeId = null; // Clear the pending capture
                }
            } catch (e) {
                console.log('Canvas capture after shader update failed:', e);
            }
        }

        // Save diff if code actually changed
        if (oldCode !== code && this.nodeSystem.diffManager) {
            this.nodeSystem.diffManager.saveDiff(nodeId, oldCode, code);
        }

        // Clean up old program after setting the new one
        if (oldProgram) {
            gl.deleteProgram(oldProgram);
        }
    }

    createWebGLButton() {
        const button = document.createElement('button');
        button.textContent = 'Add WebGL Node';
        button.addEventListener('click', () => {
            this.nodeSystem.createNode('webgl', 50, 50);
        });
        document.getElementById('toolbar').appendChild(button);

        // Add HDMI capture button
        const hdmiButton = document.createElement('button');
        hdmiButton.textContent = 'Add HDMI Input';
        hdmiButton.addEventListener('click', () => {
            this.nodeSystem.createNode('hdmi', 50, 50);
        });
        document.getElementById('toolbar').appendChild(hdmiButton);
    }

    updateShaderConnection(fromNode, toNode) {
        console.log('Setting up shader connection between:', fromNode.id, 'and', toNode.id);
        
        const fromNodeData = this.nodeSystem.nodes.get(fromNode.id);
        const toNodeData = this.nodeSystem.nodes.get(toNode.id);
        
        if (!fromNodeData || !toNodeData) return;

        if (fromNodeData.type === 'webcam' && toNodeData.type === 'webgl') {
            const gl = toNodeData.data.gl;
            // For webcam nodes, get video element directly from DOM
            const video = fromNode.querySelector('video');
            
            if (!video) {
                console.error('No video element found in webcam node');
                return;
            }

            // Create and setup texture
            const texture = gl.createTexture();
            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

            // Get the current shader code
            let shaderCode = toNodeData.code;
            if (!shaderCode.includes('uniform sampler2D u_webcam;')) {
                const uniformIndex = shaderCode.lastIndexOf('uniform');
                const insertPosition = uniformIndex !== -1 ? 
                    shaderCode.indexOf(';', uniformIndex) + 1 : 
                    shaderCode.indexOf('void main()');
                
                const webcamUniform = '\nuniform sampler2D u_webcam;\n//vec4 s = texture2D(u_webcam,  vec2(gl_FragCoord.x/u_resolution.x  * (u_resolution.y/u_resolution.x) ,1.-(gl_FragCoord.y/u_resolution.y)));';
                shaderCode = shaderCode.slice(0, insertPosition) + 
                           webcamUniform +
                           shaderCode.slice(insertPosition);
            }
            
            this.updateShader(toNode.id, shaderCode);

            // Get the new program
            const program = toNodeData.data.program;
            gl.useProgram(program);

            // Get uniform location
            const webcamLocation = gl.getUniformLocation(program, 'u_webcam');
            console.log('Webcam uniform location:', webcamLocation);
            gl.uniform1i(webcamLocation, 2);  // Use texture unit 2

            // Update texture in render loop
            const updateTexture = () => {
                if (video.readyState >= video.HAVE_CURRENT_DATA) {
                    console.log('Updating texture with video frame');
                    gl.activeTexture(gl.TEXTURE2);
                    gl.bindTexture(gl.TEXTURE_2D, texture);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
                }
                requestAnimationFrame(updateTexture);
            };
            updateTexture();

            console.log('Webcam setup complete');
        } else if (fromNodeData.type === 'hdmi' && toNodeData.type === 'webgl') {
            const gl = toNodeData.data.gl;
            const video = fromNodeData.data.video;
            
            console.log('Setting up HDMI connection');
            console.log('Video element:', video);
            console.log('Video ready state:', video.readyState);

            // Create and setup texture for HDMI
            const texture = gl.createTexture();
            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

            // Get the current shader code
            let shaderCode = toNodeData.code;
            if (!shaderCode.includes('uniform sampler2D u_webcam;')) {
                const uniformIndex = shaderCode.lastIndexOf('uniform');
                const insertPosition = uniformIndex !== -1 ? 
                    shaderCode.indexOf(';', uniformIndex) + 1 : 
                    shaderCode.indexOf('void main()');
                
                const webcamUniform = '\nuniform sampler2D u_webcam;\n// vec4 s = texture2D(u_webcam, normCoord);';
                shaderCode = shaderCode.slice(0, insertPosition) + 
                           webcamUniform +
                           shaderCode.slice(insertPosition);
            }
            
            this.updateShader(toNode.id, shaderCode);

            // Get the new program
            const program = toNodeData.data.program;
            gl.useProgram(program);

            // Get uniform location
            const webcamLocation = gl.getUniformLocation(program, 'u_webcam');
            console.log('HDMI uniform location:', webcamLocation);
            gl.uniform1i(webcamLocation, 2);  // Use texture unit 2

            // Update texture in render loop
            const updateTexture = () => {
                if (video.readyState >= video.HAVE_CURRENT_DATA) {
                    console.log('Updating texture with HDMI frame');
                    gl.activeTexture(gl.TEXTURE2);
                    gl.bindTexture(gl.TEXTURE_2D, texture);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
                }
                requestAnimationFrame(updateTexture);
            };
            updateTexture();

            console.log('HDMI setup complete');
        }
    }

    updateCheckboxGrid(gl, targetNode) {
        const grid = targetNode.querySelector('.checkbox-grid');
        if (!grid) return;
        
        const checkboxes = grid.querySelectorAll('input');
        if (checkboxes.length === 0) return;

        // Create a temporary canvas for scaling
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = 32;
        tempCanvas.height = 32;

        // Draw the WebGL canvas to temp canvas, scaling it down
        tempCtx.drawImage(gl.canvas, 0, 0, gl.canvas.width, gl.canvas.height, 0, 0, 32, 32);
        
        // Read the scaled pixels
        const imageData = tempCtx.getImageData(0, 0, 32, 32).data;

        // Update checkboxes based on scaled pixel data
        checkboxes.forEach((checkbox, i) => {
            const r = imageData[i * 4];
            const g = imageData[i * 4 + 1];
            const b = imageData[i * 4 + 2];
            const brightness = (r + g + b) / 3;
            checkbox.checked = brightness < 127;
        });
    }

    async initializeWebcam(node) {
        try {
            // Add source selection button
            const header = node.querySelector('.node-header');
            const switchButton = document.createElement('button');
            switchButton.textContent = '📹';
            switchButton.className = 'switch-camera';
            switchButton.style.marginLeft = '5px';
            switchButton.onclick = () => this.switchWebcamSource(node);
            header.appendChild(switchButton);

            // Initial random source selection
            await this.switchWebcamSource(node);

        } catch (err) {
            console.error('Error initializing webcam:', err);
            this.startWebcam(node);
        }
    }

    async switchWebcamSource(node) {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            if (videoDevices.length === 0) {
                console.log('No video devices found, using default');
                return this.startWebcam(node);
            }

            // Pick a random video device
            const randomDevice = videoDevices[Math.floor(Math.random() * videoDevices.length)];
            console.log('Selected random video device:', randomDevice.label);

            // Stop existing stream if any
            const video = node.querySelector('video');
            if (video && video.srcObject) {
                const tracks = video.srcObject.getTracks();
                tracks.forEach(track => track.stop());
            }

            // Request HD resolution with high framerate
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: { exact: randomDevice.deviceId },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    frameRate: { ideal: 60 }
                }
            });

            if (video) {
                video.srcObject = stream;
                video.play()
                    .then(() => {
                        console.log(`Video dimensions: ${video.videoWidth}x${video.videoHeight}`);
                    });
            }

        } catch (err) {
            console.error('Error switching webcam:', err);
            this.startWebcam(node);
        }
    }

    // Update fallback method to also request HD
    async startWebcam(node) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    frameRate: { ideal: 60 }
                }
            });
            const video = node.querySelector('video');
            if (video) {
                video.srcObject = stream;
                video.play()
                    .then(() => {
                        console.log(`Default camera dimensions: ${video.videoWidth}x${video.videoHeight}`);
                    });
            }
        } catch (err) {
            console.error('Error starting webcam:', err);
        }
    }

    initializeHDMI(node) {
        console.log('Initializing HDMI capture...');
        const video = node.querySelector('video');
        if (!video) {
            console.error('No video element found');
            return;
        }

        // Set HD resolution
        video.width = 1920;
        video.height = 1080;

        // Add autoplay and playsinline attributes
        video.autoplay = true;
        video.playsinline = true;
        video.muted = true;

        // Request HDMI capture with HD constraints
        navigator.mediaDevices.getDisplayMedia({
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 60 }
            }
        })
        .then(stream => {
            console.log('HD HDMI stream acquired');
            video.srcObject = stream;
            
            // Make sure video plays
            video.play()
                .then(() => {
                    console.log('HD Video playback started');
                    console.log(`Actual video dimensions: ${video.videoWidth}x${video.videoHeight}`);
                })
                .catch(e => console.error('Error playing video:', e));

            const nodeData = this.nodeSystem.nodes.get(node.id);
            if (nodeData) {
                nodeData.data = { stream, video };
                console.log('HDMI data stored in node:', nodeData);
            }
        })
        .catch(err => {
            console.error('Error accessing HDMI:', err);
            node.querySelector('.node-content').innerHTML = `
                <div style="color: red; padding: 10px;">
                    HDMI access failed: ${err.message}
                </div>
            `;
        });
    }

    // Update the default shader code to make mouse interaction more obvious
    getDefaultShaderCode() {
        return `
            precision mediump float;
            
            uniform float u_time;
            uniform vec2 u_resolution;
            uniform vec2 u_mouse;
            uniform sampler2D u_prevFrame;
            uniform vec4 u_spectrum;

            void main() {
                vec2 uv = gl_FragCoord.xy / u_resolution;
                
                // Make mouse effect more visible
                float mouseDist = distance(uv, u_mouse);
                float mouseGlow = 0.1 / (mouseDist + 0.01); // Stronger glow effect
                
                // Get previous frame
                vec4 prevColor = texture2D(u_prevFrame, uv);
                
                // Create base color with time animation
                vec3 color = vec3(
                    sin(uv.x * 10.0 + u_time) * 0.5 + 0.5,
                    cos(uv.y * 10.0 + u_time) * 0.5 + 0.5,
                    sin(u_time) * 0.5 + 0.5
                );
                
                // Add stronger mouse interaction
                vec3 mouseColor = vec3(1.0, 0.2, 0.0) * mouseGlow; // Bright orange glow
                color = mix(color, mouseColor, smoothstep(0.2, 0.0, mouseDist));
                
                // Mix with previous frame for trail effect
                color = mix(color, prevColor.rgb, 0.85);
                
                // Add audio reactive elements
                color += u_spectrum.xyz * 0.1;
                
                gl_FragColor = vec4(color, 1.0);
            }
        `;
    }
}

// export default ShaderManager; 
export default ShaderManager; 