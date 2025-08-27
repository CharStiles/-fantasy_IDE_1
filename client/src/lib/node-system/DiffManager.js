import { fragmentShaders } from '../defaultShaders.js';

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
        this.setupCleanup();
    }

    async saveDiff(nodeId, oldCode, newCode) {
        try {
            const response = await fetch('/api/diffs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ nodeId, oldCode, newCode })
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
                    const response = await fetch(`/api/diffs/${node.diff.id}/regenerate-art`, {
                        method: 'POST'
                    });
                    if (response.ok) {
                        const data = await response.json();
                        node.diff.artReference = data.artReference;
                        artReferenceText.textContent = data.artReference;
                        regenerateButton.remove();
                    }
                } catch (error) {
                    console.error('Error regenerating art reference:', error);
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