class WebGPUManager {
    constructor(nodeSystem) {
        this.nodeSystem = nodeSystem;
        this.defaultShaderCode = this.getDefaultCode();
        this.mouseX = window.innerWidth / 2;
        this.mouseY = window.innerHeight / 2;

        // Update mouse position
        document.addEventListener('mousemove', (e) => {
            this.mouseX = Math.max(0, Math.min(window.innerWidth, e.clientX));
            this.mouseY = Math.max(0, Math.min(window.innerHeight, e.clientY));
        });
    }

    async initializeWebGPU(node) {
        console.log('Initializing WebGPU for node:', node.id);
        const content = node.querySelector('.node-content');
        const canvas = content.querySelector('canvas');
        if (!canvas) {
            console.error('No canvas found');
            return;
        }

        // Set initial size
        canvas.width = 320;
        canvas.height = 240;
        canvas.style.width = '320px';
        canvas.style.height = '240px';

        // Get WebGPU adapter and device
        if (!navigator.gpu) {
            console.error('WebGPU not supported');
            content.innerHTML = '<div style="color: red; padding: 10px;">WebGPU not supported in this browser</div>';
            return;
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            console.error('No WebGPU adapter found');
            return;
        }

        const device = await adapter.requestDevice();
        const context = canvas.getContext('webgpu');

        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({
            device,
            format,
            alphaMode: 'premultiplied',
        });

        // Create shader module
        const shaderModule = device.createShaderModule({
            code: this.defaultShaderCode
        });

        // Create render pipeline
        const pipeline = device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vertexMain',
                buffers: []
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fragmentMain',
                targets: [{
                    format
                }]
            },
            primitive: {
                topology: 'triangle-list'
            }
        });

        // Create previous frame texture
        const prevFrameTexture = device.createTexture({
            size: [canvas.width, canvas.height],
            format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });

        // Store node data
        const nodeData = this.nodeSystem.nodes.get(node.id);
        if (!nodeData) return;

        nodeData.data = {
            device,
            context,
            pipeline,
            format,
            canvas,
            prevFrameTexture,
            startTime: performance.now()
        };
        nodeData.code = this.defaultShaderCode;

        // Add click handler for expanding
        node.addEventListener('click', (e) => {
            // Don't trigger on header buttons or header area click
            if (e.target.closest('.header-buttons') || e.target.closest('.node-header')) return;
            
            const isExpanded = node.classList.contains('expanded');
            if (!isExpanded) {
                node.classList.add('expanded');
                setTimeout(() => {
                    this.resizeCanvas(node.id, window.innerWidth - 40, window.innerHeight - 40);
                }, 300);
            } else {
                node.classList.remove('expanded');
                this.resizeCanvas(node.id, 320, 240);
            }
        });

        // Add edit button handler
        const editButton = node.querySelector('.expand-button');
        if (editButton) {
            editButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.nodeSystem.editorManager.toggleEditor(node.id, 'webgpu');
            });
        }

        this.startRenderLoop(nodeData);
    }

    startRenderLoop(nodeData) {
        const render = () => {
            const { device, context, pipeline, prevFrameTexture, startTime } = nodeData.data;
            
            const commandEncoder = device.createCommandEncoder();
            const textureView = context.getCurrentTexture().createView();

            const renderPassDescriptor = {
                colorAttachments: [{
                    view: textureView,
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store'
                }]
            };

            const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
            passEncoder.setPipeline(pipeline);

            // Set uniforms
            const time = (performance.now() - startTime) / 1000;
            const mouseX = this.mouseX / window.innerWidth;
            const mouseY = 1.0 - (this.mouseY / window.innerHeight);

            passEncoder.setBindGroup(0, device.createBindGroup({
                layout: pipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: this.createUniformBuffer(device, time) } },
                    { binding: 1, resource: { buffer: this.createUniformBuffer(device, [mouseX, mouseY]) } },
                    { binding: 2, resource: prevFrameTexture.createView() }
                ]
            }));

            passEncoder.draw(6, 1, 0, 0);
            passEncoder.end();

            device.queue.submit([commandEncoder.finish()]);
            requestAnimationFrame(() => render());
        };

        render();
    }

    createUniformBuffer(device, data) {
        // Ensure data is an array
        const dataArray = Array.isArray(data) ? data : [data];
        
        // Calculate the size in bytes
        const size = 4 * dataArray.length; // 4 bytes per float

        // Create the buffer
        const buffer = device.createBuffer({
            size: size,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        // Write the data to the buffer
        device.queue.writeBuffer(buffer, 0, new Float32Array(dataArray));

        return buffer;
    }

    resizeCanvas(nodeId, width, height) {
        const nodeData = this.nodeSystem.nodes.get(nodeId);
        if (!nodeData || !nodeData.data) return;

        const canvas = nodeData.data.canvas;
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
    }

    getDefaultCode() {
        return `
            @group(0) @binding(0) var<uniform> u_time : f32;
            @group(0) @binding(1) var<uniform> u_mouse : vec2<f32>;
            @group(0) @binding(2) var u_prevFrame : texture_2d<f32>;

            @vertex
            fn vertexMain(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4<f32> {
                var pos = array<vec2<f32>, 6>(
                    vec2<f32>( -1.0,  -1.0),
                    vec2<f32>(  1.0,  -1.0),
                    vec2<f32>( -1.0,   1.0),
                    vec2<f32>( -1.0,   1.0),
                    vec2<f32>(  1.0,  -1.0),
                    vec2<f32>(  1.0,   1.0)
                );
                return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
            }

            @fragment
            fn fragmentMain(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
                let uv = fragCoord.xy / vec2<f32>(320.0, 240.0);
                let prevColor = textureLoad(u_prevFrame, vec2<i32>(fragCoord.xy), 0);
				let mouse = vec2<f32>(u_mouse.x, 1.-u_mouse.y);
				let mouseDist = distance(uv, mouse);
                let mouseGlow = 0.1 / (mouseDist + 0.01);

                var color = vec3<f32>(
                    sin(uv.x * 10.0 + u_time) * 0.5 + 0.5,
                    cos(uv.y * 10.0 + u_time) * 0.5 + 0.5,
                    sin(u_time) + 0.5
                );

                let mouseColor = vec3<f32>(1.0, 0.2, 0.0) * mouseGlow;
                color = mix(color, mouseColor, smoothstep(0.2, 0.0, mouseDist));
                color = mix(color, prevColor.rgb, 0.85);

                return vec4<f32>(color, 1.0);
            }
        `;
    }

    updateShader(nodeId, code) {
        const nodeData = this.nodeSystem.nodes.get(nodeId);
        if (!nodeData || !nodeData.data) return;

        const { device } = nodeData.data;

        // Store old code for diff
        const oldCode = nodeData.code || '';

        try {
            // Create new shader module
            const shaderModule = device.createShaderModule({
                code
            });

            // Create new pipeline
            const pipeline = device.createRenderPipeline({
                layout: 'auto',
                vertex: {
                    module: shaderModule,
                    entryPoint: 'vertexMain',
                    buffers: []
                },
                fragment: {
                    module: shaderModule,
                    entryPoint: 'fragmentMain',
                    targets: [{
                        format: nodeData.data.format
                    }]
                },
                primitive: {
                    topology: 'triangle-list'
                }
            });

            // Update node data
            nodeData.data.pipeline = pipeline;
            nodeData.code = code;

            // Save diff if code actually changed and diff functionality is enabled
            if (oldCode !== code && this.nodeSystem.diffManager && this.nodeSystem.diffManager.isDiffEnabled()) {
                this.nodeSystem.diffManager.saveDiff(nodeId, oldCode, code);
            }

        } catch (error) {
            console.error('Error updating WebGPU shader:', error);
        }
    }
}

export default WebGPUManager; 