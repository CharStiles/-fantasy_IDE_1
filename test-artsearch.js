// Test script for ArtSearch integration
// Run with: node test-artsearch.js

async function testArtSearch() {
    console.log('Testing ArtSearch API integration...\n');

    const testCases = [
        'Starry Night by Van Gogh',
        'Mona Lisa by Leonardo da Vinci',
        'The Scream by Edvard Munch',
        'Guernica by Pablo Picasso',
        'The Persistence of Memory by Salvador Dali'
    ];

    for (const artReference of testCases) {
        console.log(`Testing: "${artReference}"`);
        
        try {
            const response = await fetch('http://localhost:3000/api/artsearch/find-artwork', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ artReference })
            });

            const data = await response.json();
            
            if (data.success && data.artwork) {
                console.log(`✅ Found: "${data.artwork.title}"`);
                console.log(`   Image URL: ${data.artwork.image}`);
            } else {
                console.log(`❌ Not found: ${data.message || 'No artwork found'}`);
            }
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }
        
        console.log(''); // Empty line for readability
    }

    console.log('Test completed!');
    console.log('\nTo see artwork images in the diff visualization:');
    console.log('1. Add your ARTSEARCH_API key to a .env file');
    console.log('2. Restart the server with: npm run dev');
    console.log('3. Create some shader diffs to see artwork images appear');
}

// Run the test if this file is executed directly
if (typeof window === 'undefined') {
    testArtSearch().catch(console.error);
}
