class AINodeManager {
    constructor(nodeSystem) {
        this.nodeSystem = nodeSystem;
        this.socket = null;
        this.isConnected = false;
        this.isEnabled = false; // Start disabled until we check availability
        this.isAIAvailable = false; // Track if AI is available
        console.log('AINodeManager: Initializing...');
        this.checkAIAvailability();
    }

    async checkAIAvailability() {
        try {
            const response = await fetch('/api/ai/status');
            const data = await response.json();
            
            // Check if either OpenAI or Anthropic is available
            const openaiAvailable = data.openai && data.openai.available;
            const anthropicAvailable = data.anthropic && data.anthropic.available;
            this.isAIAvailable = openaiAvailable || anthropicAvailable;
            this.isEnabled = this.isAIAvailable;
            
            console.log('AINodeManager: AI availability check result:', data);
            console.log('AINodeManager: OpenAI available:', openaiAvailable);
            console.log('AINodeManager: Anthropic available:', anthropicAvailable);
            console.log('AINodeManager: Overall AI available:', this.isAIAvailable);
            
            if (this.isAIAvailable) {
                this.initializeSocket();
                this.setupConnectionEvents();
            } else {
                console.log('AINodeManager: AI is not available, disabling AI functionality');
                const message = data.openai?.message || data.anthropic?.message || 'AI functionality is disabled';
                this.updateConnectionStatus(false, message);
            }
            
            // Update the toolbar to reflect AI availability
            if (this.nodeSystem && this.nodeSystem.updateToolbar) {
                this.nodeSystem.updateToolbar();
            }
        } catch (error) {
            console.error('AINodeManager: Failed to check AI availability:', error);
            this.isAIAvailable = false;
            this.isEnabled = false;
            this.updateConnectionStatus(false, 'Failed to check AI availability');
            
            // Update the toolbar even on error
            if (this.nodeSystem && this.nodeSystem.updateToolbar) {
                this.nodeSystem.updateToolbar();
            }
        }
    }

    initializeSocket() {
        if (!this.isAIAvailable) {
            console.log('AINodeManager: Skipping socket initialization - AI not available');
            return;
        }

        console.log('AINodeManager: Attempting to connect to Socket.IO server...');
        
        // Create socket with reconnection options
        this.socket = io('http://localhost:3000', {
            reconnection: true, // Enable automatic reconnection
            timeout: 5000, // Shorter timeout
            autoConnect: true // Connect automatically
        });

        // Always try to connect
        this.connectToServer();
    }

    connectToServer() {
        if (this.socket && this.isAIAvailable) {
            this.socket.connect();
        }
    }

    disconnectFromServer() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }

    enableAI() {
        if (!this.isAIAvailable) {
            console.log('AINodeManager: Cannot enable AI - API key not available');
            return;
        }
        
        this.isEnabled = true;
        this.connectToServer();
        this.updateConnectionStatus(false, 'Connecting to AI server...');
    }

    disableAI() {
        this.isEnabled = false;
        this.disconnectFromServer();
        this.updateConnectionStatus(false, 'AI functionality disabled');
    }

    setupConnectionEvents() {
        if (!this.socket || !this.isAIAvailable) return;

        this.socket.on('connect', () => {
            console.log('AINodeManager: Connected to server with ID:', this.socket.id);
            this.isConnected = true;
            this.updateConnectionStatus(true);
        });

        this.socket.on('connect_error', (error) => {
            console.error('AINodeManager: Socket.IO connection error:', error);
            this.isConnected = false;
            this.updateConnectionStatus(false, 'Could not connect to AI server');
        });

        this.socket.on('disconnect', (reason) => {
            console.log('AINodeManager: Disconnected from server. Reason:', reason);
            this.isConnected = false;
            this.updateConnectionStatus(false, 'Disconnected from AI server');
        });

        // Handle AI response events
        this.socket.on('ai-response', (response) => {
            if (!this.isConnected) return;
            
            console.log('AINodeManager: Received AI response:', response);
            
            // Find the active AI node
            const activeNode = document.querySelector('.node[data-type="ai"].active');
            if (!activeNode) {
                console.log('AINodeManager: No active AI node found');
                return;
            }

            const nodeId = activeNode.id;
            const nodeData = this.nodeSystem.nodes.get(nodeId);
            
            // Clean up the response to ensure it's just the code
            let cleanResponse = response.trim();
            
            // Remove CODE markers if present
            if (cleanResponse.startsWith('CODE')) {
                cleanResponse = cleanResponse.substring(4);
            }
            if (cleanResponse.endsWith('CODE')) {
                cleanResponse = cleanResponse.substring(0, cleanResponse.length - 4);
            }
            
            // Remove code block markers (```) if present
            cleanResponse = cleanResponse.replace(/^```\w*\n/, ''); // Remove opening ```
            cleanResponse = cleanResponse.replace(/\n```$/, '');    // Remove closing ```
            
            cleanResponse = cleanResponse.trim();
            
            // Update the response text box
            const responseDiv = activeNode.querySelector('.ai-response');
            if (responseDiv) {
                responseDiv.textContent = cleanResponse;
                responseDiv.style.display = 'block';
            } else {
                console.log('AINodeManager: No response div found in active node');
            }
            
            // Only update code if in code replacement mode
            if (nodeData.mode === 'code' && nodeData.connectedNodeId) {
                console.log('AINodeManager: Updating code for connected node:', nodeData.connectedNodeId);
                
                // Update the node's code in the system
                const targetNodeData = this.nodeSystem.nodes.get(nodeData.connectedNodeId);
                if (targetNodeData) {
                    // Update the node's code
                    targetNodeData.code = cleanResponse;
                    
                    // Update the editor if it's open
                    if (this.nodeSystem.editorManager) {
                        this.nodeSystem.editorManager.updateNodeCode(nodeData.connectedNodeId, cleanResponse);
                    }
                }
            }
        });

        // Add handler for code updates
        this.socket.on('code-update', (data) => {
            if (!this.isConnected) return;
            
            const { nodeId, code } = data;
            this.handleCodeUpdate(nodeId, code);
        });
    }

    updateConnectionStatus(connected, message = '') {
        // Update the status indicator in all AI nodes
        document.querySelectorAll('.node[data-type="ai"]').forEach(node => {
            const statusIndicator = node.querySelector('.connection-status') || 
                this.createStatusIndicator(node);
            
            // If AI is not available, show disabled status
            if (!this.isAIAvailable) {
                statusIndicator.className = 'connection-status disabled';
                statusIndicator.title = 'AI functionality is disabled - API key not available';
                statusIndicator.style.backgroundColor = 'gray';
            } else {
                statusIndicator.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
                statusIndicator.title = message || (connected ? 'Connected to AI server' : 'Disconnected from AI server');
                statusIndicator.style.backgroundColor = connected ? 'green' : 'red';
            }
            
            // Update the response div with the status message
            const responseDiv = node.querySelector('.ai-response');
            if (responseDiv) {
                if (!this.isAIAvailable) {
                    responseDiv.textContent = 'AI functionality is disabled. Please add OPENAI_API_KEY to your environment variables to enable AI features.';
                    responseDiv.style.display = 'block';
                } else if (!connected) {
                    responseDiv.textContent = message || 'Disconnected from AI server';
                    responseDiv.style.display = 'block';
                } else {
                    responseDiv.textContent = '';
                }
            }
        });
    }

    createStatusIndicator(node) {
        const statusIndicator = document.createElement('div');
        statusIndicator.className = 'connection-status disabled';
        statusIndicator.style.position = 'absolute';
        statusIndicator.style.top = '5px';
        statusIndicator.style.right = '5px';
        statusIndicator.style.width = '10px';
        statusIndicator.style.height = '10px';
        statusIndicator.style.borderRadius = '50%';
        statusIndicator.style.backgroundColor = 'gray';
        statusIndicator.title = 'AI functionality is disabled - API key not available';
        
        node.appendChild(statusIndicator);
        return statusIndicator;
    }

    getNodeTemplate() {
        return `
            <div class="node-header">
                <span>AI tile</span>
                <div class="header-buttons">
                    <button class="expand-button">Edit</button>
                    <button class="mode-toggle-button" title="Toggle between modes">💬</button>
                </div>
            </div>
            <div class="node-content">
                <div class="ai-input-container">
                    <textarea class="ai-input" placeholder="Type your message here..."></textarea>
                    <button class="ai-send-button">Send</button>
                </div>
                <div class="ai-response-container">
                    <div class="ai-response" style="
                        margin-top: 10px;
                        padding: 10px;
                        background: #1e1e1e;
                        color: #fff;
                        border-radius: 4px;
                        min-height: 100px;
                        max-height: 200px;
                        overflow-y: auto;
                        white-space: pre-wrap;
                        font-family: monospace;
                        user-select: text;
                    "></div>
                    <button class="copy-button" title="Copy to clipboard">📋</button>
                </div>
            </div>
            <div class="node-ports">
                <div class="input-port"></div>
                <div class="output-port"></div>
            </div>`;
    }

    initializeAI(node) {
        const input = node.querySelector('.ai-input');
        const sendButton = node.querySelector('.ai-send-button');
        const responseDiv = node.querySelector('.ai-response');
        const modeToggle = node.querySelector('.mode-toggle-button');
        const copyButton = node.querySelector('.copy-button');
        
        // Add mode state to node data
        const nodeData = this.nodeSystem.nodes.get(node.id);
        nodeData.mode = 'code'; // Default to code replacement mode

        // Disable input and button if AI is not available
        if (!this.isAIAvailable) {
            input.disabled = true;
            input.placeholder = 'AI functionality is disabled - API key not available';
            sendButton.disabled = true;
            sendButton.textContent = 'Disabled';
            responseDiv.textContent = 'AI functionality is disabled. Please add OPENAI_API_KEY to your environment variables to enable AI features.';
            responseDiv.style.display = 'block';
        }

        // Add click handler to make this node active
        node.addEventListener('click', () => {
            // Remove active class from all AI nodes
            document.querySelectorAll('.node[data-type="ai"]').forEach(n => {
                n.classList.remove('active');
            });
            // Add active class to this node
            node.classList.add('active');
        });

        // Add mode toggle handler
        modeToggle.addEventListener('click', () => {
            if (!this.isAIAvailable) {
                return; // Don't allow mode changes if AI is disabled
            }
            
            const nodeData = this.nodeSystem.nodes.get(node.id);
            // Cycle through modes: chat -> code -> toggle view -> chat
            if (nodeData.mode === 'chat') {
                nodeData.mode = 'code';
                modeToggle.textContent = '✏️';
                modeToggle.title = 'Code replacement mode (click to switch to toggle view context)';
            } else if (nodeData.mode === 'code') {
                nodeData.mode = 'toggle';
                modeToggle.textContent = '📋';
                modeToggle.title = 'Toggle view context mode (click to switch to chat)';
            } else {
                nodeData.mode = 'chat';
                modeToggle.textContent = '💬';
                modeToggle.title = 'Chat mode (click to switch to code replacement)';
            }
        });

        // Add copy button functionality
        copyButton.addEventListener('click', () => {
            const textToCopy = responseDiv.textContent;
            navigator.clipboard.writeText(textToCopy).then(() => {
                // Show feedback
                const originalText = copyButton.textContent;
                copyButton.textContent = '✓';
                setTimeout(() => {
                    copyButton.textContent = originalText;
                }, 1000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
            });
        });

        sendButton.addEventListener('click', () => {
            if (!this.isAIAvailable) {
                responseDiv.textContent = 'AI functionality is disabled. Please add OPENAI_API_KEY to your environment variables to enable AI features.';
                responseDiv.style.display = 'block';
                return;
            }

            if (!this.isEnabled || !this.isConnected) {
                responseDiv.textContent = 'AI functionality is disabled. Please enable it using the toolbar.';
                responseDiv.style.display = 'block';
                return;
            }

            const message = input.value.trim();
            if (message) {
                responseDiv.textContent = 'Thinking...';
                
                // Get connected node's code from the AI node's data
                const nodeId = node.id;
                const nodeData = this.nodeSystem.nodes.get(nodeId);
                let context = '';
                
                if (nodeData.mode === 'toggle') {
                    // Get the toggle view code from the editor manager
                    const editorContent = this.nodeSystem.editorManager._editorContent;
                    if (editorContent) {
                        context = `Here is the current state of all tiles in the system:\n${editorContent}`;
                    }
                } else if (nodeData && nodeData.connectedCode) {
                    console.log('AINodeManager: Using stored code from connected node:', nodeData.connectedNodeId);
                    context = `Here is the ${nodeData.connectedNodeType} code that needs to be modified:\n${nodeData.connectedCode}`;
                } else {
                    console.log('AINodeManager: No connected code found');
                }

                // Combine context with user message based on mode
                let fullMessage;
                if (nodeData.mode === 'code') {
                    fullMessage = context ? 
                        `${context}\n\nPlease ${message} this code. Return ONLY the modified code, also include all the code so it can compile, dont skip any code that is essential like percision, starting with the code and ending with the code. Do not include any explanations or other text.` :
                        `${message}\n\nPlease return ONLY the code, starting with the code and ending with the code. Do not include any explanations or other text.`;
                } else if (nodeData.mode === 'toggle') {
                    fullMessage = context ? 
                        `${context}\n\n${message}\n\nPlease return ONLY the code, starting with the code and ending with the code. Do not include any explanations or other text.` :
                        `${message}\n\nPlease return ONLY the code, starting with the code and ending with the code. Do not include any explanations or other text.`;
                } else {
                    // Chat mode - just send the message with context if available
                    fullMessage = context ? 
                        `${context}\n\n${message}` :
                        message;
                }

                console.log('AINodeManager: Sending query with context:', fullMessage);
                this.socket.emit('ai-query', fullMessage);
            }
        });

        // Add Enter key support
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendButton.click();
            }
        });
    }

    handleCodeUpdate(nodeId, newCode) {
        const node = document.getElementById(nodeId);
        if (!node || !node.classList.contains('active')) return;

        const nodeData = this.nodeSystem.nodes.get(nodeId);
        if (!nodeData || !nodeData.connectedNodeId) return;

        // Get the connected node's data
        const connectedNodeData = this.nodeSystem.nodes.get(nodeData.connectedNodeId);
        if (!connectedNodeData) return;

        // Store the new code
        nodeData.connectedCode = newCode;

        // If we have a previous prompt, resend it with the updated code
        const input = node.querySelector('.ai-input');
        if (input && input.value.trim()) {
            // Simulate a click on the send button
            const sendButton = node.querySelector('.ai-send-button');
            if (sendButton) {
                sendButton.click();
            }
        }
    }
}

export default AINodeManager; 