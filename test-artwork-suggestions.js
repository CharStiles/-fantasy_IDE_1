// Test script for ArtSearch artwork suggestions
// Run with: node test-artwork-suggestions.js

async function testArtworkSuggestions() {
    console.log('Testing ArtSearch artwork suggestions...\n');

    const testShaders = [
        {
            name: 'Red Wave Shader',
            code: `
                void main() {
                    vec2 uv = gl_FragCoord.xy / iResolution.xy;
                    float wave = sin(uv.x * 10.0 + iTime) * 0.5 + 0.5;
                    vec3 color = vec3(wave, 0.0, 0.0); // Red wave
                    gl_FragColor = vec4(color, 1.0);
                }
            `
        },
        {
            name: 'Abstract Noise Shader',
            code: `
                float random(vec2 st) {
                    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
                }
                
                void main() {
                    vec2 uv = gl_FragCoord.xy / iResolution.xy;
                    float noise = random(uv * 10.0);
                    vec3 color = vec3(noise, noise * 0.5, noise * 0.8);
                    gl_FragColor = vec4(color, 1.0);
                }
            `
        },
        {
            name: 'Geometric Circles Shader',
            code: `
                void main() {
                    vec2 uv = gl_FragCoord.xy / iResolution.xy;
                    vec2 center = vec2(0.5, 0.5);
                    float dist = distance(uv, center);
                    float circle = step(0.3, dist) - step(0.4, dist);
                    vec3 color = vec3(circle, circle * 0.5, circle * 0.2);
                    gl_FragColor = vec4(color, 1.0);
                }
            `
        }
    ];

    for (const shader of testShaders) {
        console.log(`Testing: ${shader.name}`);
        console.log('Shader code preview:', shader.code.substring(0, 100) + '...');
        
        try {
            const response = await fetch('http://localhost:3000/api/artsearch/suggest', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    shaderCode: shader.code
                })
            });

            const data = await response.json();
            
            if (data.success && data.artworks && data.artworks.length > 0) {
                console.log(`✅ Found ${data.count} suggested artworks:`);
                data.artworks.forEach((artwork, index) => {
                    console.log(`   ${index + 1}. "${artwork.title}" (ID: ${artwork.id})`);
                });
            } else {
                console.log(`❌ No suggestions found: ${data.message || 'No artworks found'}`);
            }
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }
        
        console.log(''); // Empty line for readability
    }

    console.log('Test completed!');
    console.log('\nNow when you create shader diffs, Claude will:');
    console.log('1. Analyze your shader code for visual characteristics');
    console.log('2. Search ArtSearch for relevant artworks');
    console.log('3. Suggest actual, findable artworks to Claude');
    console.log('4. Generate better art references that exist in the database');
}

// Run the test if this file is executed directly
if (typeof window === 'undefined') {
    testArtworkSuggestions().catch(console.error);
}

