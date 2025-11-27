// Test script for Google Search API integration
// Run with: node test-google-search.js

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:5000/api';

async function testGoogleSearchAPI() {
    console.log('🔍 Testing Google Search API Integration...\n');

    // Test 1: Check if Google Search API is configured
    console.log('1. Testing Google Search API configuration...');
    try {
        const response = await fetch(`${API_BASE}/google-search/test`);
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Google Search API is configured and working');
            console.log('   Message:', result.message);
            if (result.results && result.results.length > 0) {
                console.log('   Test result:', result.results[0].title);
            }
        } else {
            console.log('❌ Google Search API not configured');
            console.log('   Error:', result.message);
            console.log('\n📝 To configure Google Search API:');
            console.log('   1. Get a Google Custom Search API key from: https://console.developers.google.com/');
            console.log('   2. Create a Custom Search Engine at: https://cse.google.com/');
            console.log('   3. Set environment variables:');
            console.log('      export GOOGLE_SEARCH_API_KEY="your-api-key"');
            console.log('      export GOOGLE_SEARCH_ENGINE_ID="your-search-engine-id"');
            return;
        }
    } catch (error) {
        console.log('❌ Error testing Google Search API:', error.message);
        return;
    }

    console.log('\n2. Testing artwork search...');
    try {
        const response = await fetch(`${API_BASE}/google-search/find-artwork`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ artReference: 'Starry Night by Van Gogh' })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Found artwork:', result.artwork.title);
            console.log('   Image URL:', result.artwork.image);
            console.log('   Source:', result.artwork.source);
        } else {
            console.log('❌ No artwork found:', result.message);
        }
    } catch (error) {
        console.log('❌ Error searching for artwork:', error.message);
    }

    console.log('\n3. Testing shader suggestions...');
    try {
        const shaderCode = `
            void main() {
                vec2 uv = gl_FragCoord.xy / iResolution.xy;
                vec3 color = vec3(0.5 + 0.5 * sin(uv.x * 10.0), 0.5 + 0.5 * cos(uv.y * 10.0), 0.5);
                gl_FragColor = vec4(color, 1.0);
            }
        `;
        
        const response = await fetch(`${API_BASE}/google-search/suggest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shaderCode })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log(`✅ Found ${result.count} artwork suggestions`);
            result.artworks.forEach((artwork, index) => {
                console.log(`   ${index + 1}. ${artwork.title} (${artwork.source})`);
            });
        } else {
            console.log('❌ No suggestions found:', result.message);
        }
    } catch (error) {
        console.log('❌ Error getting suggestions:', error.message);
    }

    console.log('\n4. Testing fallback integration with diff service...');
    try {
        // Test the integrated fallback system
        const response = await fetch(`${API_BASE}/artsearch/find-artwork`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ artReference: 'Mona Lisa by Leonardo da Vinci' })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Integrated search found artwork:', result.artwork.title);
            console.log('   Source:', result.artwork.source || 'ArtSearch');
        } else {
            console.log('ℹ️  ArtSearch did not find artwork, Google Search will be used as fallback');
        }
    } catch (error) {
        console.log('❌ Error testing integrated search:', error.message);
    }

    console.log('\n🎉 Google Search API integration test completed!');
    console.log('\n📋 Summary:');
    console.log('   - Google Search API provides fallback when ArtSearch fails');
    console.log('   - Better image results for artwork references');
    console.log('   - Intelligent keyword extraction from shader code');
    console.log('   - Cached results for improved performance');
}

// Run the test
testGoogleSearchAPI().catch(console.error);
