import { fragmentShaders } from '../defaultShaders.js';

// Utility function to capture canvas screenshot
async function captureCanvasScreenshot(nodeId) {
    const nodeElement = document.getElementById(nodeId);
    if (!nodeElement) {
        console.warn('Node element not found for screenshot:', nodeId);
        return null;
    }

    // Try to find canvas in the node
    const canvas = nodeElement.querySelector('canvas');
    if (!canvas) {
        console.warn('No canvas found in node for screenshot:', nodeId);
        return null;
    }

    // Debug canvas information
    console.log('Canvas debug info:', {
        nodeId,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        styleWidth: canvas.style.width,
        styleHeight: canvas.style.height,
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight
    });

    try {
        // Ensure canvas has content
        if (canvas.width === 0 || canvas.height === 0) {
            console.warn('Canvas has zero dimensions, skipping screenshot');
            return null;
        }

        // Check context type
        const webglContext = canvas.getContext('webgl') || canvas.getContext('webgl2');
        console.log('Canvas context types:', {
            hasWebGL: !!webglContext,
            webglDrawingBufferWidth: webglContext ? webglContext.drawingBufferWidth : 'N/A',
            webglDrawingBufferHeight: webglContext ? webglContext.drawingBufferHeight : 'N/A',
            preserveDrawingBuffer: webglContext ? webglContext.getContextAttributes().preserveDrawingBuffer : 'N/A'
        });

        // Wait for rendering to complete
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Simple delay to let any existing rendering complete
        await new Promise(resolve => setTimeout(resolve, 100));

        let dataURL;

        if (webglContext) {
            // For WebGL canvases, use the working method from node-system.js
            console.log('Capturing WebGL canvas using node-system method...');
            
                    // Get the node data to access the proper WebGL context
        const nodeData = window.nodeSystem?.nodes?.get(nodeId);
        console.log('Node data lookup:', { 
            nodeId, 
            hasNodeSystem: !!window.nodeSystem, 
            hasNodes: !!window.nodeSystem?.nodes,
            nodeData: !!nodeData,
            hasData: !!nodeData?.data,
            hasGL: !!nodeData?.data?.gl
        });
        
        // Debug the actual node data structure
        if (nodeData && nodeData.data) {
            console.log('Node data structure:', {
                type: nodeData.type,
                hasFrameBuffer: !!nodeData.data.frameBuffer,
                hasOutputTexture: !!nodeData.data.outputTexture,
                hasCanvas: !!nodeData.data.canvas,
                hasGL: !!nodeData.data.gl,
                hasProgram: !!nodeData.data.program,
                hasRender: !!nodeData.data.render,
                glCanvas: nodeData.data.gl?.canvas,
                glDrawingBufferWidth: nodeData.data.gl?.drawingBufferWidth,
                glDrawingBufferHeight: nodeData.data.gl?.drawingBufferHeight
            });
        }
        
        if (nodeData && nodeData.data && nodeData.data.gl) {
            console.log('Found node with WebGL context, using node-specific capture...');
                
                const gl = nodeData.data.gl;
                const nodeCanvas = nodeData.data.canvas || canvas; // Fallback to the original canvas
                
                // Check if the WebGL context's canvas matches our target canvas
                console.log('Canvas comparison:', {
                    targetCanvas: canvas,
                    glCanvas: gl.canvas,
                    canvasesMatch: canvas === gl.canvas,
                    targetCanvasWidth: canvas.width,
                    glCanvasWidth: gl.canvas?.width,
                    targetCanvasHeight: canvas.height,
                    glCanvasHeight: gl.canvas?.height
                });
                
                console.log('Node canvas info:', {
                    hasNodeCanvas: !!nodeData.data.canvas,
                    nodeCanvasWidth: nodeData.data.canvas?.width,
                    nodeCanvasHeight: nodeData.data.canvas?.height,
                    fallbackCanvasWidth: canvas.width,
                    fallbackCanvasHeight: canvas.height
                });
                
                // Save current WebGL state (like in the working code)
                const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
                const previousProgram = gl.getParameter(gl.CURRENT_PROGRAM);
                
                // Bind to the correct framebuffer (like in the working code)
                if (nodeData.data.frameBuffer) {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, nodeData.data.frameBuffer);
                    console.log('Rendering to framebuffer for capture');
                } else {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                    console.log('Rendering to screen for capture');
                }
                
                // Force a render to ensure content is up to date
                gl.viewport(0, 0, nodeCanvas.width, nodeCanvas.height);
                
                // Simple delay to let any existing rendering complete
                await new Promise(resolve => setTimeout(resolve, 50));
                
                // Read pixels from the correct framebuffer
                const pixels = new Uint8Array(nodeCanvas.width * nodeCanvas.height * 4);
                gl.readPixels(0, 0, nodeCanvas.width, nodeCanvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                
                // Restore WebGL state
                gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);
                gl.useProgram(previousProgram);
                
                // Check if we have content
                let hasContent = false;
                for (let i = 0; i < pixels.length; i += 4) {
                    if (pixels[i] > 0 || pixels[i + 1] > 0 || pixels[i + 2] > 0 || pixels[i + 3] > 0) {
                        hasContent = true;
                        break;
                    }
                }
                
                console.log('Node WebGL pixel check:', { hasContent, totalPixels: pixels.length / 4 });
                
                if (hasContent) {
                    // Create a new canvas with the pixel data
                    const tempCanvas = document.createElement('canvas');
                    const tempCtx = tempCanvas.getContext('2d');
                    tempCanvas.width = nodeCanvas.width;
                    tempCanvas.height = nodeCanvas.height;
                    
                    // Fill with white background first
                    tempCtx.fillStyle = 'white';
                    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                    
                    // Create ImageData and flip vertically (WebGL origin is bottom-left)
                    const imageData = tempCtx.createImageData(nodeCanvas.width, nodeCanvas.height);
                    for (let y = 0; y < nodeCanvas.height; y++) {
                        for (let x = 0; x < nodeCanvas.width; x++) {
                            const srcIndex = (y * nodeCanvas.width + x) * 4;
                            const dstIndex = ((nodeCanvas.height - 1 - y) * nodeCanvas.width + x) * 4;
                            imageData.data[dstIndex] = pixels[srcIndex];     // R
                            imageData.data[dstIndex + 1] = pixels[srcIndex + 1]; // G
                            imageData.data[dstIndex + 2] = pixels[srcIndex + 2]; // B
                            imageData.data[dstIndex + 3] = pixels[srcIndex + 3]; // A
                        }
                    }
                    
                    tempCtx.putImageData(imageData, 0, 0);
                    dataURL = tempCanvas.toDataURL('image/png', 0.8);
                    console.log('Node WebGL capture completed successfully');
                } else {
                    console.log('Node WebGL pixels are all zero');
                }
            } else {
                console.log('No node data found, falling back to generic WebGL capture...');
                
                // Fallback to generic WebGL capture
                try {
                    const blob = await new Promise((resolve, reject) => {
                        canvas.toBlob(resolve, 'image/png', 0.8);
                    });
                    
                    if (blob) {
                        dataURL = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result);
                            reader.readAsDataURL(blob);
                        });
                        console.log('Generic WebGL toBlob capture succeeded');
                    } else {
                        console.log('toBlob returned null blob');
                    }
                } catch (e) {
                    console.log('Generic WebGL capture failed:', e);
                }
            }
        }
        
        // If the node-specific method failed, try the generic toBlob method
        if (!dataURL) {
            console.log('Node-specific method failed, trying generic toBlob...');
            try {
                const blob = await new Promise((resolve, reject) => {
                    canvas.toBlob(resolve, 'image/png', 0.8);
                });
                
                if (blob) {
                    dataURL = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                    console.log('Generic toBlob capture succeeded as fallback');
                } else {
                    console.log('Generic toBlob returned null blob');
                }
            } catch (e) {
                console.log('Generic toBlob capture failed:', e);
            }
        }
        
        // If toBlob also failed, try drawing to temp canvas
        if (!dataURL) {
            console.log('toBlob failed, trying temp canvas drawImage method...');
            try {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;
                const tempCtx = tempCanvas.getContext('2d');
                
                // Fill with white background
                tempCtx.fillStyle = 'white';
                tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                
                // Draw the WebGL canvas
                tempCtx.drawImage(canvas, 0, 0);
                
                dataURL = tempCanvas.toDataURL('image/png', 0.8);
                console.log('Temp canvas drawImage method succeeded');
            } catch (e) {
                console.log('Temp canvas drawImage method failed:', e);
            }
        }
        
        // Try Chrome's native capture method (similar to "Save image as...")
        if (!dataURL) {
            console.log('Trying Chrome native capture method...');
            try {
                // Use the browser's native capture mechanism
                const stream = canvas.captureStream();
                const video = document.createElement('video');
                video.srcObject = stream;
                
                // Wait for video to load
                await new Promise((resolve) => {
                    video.onloadedmetadata = () => {
                        video.play();
                        resolve();
                    };
                });
                
                // Create a canvas to capture the video frame
                const captureCanvas = document.createElement('canvas');
                captureCanvas.width = canvas.width;
                captureCanvas.height = canvas.height;
                const captureCtx = captureCanvas.getContext('2d');
                
                // Draw the video frame
                captureCtx.drawImage(video, 0, 0);
                
                dataURL = captureCanvas.toDataURL('image/png', 0.8);
                console.log('Chrome native capture method succeeded');
                
                // Clean up
                stream.getTracks().forEach(track => track.stop());
            } catch (e) {
                console.log('Chrome native capture method failed:', e);
            }
        }
        
        // Check if we got a dataURL but it might be blank
        let hasValidDataURL = dataURL && dataURL.length > 100; // Basic check for non-blank image
        
        // Try immediate capture first (before any other operations)
        if (!dataURL || !hasValidDataURL) {
            console.log('Trying immediate capture after shader update...');
            try {
                // Wait a tiny bit for the render to complete
                await new Promise(resolve => setTimeout(resolve, 10));
                
                // Try direct capture
                const immediateDataURL = canvas.toDataURL('image/png', 0.8);
                if (immediateDataURL && immediateDataURL.length > 100) {
                    dataURL = immediateDataURL;
                    console.log('Immediate capture succeeded');
                } else {
                    console.log('Immediate capture returned blank image');
                }
            } catch (e) {
                console.log('Immediate capture failed:', e);
            }
        }
        
        // If all methods failed OR we got a blank image, try alternative pixel capture methods
        if (!dataURL || !hasValidDataURL) {
            console.log('All standard methods failed or returned blank image, trying alternative pixel capture...');
            
            // Method 1: Try createImageBitmap
            try {
                console.log('Trying createImageBitmap method...');
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
                
                dataURL = tempCanvas.toDataURL('image/png', 0.8);
                console.log('createImageBitmap method succeeded');
            } catch (e) {
                console.log('createImageBitmap method failed:', e);
            }
            
            // Method 2: Try OffscreenCanvas if available
            if (!dataURL && typeof OffscreenCanvas !== 'undefined') {
                try {
                    console.log('Trying OffscreenCanvas method...');
                    const offscreen = canvas.transferControlToOffscreen();
                    const offscreenCanvas = new OffscreenCanvas(canvas.width, canvas.height);
                    const offscreenCtx = offscreenCanvas.getContext('2d');
                    
                    // Fill with white background
                    offscreenCtx.fillStyle = 'white';
                    offscreenCtx.fillRect(0, 0, canvas.width, canvas.height);
                    
                    // Draw the original canvas
                    offscreenCtx.drawImage(offscreen, 0, 0);
                    
                    const blob = await offscreenCanvas.convertToBlob({ type: 'image/png' });
                    const reader = new FileReader();
                    dataURL = await new Promise((resolve) => {
                        reader.onload = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                    console.log('OffscreenCanvas method succeeded');
                } catch (e) {
                    console.log('OffscreenCanvas method failed:', e);
                }
            }
            
            // Method 3: Try using the existing WebGL context directly
            if ((!dataURL || !hasValidDataURL) && webglContext) {
                try {
                    console.log('Trying to use existing WebGL context directly...');
                    
                                // Get the node data to access the existing WebGL context
            const nodeData = window.nodeSystem?.nodes?.get(nodeId);
            console.log('Full nodeData structure:', JSON.stringify(nodeData, null, 2));
            console.log('nodeData.data structure:', JSON.stringify(nodeData?.data, null, 2));
            
            // Check if the shader program is properly set up
            if (nodeData?.data?.gl && nodeData?.data?.program) {
                const gl = nodeData.data.gl;
                const program = nodeData.data.program;
                
                console.log('Shader program info:', {
                    program: program,
                    isProgram: gl.isProgram(program),
                    linkStatus: gl.getProgramParameter(program, gl.LINK_STATUS),
                    validateStatus: gl.getProgramParameter(program, gl.VALIDATE_STATUS),
                    infoLog: gl.getProgramInfoLog(program)
                });
                
                // Check uniform locations
                const timeLocation = gl.getUniformLocation(program, 'u_time');
                const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
                const spectrumLocation = gl.getUniformLocation(program, 'u_spectrum');
                
                console.log('Uniform locations:', {
                    timeLocation,
                    resolutionLocation,
                    spectrumLocation,
                    hasTimeUniform: timeLocation !== null,
                    hasResolutionUniform: resolutionLocation !== null,
                    hasSpectrumUniform: spectrumLocation !== null
                });
            }
            if (nodeData && nodeData.data && nodeData.data.gl) {
                const gl = nodeData.data.gl;
                        
                        // Force a render using the existing context
                        console.log('Forcing render with existing WebGL context...');
                        
                        // Try to trigger a render by calling the node's render method if it exists
                        if (nodeData.data.render && typeof nodeData.data.render === 'function') {
                            console.log('Calling node render method...');
                            nodeData.data.render();
                        }
                        
                        // Also try to trigger a render through the node system
                        if (window.nodeSystem && window.nodeSystem.renderWebGLNode) {
                            console.log('Calling nodeSystem.renderWebGLNode...');
                            try {
                                // Create a proper node object structure
                                const nodeObject = {
                                    element: { id: nodeId },
                                    data: nodeData.data
                                };
                                console.log('nodeObject being passed to renderWebGLNode:', JSON.stringify(nodeObject, null, 2));
                                await window.nodeSystem.renderWebGLNode(nodeObject);
                            } catch (renderError) {
                                console.log('renderWebGLNode failed, trying direct render:', renderError);
                                // If renderWebGLNode fails, try a direct render
                                if (gl && nodeData.data.program) {
                                    gl.useProgram(nodeData.data.program);
                                    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                                }
                            }
                        }
                        
                        // Now try to capture immediately after render
                        console.log('Capturing immediately after render...');
                        dataURL = canvas.toDataURL('image/png', 0.8);
                        console.log('Direct capture after render succeeded');
                    }
                } catch (e) {
                    console.log('Existing WebGL context method failed:', e);
                }
            }
            
            // Method 4: Try Screenshot API (screen capture)
            if ((!dataURL || !hasValidDataURL) && navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
                try {
                    console.log('Trying Screenshot API method...');
                    
                    // Get the canvas element's position
                    const rect = canvas.getBoundingClientRect();
                    
                    // Request screen capture
                    const stream = await navigator.mediaDevices.getDisplayMedia({
                        video: {
                            mediaSource: 'screen',
                            width: { ideal: canvas.width },
                            height: { ideal: canvas.height }
                        }
                    });
                    
                    // Create video element to capture the stream
                    const video = document.createElement('video');
                    video.srcObject = stream;
                    await new Promise(resolve => {
                        video.onloadedmetadata = () => {
                            video.play();
                            resolve();
                        };
                    });
                    
                    // Create canvas to capture the video frame
                    const captureCanvas = document.createElement('canvas');
                    captureCanvas.width = canvas.width;
                    captureCanvas.height = canvas.height;
                    const captureCtx = captureCanvas.getContext('2d');
                    
                    // Draw the video frame
                    captureCtx.drawImage(video, rect.left, rect.top, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
                    
                    dataURL = captureCanvas.toDataURL('image/png', 0.8);
                    console.log('Screenshot API method succeeded');
                    
                    // Clean up
                    stream.getTracks().forEach(track => track.stop());
                } catch (e) {
                    console.log('Screenshot API method failed:', e);
                }
            }
        } else {
            // For non-WebGL canvases, use toDataURL
            console.log('Capturing non-WebGL canvas...');
            dataURL = canvas.toDataURL('image/png', 0.8);
            console.log('toDataURL succeeded');
        }

        if (dataURL) {
            const base64Data = dataURL.split(',')[1]; // Remove data:image/png;base64, prefix
            console.log('Canvas screenshot captured for node:', nodeId, 'Size:', canvas.width, 'x', canvas.height, 'Base64 length:', base64Data.length);
            
            // Check if the base64 data represents a blank/transparent image
            // For WebGL canvases, if the base64 length is around 3400, it's likely blank
            if (webglContext && base64Data.length < 5000) {
                console.log('Detected likely blank WebGL image (short base64 length), treating as blank');
                return null; // Return null to trigger alternative methods
            }
            
            // Try to decode a small portion to see if it's all zeros
            try {
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                
                // Check if the image data portion is all zeros (transparent/blank)
                let allZeros = true;
                for (let i = 0; i < Math.min(bytes.length, 1000); i++) {
                    if (bytes[i] !== 0) {
                        allZeros = false;
                        break;
                    }
                }
                
                if (allZeros) {
                    console.log('Detected blank/transparent image, all zeros in data');
                    return null; // Return null to trigger alternative methods
                }
            } catch (e) {
                console.log('Could not analyze base64 data:', e);
            }
            
            return {
                image: base64Data,
                type: 'image/png',
                width: canvas.width,
                height: canvas.height
            };
        } else {
            console.warn('Failed to capture canvas screenshot for node:', nodeId, '- dataURL is null/undefined');
            return null;
        }
    } catch (error) {
        console.warn('Failed to capture canvas screenshot:', error);
        return null;
    }
}

class DiffManager {
    constructor(nodeSystem) {
        this.nodeSystem = nodeSystem;
        this.diffs = new Map();
        this.visualizationContainer = null;
        this.isVisualizationOpen = false;
        this.svg = null;
        this.nodes = [];
        this.connections = [];
        this.selectedNode = null;
        this.infoPopup = null;
        this.loadedDiffId = null; // Track which diff is currently loaded
        this.detailPanel = null;
        this.pendingCaptureNodeId = null; // Track which node needs capture during render
        this.capturedImageData = null; // Store captured image data
        this.setupCleanup();
    }

    async saveDiff(nodeId, oldCode, newCode) {
        try {
            // Set up capture during render
            this.pendingCaptureNodeId = nodeId;
            this.capturedImageData = null;
            
            // Capture canvas screenshot if available
            let screenshot = await captureCanvasScreenshot(nodeId);
            let canvasImage = screenshot ? screenshot.image : null;
            let canvasImageType = screenshot ? screenshot.type : null;
            
            // If the first capture failed OR produced blank content, try capturing after a shader update
            if ((!screenshot || (screenshot && screenshot.image && screenshot.image.length < 1000)) && window.nodeSystem?.shaderManager) {
                console.log('First capture failed, trying capture after shader update...');
                
                // Update the shader first
                const nodeData = window.nodeSystem.nodes.get(nodeId);
                if (nodeData && nodeData.type === 'webgl') {
                    window.nodeSystem.shaderManager.updateShader(nodeId, newCode);
                    
                    // Wait a bit for shader to compile
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // Now explicitly call renderWebGLNode to trigger capture
                    console.log('Explicitly calling renderWebGLNode for capture...');
                    try {
                        const nodeObject = {
                            element: { id: nodeId },
                            data: nodeData.data
                        };
                        await window.nodeSystem.renderWebGLNode(nodeObject);
                    } catch (renderError) {
                        console.log('renderWebGLNode failed:', renderError);
                    }
                    
                    // Wait a bit more for capture to complete
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                                // Check if we captured during render
            console.log('Checking for captured image data:', {
                hasCapturedData: !!this.capturedImageData,
                capturedData: this.capturedImageData
            });
            
                                if (this.capturedImageData) {
                        console.log('Using captured image data from render');
                        screenshot = this.capturedImageData;
                        canvasImage = this.capturedImageData.image;
                        canvasImageType = this.capturedImageData.type;
                        this.capturedImageData = null; // Clear the captured data
                        
                        // Skip all subsequent capture attempts since we have a successful capture
                        console.log('Skipping subsequent capture attempts - we have a successful capture');
                        
                        // Save the diff with the captured image data
                        const response = await fetch('/api/diffs', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ 
                                nodeId, 
                                oldCode, 
                                newCode, 
                                canvasImage, 
                                canvasImageType 
                            })
                        });

                        if (!response.ok) {
                            throw new Error('Failed to save diff');
                        }

                        const result = await response.json();
                        console.log('Diff saved with captured image:', result.id);
                        
                        // Update the loaded diff ID to the new one
                        this.loadedDiffId = result.id;
                        
                        return result.id;
                    } else {
                        console.log('No captured image data from render, trying fallback...');
                        // Try fallback capture methods
                        try {
                            const canvas = document.getElementById(nodeId)?.querySelector('canvas');
                            if (canvas) {
                                const imageBitmap = await createImageBitmap(canvas);
                                const tempCanvas = document.createElement('canvas');
                                tempCanvas.width = canvas.width;
                                tempCanvas.height = canvas.height;
                                const tempCtx = tempCanvas.getContext('2d');
                                
                                tempCtx.fillStyle = 'white';
                                tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                                tempCtx.drawImage(imageBitmap, 0, 0);
                                
                                const dataURL = tempCanvas.toDataURL('image/png', 0.8);
                                const base64Data = dataURL.split(',')[1];
                                
                                screenshot = {
                                    image: base64Data,
                                    type: 'image/png',
                                    width: canvas.width,
                                    height: canvas.height
                                };
                                canvasImage = base64Data;
                                canvasImageType = 'image/png';
                                console.log('Fallback capture succeeded');
                            }
                        } catch (e) {
                            console.log('Fallback capture failed:', e);
                        }
                    }
                }
            }
            
            // For WebGL canvases, always try the alternative methods since the standard methods often fail
            const canvas = document.getElementById(nodeId)?.querySelector('canvas');
            const webglContext = canvas ? (canvas.getContext('webgl') || canvas.getContext('webgl2')) : null;
            if (webglContext) {
                console.log('Trying alternative pixel capture methods...');
                const canvas = document.getElementById(nodeId)?.querySelector('canvas');
                if (canvas) {
                    // Try createImageBitmap with delay to ensure shader has rendered
                    try {
                        console.log('Trying createImageBitmap method with delay...');
                        
                        // Wait for the shader to definitely render
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        // Force a few render frames
                        for (let i = 0; i < 3; i++) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                        
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
                        
                        screenshot = {
                            image: base64Data,
                            type: 'image/png',
                            width: canvas.width,
                            height: canvas.height
                        };
                        canvasImage = base64Data;
                        canvasImageType = 'image/png';
                        console.log('createImageBitmap method with delay succeeded');
                    } catch (e) {
                        console.log('createImageBitmap method with delay failed:', e);
                    }
                    
                    // Try clipboard API method
                    if (!screenshot) {
                        try {
                            console.log('Trying clipboard API method...');
                            
                            // Copy the canvas to clipboard
                            await navigator.clipboard.write([
                                new ClipboardItem({
                                    'image/png': canvas.toBlob()
                                })
                            ]);
                            
                            // Read from clipboard
                            const clipboardItems = await navigator.clipboard.read();
                            for (const clipboardItem of clipboardItems) {
                                for (const type of clipboardItem.types) {
                                    if (type === 'image/png') {
                                        const blob = await clipboardItem.getType(type);
                                        const dataURL = await new Promise((resolve) => {
                                            const reader = new FileReader();
                                            reader.onload = () => resolve(reader.result);
                                            reader.readAsDataURL(blob);
                                        });
                                        
                                        const base64Data = dataURL.split(',')[1];
                                        screenshot = {
                                            image: base64Data,
                                            type: 'image/png',
                                            width: canvas.width,
                                            height: canvas.height
                                        };
                                        canvasImage = base64Data;
                                        canvasImageType = 'image/png';
                                        console.log('Clipboard API method succeeded');
                                        break;
                                    }
                                }
                            }
                        } catch (e) {
                            console.log('Clipboard API method failed:', e);
                        }
                    }
                }
            }

            const response = await fetch('/api/diffs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    nodeId, 
                    oldCode, 
                    newCode, 
                    canvasImage, 
                    canvasImageType 
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save diff');
            }

            const result = await response.json();
            console.log('Diff saved:', result.id);
            
            // Update the loaded diff ID to the new one
            this.loadedDiffId = result.id;
            
            return result.id;
        } catch (error) {
            console.error('Error saving diff:', error);
        }
    }

    async loadDiffs() {
        try {
            const response = await fetch('/api/diffs');
            if (!response.ok) {
                throw new Error('Failed to load diffs');
            }
            const diffs = await response.json();
            console.log('Loaded diffs:', diffs);
            this.diffs.clear();
            diffs.forEach(diff => {
                this.diffs.set(diff.id, diff);
            });
            return diffs;
        } catch (error) {
            console.error('Error loading diffs:', error);
            return [];
        }
    }

    async loadDiffCode(diffId) {
        try {
            const response = await fetch(`/api/diffs/${diffId}/load`);
            if (!response.ok) {
                throw new Error('Failed to load diff code');
            }
            return await response.json();
        } catch (error) {
            console.error('Error loading diff code:', error);
            return null;
        }
    }

    async minimizeDiff(diffId) {
        try {
            const response = await fetch(`/api/diffs/${diffId}/minimize`, {
                method: 'POST'
            });
            return response.ok;
        } catch (error) {
            console.error('Error minimizing diff:', error);
            return false;
        }
    }

    async deleteDiff(diffId) {
        try {
            const response = await fetch(`/api/diffs/${diffId}`, {
                method: 'DELETE'
            });
            return response.ok;
        } catch (error) {
            console.error('Error deleting diff:', error);
            return false;
        }
    }

    createVisualizationButton() {
        const button = document.createElement('button');
        button.textContent = 'Diff History';
        button.className = 'diff-visualization-button';
        button.style.cssText = `
            padding: 8px 16px;
            background-color: rgba(68, 68, 68, 0.2);
            color: white;
            border: 1px solid #ff69b4;
            border-radius: 4px;
            cursor: pointer;
            font-family: 'Bianzhidai', monospace;
            font-size: 14px;
            margin-left: 10px;
            transition: all 0.3s ease;
        `;

        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = 'rgba(255, 105, 180, 0.2)';
            button.style.color = '#1e1e1e';
        });

        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = 'rgba(68, 68, 68, 0.2)';
            button.style.color = 'white';
        });

        button.addEventListener('click', () => {
            console.log('Diff History button clicked!');
            this.toggleVisualization();
        });

        const toolbar = document.getElementById('toolbar');
        if (toolbar) {
            toolbar.appendChild(button);
        }
    }

    toggleVisualization() {
        if (this.isVisualizationOpen) {
            this.closeVisualization();
        } else {
            this.openVisualization();
        }
    }

    openVisualization() {
        console.log('Opening visualization...');
        if (this.visualizationContainer) {
            this.closeVisualization();
        }

        this.visualizationContainer = document.createElement('div');
        this.visualizationContainer.className = 'diff-visualization';
        this.visualizationContainer.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 95vw;
            height: 90vh;
            background-color: rgba(0, 0, 0, 0.2);
            border: 1px solid #ff69b4;
            border-radius: 8px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            border-bottom: 1px solid #ff69b4;
            background-color: rgba(30, 30, 30, 0.2);
        `;

        const title = document.createElement('h2');
        title.textContent = 'Shader Diff History';
        title.style.cssText = `
            margin: 0;
            color: white;
            font-family: 'Bianzhidai', monospace;
            font-size: 18px;
        `;

        const headerButtons = document.createElement('div');
        headerButtons.style.cssText = `
            display: flex;
            gap: 10px;
        `;

        const clearAllButton = document.createElement('button');
        clearAllButton.textContent = '🗑️ Clear All';
        clearAllButton.style.cssText = `
            padding: 5px 12px;
            background-color: rgba(68, 68, 68, 0.2);
            color: white;
            border: 1px solid #ff69b4;
            border-radius: 4px;
            cursor: pointer;
            font-family: 'Bianzhidai', monospace;
            font-size: 12px;
            transition: all 0.2s ease;
        `;
        clearAllButton.addEventListener('mouseenter', () => {
            clearAllButton.style.backgroundColor = 'rgba(255, 105, 180, 0.2)';
            clearAllButton.style.color = '#1e1e1e';
        });
        clearAllButton.addEventListener('mouseleave', () => {
            clearAllButton.style.backgroundColor = 'rgba(68, 68, 68, 0.2)';
            clearAllButton.style.color = 'white';
        });
        clearAllButton.addEventListener('click', async () => {
            await this.cleanupAllDiffs();
            this.renderDivs();
        });

        const closeButton = document.createElement('button');
        closeButton.textContent = '✕';
        closeButton.style.cssText = `
            padding: 5px 12px;
            background-color: rgba(68, 68, 68, 0.2);
            color: white;
            border: 1px solid #ff69b4;
            border-radius: 4px;
            cursor: pointer;
            font-family: 'Bianzhidai', monospace;
            font-size: 12px;
            transition: all 0.2s ease;
        `;
        closeButton.addEventListener('mouseenter', () => {
            closeButton.style.backgroundColor = 'rgba(255, 105, 180, 0.2)';
            closeButton.style.color = '#1e1e1e';
        });
        closeButton.addEventListener('mouseleave', () => {
            closeButton.style.backgroundColor = 'rgba(68, 68, 68, 0.2)';
            closeButton.style.color = 'white';
        });
        closeButton.addEventListener('click', () => {
            this.closeVisualization();
        });

        headerButtons.appendChild(clearAllButton);
        headerButtons.appendChild(closeButton);
        header.appendChild(title);
        header.appendChild(headerButtons);
        this.visualizationContainer.appendChild(header);

        // Main content area
        const mainContent = document.createElement('div');
        mainContent.style.cssText = `
            flex: 1;
            display: flex;
            overflow: hidden;
        `;

        // Left panel for visualization
        const leftPanel = document.createElement('div');
        leftPanel.style.cssText = `
            flex: 1;
            position: relative;
            overflow: auto;
            padding: 20px;
            border-right: 1px solid #ff69b4;
        `;

        this.svg = leftPanel;
        mainContent.appendChild(leftPanel);

        // Right panel for diff details
        this.detailPanel = document.createElement('div');
        this.detailPanel.style.cssText = `
            width: 400px;
            background-color: rgba(0, 0, 0, 0.3);
            overflow: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
        `;

        // Default message for detail panel
        const defaultMessage = document.createElement('div');
        defaultMessage.style.cssText = `
            color: rgba(255, 255, 255, 0.7);
            font-family: 'Bianzhidai', monospace;
            font-size: 14px;
            text-align: center;
            margin-top: 50px;
        `;
        defaultMessage.textContent = 'Click on a diff node to view details';
        this.detailPanel.appendChild(defaultMessage);

        mainContent.appendChild(this.detailPanel);
        this.visualizationContainer.appendChild(mainContent);

        document.body.appendChild(this.visualizationContainer);
        this.isVisualizationOpen = true;

        // Load diffs and render
        this.loadDiffs().then(() => {
            this.renderDivs();
        });
    }

    closeVisualization() {
        if (this.visualizationContainer) {
            document.body.removeChild(this.visualizationContainer);
            this.visualizationContainer = null;
            this.svg = null;
            this.detailPanel = null;
            this.isVisualizationOpen = false;
        }
    }

    renderDivs() {
        if (!this.svg) return;
        console.log('Rendering divs, clearing container...');
        this.svg.innerHTML = ''; // Clear left panel
        this.buildNodeHierarchy();
        this.drawDivConnections();
        this.drawDivNodes();
    }

    buildNodeHierarchy() {
        this.nodes = [];
        this.connections = [];
        console.log('Building node hierarchy with diffs:', this.diffs.size);

        // Group diffs by node
        const nodeGroups = new Map();
        this.diffs.forEach(diff => {
            if (!nodeGroups.has(diff.nodeId)) {
                nodeGroups.set(diff.nodeId, []);
            }
            nodeGroups.get(diff.nodeId).push(diff);
        });

        console.log('Node groups:', nodeGroups.size);
        nodeGroups.forEach((diffs, nodeId) => {
            console.log('Node group:', nodeId, 'has', diffs.length, 'diffs');
        });

        // Create nodes for each group
        let xOffset = 50;
        const ySpacing = 120;
        let maxY = 0;

        nodeGroups.forEach((diffs, nodeId) => {
            // Sort diffs by timestamp
            diffs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            let yOffset = 50;
            let parentNode = null;

            diffs.forEach((diff, index) => {
                const node = {
                    id: diff.id,
                    nodeId: nodeId,
                    x: xOffset,
                    y: yOffset,
                    width: 200,
                    height: 80,
                    diff: diff,
                    parent: parentNode,
                    children: [],
                    isSelected: false,
                    isHovered: false,
                    isLoaded: diff.id === this.loadedDiffId
                };

                if (parentNode) {
                    parentNode.children.push(node);
                    this.connections.push({
                        from: parentNode,
                        to: node
                    });
                }

                this.nodes.push(node);
                parentNode = node;
                yOffset += ySpacing;
                maxY = Math.max(maxY, yOffset);
            });

            xOffset += 250;
        });
    }

    drawDivConnections() {
        this.connections.forEach(connection => {
            const line = document.createElement('div');
            line.style.cssText = `
                position: absolute;
                height: 2px;
                background: linear-gradient(90deg, #ff69b4 50%, transparent 50%);
                background-size: 10px 2px;
                transform-origin: left center;
                z-index: 1;
            `;

            const fromX = connection.from.x + connection.from.width / 2;
            const fromY = connection.from.y + connection.from.height / 2;
            const toX = connection.to.x + connection.to.width / 2;
            const toY = connection.to.y + connection.to.height / 2;

            const length = Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2);
            const angle = Math.atan2(toY - fromY, toX - fromX) * 180 / Math.PI;

            line.style.left = fromX + 'px';
            line.style.top = fromY + 'px';
            line.style.width = length + 'px';
            line.style.transform = `rotate(${angle}deg)`;

            this.svg.appendChild(line);
        });
    }

    drawDivNodes() {
        console.log('Drawing nodes:', this.nodes.length);
        this.nodes.forEach(node => {
            console.log('Creating node:', node.id);
            const nodeDiv = document.createElement('div');
            nodeDiv.setAttribute('data-node-id', node.id);
            
            // Determine background color based on state
            let bgColor;
            if (node.isLoaded) {
                bgColor = 'rgba(255, 105, 180, 0.9)'; // Bright pink for loaded
            } else if (node.isSelected) {
                bgColor = 'rgba(255, 105, 180, 0.8)';
            } else if (node.isHovered) {
                bgColor = 'rgba(255, 105, 180, 0.6)';
            } else {
                bgColor = 'rgba(68, 68, 68, 0.8)';
            }

            nodeDiv.style.cssText = `position: absolute; left: ${node.x}px; top: ${node.y}px; width: ${node.width}px; height: ${node.height}px; background-color: ${bgColor}; border: 2px solid #ff69b4; border-radius: 20px; cursor: pointer; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 10px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3); transition: all 0.3s ease; z-index: 2; backdrop-filter: blur(3px); ${node.isLoaded ? 'box-shadow: 0 0 20px rgba(255, 105, 180, 0.5);' : ''} border: 3px solid red !important;`;

            // Node name
            const nameDiv = document.createElement('div');
            nameDiv.textContent = node.nodeId;
            nameDiv.style.cssText = `font-weight: bold; color: #ffffff; font-family: 'Bianzhidai', monospace; font-size: 12px; margin-bottom: 4px;`;
            nodeDiv.appendChild(nameDiv);

            // Description (single short sentence)
            const descDiv = document.createElement('div');
            descDiv.textContent = node.diff.summary || 'Shader modification';
            descDiv.style.cssText = `color: #cccccc; font-family: 'Bianzhidai', monospace; font-size: 10px; text-align: center; line-height: 1.2;`;
            nodeDiv.appendChild(descDiv);

            // Timestamp
            const timestamp = document.createElement('div');
            timestamp.style.cssText = `
                color: rgba(255, 255, 255, 0.8);
                font-family: 'Bianzhidai', monospace;
                font-size: 8px;
                text-align: center;
            `;
            timestamp.textContent = new Date(node.diff.timestamp).toLocaleTimeString();
            nodeDiv.appendChild(timestamp);

            // Add loaded indicator
            if (node.isLoaded) {
                const loadedIndicator = document.createElement('div');
                loadedIndicator.style.cssText = `
                    position: absolute;
                    top: -5px;
                    right: -5px;
                    width: 15px;
                    height: 15px;
                    background-color: #00ff00;
                    border-radius: 50%;
                    border: 2px solid white;
                `;
                nodeDiv.appendChild(loadedIndicator);
            }

            // Add click handler
            nodeDiv.addEventListener('click', (e) => {
                console.log('=== CLICK EVENT TRIGGERED ===');
                console.log('Event target:', e.target);
                console.log('Event currentTarget:', e.currentTarget);
                console.log('Node ID:', node.id);
                console.log('Node data:', node.diff);
                
                e.preventDefault(); // Prevent default behavior
                e.stopPropagation(); // Stop event bubbling
                
                console.log('Node clicked:', node.id, node.diff); // Debug log
                this.loadDiffIntoNode(node.diff);
                this.selectedNode = node;
                this.showDiffDetails(node);
                this.renderDivs(); // Re-render to update selected/loaded state
            });

            // Add hover handlers (removed re-rendering to prevent click event loss)
            nodeDiv.addEventListener('mouseenter', () => { 
                console.log('Mouse entered node:', node.id);
                node.isHovered = true; 
                // Don't re-render on hover - it destroys the click events
                // this.renderDivs(); 
            });
            nodeDiv.addEventListener('mouseleave', () => { 
                console.log('Mouse left node:', node.id);
                node.isHovered = false; 
                // Don't re-render on hover - it destroys the click events
                // this.renderDivs(); 
            });

            this.svg.appendChild(nodeDiv);
            console.log('Node div added to DOM:', nodeDiv);
            console.log('Node position:', node.x, node.y);
            console.log('Node div style:', nodeDiv.style.cssText);
        });
    }

    async showDiffDetails(node) {
        if (!this.detailPanel) return;

        // Clear the detail panel
        this.detailPanel.innerHTML = '';

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid #ff69b4;
        `;

        const title = document.createElement('h3');
        title.textContent = `Diff Details - ${node.nodeId}`;
        title.style.cssText = `
            margin: 0;
            color: white;
            font-family: 'Bianzhidai', monospace;
            font-size: 16px;
        `;

        const loadButton = document.createElement('button');
        loadButton.textContent = node.isLoaded ? 'Currently Loaded' : 'Load This Version';
        loadButton.style.cssText = `
            padding: 8px 16px;
            background-color: ${node.isLoaded ? 'rgba(0, 255, 0, 0.8)' : 'rgba(255, 105, 180, 0.8)'};
            color: #1e1e1e;
            border: 1px solid #ff69b4;
            border-radius: 4px;
            cursor: ${node.isLoaded ? 'default' : 'pointer'};
            font-family: 'Bianzhidai', monospace;
            font-size: 12px;
            font-weight: bold;
            transition: all 0.2s ease;
        `;
        
        if (!node.isLoaded) {
            loadButton.addEventListener('mouseenter', () => {
                loadButton.style.backgroundColor = 'rgba(255, 105, 180, 1)';
                loadButton.style.transform = 'scale(1.05)';
            });
            loadButton.addEventListener('mouseleave', () => {
                loadButton.style.backgroundColor = 'rgba(255, 105, 180, 0.8)';
                loadButton.style.transform = 'scale(1)';
            });
            loadButton.addEventListener('click', () => {
                this.loadDiffIntoNode(node.diff);
                this.showDiffDetails(node);
            });
        }

        header.appendChild(title);
        header.appendChild(loadButton);
        this.detailPanel.appendChild(header);

        // Summary
        const summarySection = document.createElement('div');
        summarySection.style.cssText = `margin: 10px 0; padding: 10px; background-color: rgba(30, 30, 30, 0.2); border-radius: 8px;`;
        const summaryTitle = document.createElement('h4');
        summaryTitle.textContent = 'Summary';
        summaryTitle.style.cssText = `margin: 0 0 5px 0; color: #ff69b4; font-family: 'Bianzhidai', monospace; font-size: 14px;`;
        const summaryText = document.createElement('p');
        summaryText.textContent = node.diff.summary || 'No summary available';
        summaryText.style.cssText = `margin: 0; color: #ffffff; font-family: 'Bianzhidai', monospace; font-size: 12px; line-height: 1.4;`;
        summarySection.appendChild(summaryTitle);
        summarySection.appendChild(summaryText);
        this.detailPanel.appendChild(summarySection);

        // Canvas Screenshot Section (if available)
        if (node.diff.canvasImage) {
            const screenshotSection = document.createElement('div');
            screenshotSection.style.cssText = `margin: 10px 0; padding: 10px; background-color: rgba(30, 30, 30, 0.2); border-radius: 8px;`;
            const screenshotTitle = document.createElement('h4');
            screenshotTitle.textContent = 'Canvas Screenshot';
            screenshotTitle.style.cssText = `margin: 0 0 10px 0; color: #ff69b4; font-family: 'Bianzhidai', monospace; font-size: 14px;`;
            
            // Debug info
            const debugInfo = document.createElement('div');
            debugInfo.style.cssText = `margin: 0 0 10px 0; color: #ff69b4; font-family: 'Bianzhidai', monospace; font-size: 10px;`;
            debugInfo.textContent = `Base64 length: ${node.diff.canvasImage.length}, Type: ${node.diff.canvasImageType || 'image/png'}`;
            
            const screenshotImg = document.createElement('img');
            screenshotImg.src = `data:${node.diff.canvasImageType || 'image/png'};base64,${node.diff.canvasImage}`;
            screenshotImg.style.cssText = `
                width: 100%;
                max-width: 300px;
                height: auto;
                border-radius: 4px;
                border: 1px solid #ff69b4;
                margin: 0;
            `;
            screenshotImg.alt = 'Canvas screenshot at time of diff';
            
            // Add error handling for image load
            screenshotImg.onerror = () => {
                console.error('Failed to load canvas screenshot image');
                screenshotImg.style.display = 'none';
                const errorMsg = document.createElement('div');
                errorMsg.style.cssText = `color: #ff4444; font-family: 'Bianzhidai', monospace; font-size: 12px;`;
                errorMsg.textContent = 'Failed to load image (base64 data may be invalid)';
                screenshotSection.appendChild(errorMsg);
            };
            
            screenshotSection.appendChild(screenshotTitle);
            screenshotSection.appendChild(debugInfo);
            screenshotSection.appendChild(screenshotImg);
            this.detailPanel.appendChild(screenshotSection);
        } else {
            // Show when no canvas image is available
            const noImageSection = document.createElement('div');
            noImageSection.style.cssText = `margin: 10px 0; padding: 10px; background-color: rgba(30, 30, 30, 0.2); border-radius: 8px;`;
            const noImageTitle = document.createElement('h4');
            noImageTitle.textContent = 'Canvas Screenshot';
            noImageTitle.style.cssText = `margin: 0 0 5px 0; color: #ff69b4; font-family: 'Bianzhidai', monospace; font-size: 14px;`;
            const noImageText = document.createElement('p');
            noImageText.textContent = 'No canvas screenshot available for this diff';
            noImageText.style.cssText = `margin: 0; color: #888; font-family: 'Bianzhidai', monospace; font-size: 12px; font-style: italic;`;
            noImageSection.appendChild(noImageTitle);
            noImageSection.appendChild(noImageText);
            this.detailPanel.appendChild(noImageSection);
        }

        // Art Reference Section
        const artReferenceSection = document.createElement('div');
        artReferenceSection.style.cssText = `margin: 10px 0; padding: 10px; background-color: rgba(30, 30, 30, 0.2); border-radius: 8px;`;
        const artReferenceTitle = document.createElement('h4');
        artReferenceTitle.textContent = 'Art Reference';
        artReferenceTitle.style.cssText = `margin: 0 0 5px 0; color: #ff69b4; font-family: 'Bianzhidai', monospace; font-size: 14px;`;
        const artReferenceText = document.createElement('p');
        // For existing diffs without artReference field, show a fallback
        const artRef = node.diff.artReference || 'Abstract Expressionism by Pollock';
        artReferenceText.textContent = artRef;
        artReferenceText.style.cssText = `margin: 0; color: #ffffff; font-family: 'Bianzhidai', monospace; font-size: 12px; line-height: 1.4; font-style: italic;`;
        artReferenceSection.appendChild(artReferenceTitle);
        artReferenceSection.appendChild(artReferenceText);
        
        // Add regenerate button if art reference is missing
        if (!node.diff.artReference) {
            const regenerateButton = document.createElement('button');
            regenerateButton.textContent = 'Generate Art Reference';
            regenerateButton.style.cssText = `margin-top: 8px; padding: 4px 8px; background-color: rgba(255, 105, 180, 0.8); color: #1e1e1e; border: 1px solid #ff69b4; border-radius: 4px; cursor: pointer; font-family: 'Bianzhidai', monospace; font-size: 10px;`;
            regenerateButton.addEventListener('click', async () => {
                try {
                    // Show loading state
                    regenerateButton.textContent = 'Generating...';
                    regenerateButton.disabled = true;
                    regenerateButton.style.backgroundColor = 'rgba(68, 68, 68, 0.8)';
                    
                    const response = await fetch(`/api/diffs/${node.diff.id}/regenerate-art`, {
                        method: 'POST'
                    });
                    if (response.ok) {
                        const data = await response.json();
                        node.diff.artReference = data.artReference;
                        artReferenceText.textContent = data.artReference;
                        regenerateButton.remove();
                    } else {
                        // Reset button on error
                        regenerateButton.textContent = 'Generate Art Reference';
                        regenerateButton.disabled = false;
                        regenerateButton.style.backgroundColor = 'rgba(255, 105, 180, 0.8)';
                    }
                } catch (error) {
                    console.error('Error regenerating art reference:', error);
                    // Reset button on error
                    regenerateButton.textContent = 'Generate Art Reference';
                    regenerateButton.disabled = false;
                    regenerateButton.style.backgroundColor = 'rgba(255, 105, 180, 0.8)';
                }
            });
            artReferenceSection.appendChild(regenerateButton);
        }
        
        this.detailPanel.appendChild(artReferenceSection);

        // Timestamp
        const timestampSection = document.createElement('div');
        timestampSection.style.cssText = `
            margin-bottom: 20px;
        `;
        timestampSection.innerHTML = `
            <h4 style="color: #ff69b4; margin: 0 0 10px 0; font-family: 'Bianzhidai', monospace;">Timestamp</h4>
            <p style="color: white; margin: 0; font-family: 'Bianzhidai', monospace;">
                ${new Date(node.diff.timestamp).toLocaleString()}
            </p>
        `;
        this.detailPanel.appendChild(timestampSection);

        // Old Code Section
        const oldCodeSection = document.createElement('div');
        oldCodeSection.style.cssText = `margin: 10px 0; padding: 10px; background-color: rgba(30, 30, 30, 0.2); border-radius: 8px;`;
        const oldCodeTitle = document.createElement('h4');
        oldCodeTitle.textContent = 'Old Code';
        oldCodeTitle.style.cssText = `margin: 0 0 5px 0; color: #ff69b4; font-family: 'Bianzhidai', monospace; font-size: 14px;`;
        const oldCodeText = document.createElement('pre');
        oldCodeText.textContent = node.diff.oldCode || 'No old code available';
        oldCodeText.style.cssText = `margin: 0; color: #ffffff; font-family: 'Bianzhidai', monospace; font-size: 10px; line-height: 1.4; white-space: pre-wrap; overflow-x: auto;`;
        oldCodeSection.appendChild(oldCodeTitle);
        oldCodeSection.appendChild(oldCodeText);
        this.detailPanel.appendChild(oldCodeSection);

        // New Code Section
        const newCodeSection = document.createElement('div');
        newCodeSection.style.cssText = `margin: 10px 0; padding: 10px; background-color: rgba(30, 30, 30, 0.2); border-radius: 8px;`;
        const newCodeTitle = document.createElement('h4');
        newCodeTitle.textContent = 'New Code';
        newCodeTitle.style.cssText = `margin: 0 0 5px 0; color: #ff69b4; font-family: 'Bianzhidai', monospace; font-size: 14px;`;
        const newCodeText = document.createElement('pre');
        newCodeText.textContent = node.diff.newCode || 'No new code available';
        newCodeText.style.cssText = `margin: 0; color: #ffffff; font-family: 'Bianzhidai', monospace; font-size: 10px; line-height: 1.4; white-space: pre-wrap; overflow-x: auto;`;
        newCodeSection.appendChild(newCodeTitle);
        newCodeSection.appendChild(newCodeText);
        this.detailPanel.appendChild(newCodeSection);

        // Diff Section
        const diffSection = document.createElement('div');
        diffSection.style.cssText = `margin: 10px 0; padding: 10px; background-color: rgba(30, 30, 30, 0.2); border-radius: 8px;`;
        const diffTitle = document.createElement('h4');
        diffTitle.textContent = 'Diff';
        diffTitle.style.cssText = `margin: 0 0 5px 0; color: #ff69b4; font-family: 'Bianzhidai', monospace; font-size: 14px;`;
        const diffText = document.createElement('pre');
        diffText.textContent = node.diff.diff || 'No diff available';
        diffText.style.cssText = `margin: 0; color: #ffffff; font-family: 'Bianzhidai', monospace; font-size: 10px; line-height: 1.4; white-space: pre-wrap; overflow-x: auto;`;
        diffSection.appendChild(diffTitle);
        diffSection.appendChild(diffText);
        this.detailPanel.appendChild(diffSection);
    }

    async loadDiffIntoNode(diff) {
        try {
            const diffData = await this.loadDiffCode(diff.id);
            if (diffData && diffData.newCode) {
                // Find the node in the node system
                const nodeElement = document.getElementById(diff.nodeId);
                if (nodeElement) {
                    // Update the node's code
                    const nodeData = this.nodeSystem.nodes.get(diff.nodeId);
                    if (nodeData) {
                        if (nodeData.type === 'webgl') {
                            this.nodeSystem.shaderManager.updateShader(diff.nodeId, diffData.newCode);
                        } else if (nodeData.type === 'webgpu') {
                            this.nodeSystem.webgpuManager.updateShader(diff.nodeId, diffData.newCode);
                        }
                    }
                }
                
                // Update the loaded diff ID
                this.loadedDiffId = diff.id;
                console.log('Loaded diff:', diff.id);
            }
        } catch (error) {
            console.error('Error loading diff into node:', error);
        }
    }

    setupCleanup() {
        window.addEventListener('beforeunload', () => {
            this.cleanupAllDiffs();
        });
    }

    async cleanupAllDiffs() {
        try {
            const response = await fetch('/api/diffs');
            if (response.ok) {
                const diffs = await response.json();
                const deletePromises = diffs.map(diff => 
                    fetch(`/api/diffs/${diff.id}`, { method: 'DELETE' })
                );
                await Promise.all(deletePromises);
                this.diffs.clear();
                this.loadedDiffId = null;
                console.log('All diffs cleaned up');
            }
        } catch (error) {
            console.error('Error cleaning up diffs:', error);
        }
    }
}

export default DiffManager; 