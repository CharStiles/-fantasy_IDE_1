export interface Artwork {
    id: number;
    title: string;
    image: string;
}

export interface ArtSearchResponse {
    available: number;
    number: number;
    offset: number;
    artworks: Artwork[];
}

export class ArtSearchService {
    private apiKey: string;
    private baseUrl = 'https://api.artsearch.io/artworks';

    constructor() {
        this.apiKey = process.env.ARTSEARCH_API || '';
        if (!this.apiKey) {
            console.warn('ARTSEARCH_API key not found in environment variables');
        } else {
            console.log('ArtSearch API key found:', this.apiKey.substring(0, 8) + '...');
        }
    }

    isAvailable(): boolean {
        return !!this.apiKey;
    }

    async searchArtworks(query: string, options: {
        number?: number;
        type?: string;
        material?: string;
        technique?: string;
        origin?: string;
        earliestStartDate?: number;
        latestStartDate?: number;
        minRatio?: number;
        maxRatio?: number;
    } = {}): Promise<ArtSearchResponse | null> {
        if (!this.apiKey) {
            console.warn('ArtSearch API key not available');
            return null;
        }

        try {
            const params = new URLSearchParams();
            params.append('query', query);
            params.append('api-key', this.apiKey);

            // Add optional parameters
            if (options.number) params.append('number', options.number.toString());
            if (options.type) params.append('type', options.type);
            if (options.material) params.append('material', options.material);
            if (options.technique) params.append('technique', options.technique);
            if (options.origin) params.append('origin', options.origin);
            if (options.earliestStartDate) params.append('earliest-start-date', options.earliestStartDate.toString());
            if (options.latestStartDate) params.append('latest-start-date', options.latestStartDate.toString());
            if (options.minRatio) params.append('min-ratio', options.minRatio.toString());
            if (options.maxRatio) params.append('max-ratio', options.maxRatio.toString());

            const url = `${this.baseUrl}?${params.toString()}`;
            
            console.log(`ArtSearch: Searching for "${query}" with ${params.toString()}`);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'x-api-key': this.apiKey
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`ArtSearch API error: ${response.status} ${response.statusText} - ${errorText}`);
                throw new Error(`ArtSearch API error: ${response.status} ${response.statusText}`);
            }

            const data: ArtSearchResponse = await response.json();
            console.log(`ArtSearch: Found ${data.artworks?.length || 0} artworks for "${query}"`);
            return data;
        } catch (error) {
            console.error('Error searching artworks:', error);
            return null;
        }
    }

    async findArtworkForReference(artReference: string): Promise<Artwork | null> {
        if (!this.apiKey) {
            console.log('ArtSearch: Skipping search - no valid API key');
            return null;
        }

        try {
            console.log(`ArtSearch: Finding artwork for reference: "${artReference}"`);
            
            // Extract artist name from art reference (e.g., "Starry Night by Van Gogh" -> "Van Gogh")
            const artistMatch = artReference.match(/by\s+([^,]+)/i);
            const artist = artistMatch ? artistMatch[1].trim() : '';
            
            // Extract artwork title (e.g., "Starry Night by Van Gogh" -> "Starry Night")
            const titleMatch = artReference.match(/^([^,]+?)\s+by/i);
            const title = titleMatch ? titleMatch[1].trim() : '';

            console.log(`ArtSearch: Extracted artist: "${artist}", title: "${title}"`);

            // Try different search strategies
            const searchQueries = [];
            
            if (artist && title) {
                searchQueries.push(`${title} ${artist}`);
                searchQueries.push(`${artist} ${title}`);
            }
            
            if (artist) {
                searchQueries.push(artist);
            }
            
            if (title) {
                searchQueries.push(title);
            }

            // If no artist/title extracted, use the full reference
            if (searchQueries.length === 0) {
                searchQueries.push(artReference);
            }

            console.log(`ArtSearch: Will try search queries: ${searchQueries.join(', ')}`);

            // Try each search query
            for (const query of searchQueries) {
                console.log(`ArtSearch: Trying query: "${query}"`);
                const result = await this.searchArtworks(query, { number: 5 });
                if (result && result.artworks && result.artworks.length > 0) {
                    console.log(`ArtSearch: Found artwork "${result.artworks[0].title}" for query "${query}"`);
                    // Return the first result
                    return result.artworks[0];
                }
                console.log(`ArtSearch: No results for query "${query}"`);
            }

            console.log(`ArtSearch: No artwork found for reference "${artReference}"`);
            return null;
        } catch (error) {
            console.error('Error finding artwork for reference:', error);
            return null;
        }
    }

    async suggestArtworksForShader(shaderCode: string, canvasImage?: string): Promise<Artwork[]> {
        if (!this.apiKey) {
            console.log('ArtSearch: Skipping artwork suggestion - no valid API key');
            return [];
        }

        try {
            console.log('ArtSearch: Suggesting artworks for shader');
            
            // Analyze the shader code to extract visual characteristics
            const visualCharacteristics = this.analyzeShaderCharacteristics(shaderCode);
            console.log('ArtSearch: Extracted visual characteristics:', visualCharacteristics);
            
            // Build search queries based on visual characteristics
            const searchQueries = this.buildSearchQueriesFromCharacteristics(visualCharacteristics);
            console.log('ArtSearch: Generated search queries:', searchQueries);
            
            const suggestedArtworks: Artwork[] = [];
            const seenIds = new Set<number>();
            
            // Search for artworks using each query
            for (const query of searchQueries) {
                try {
                    console.log(`ArtSearch: Searching for "${query}"`);
                    const result = await this.searchArtworks(query, { number: 3 });
                    
                    if (result && result.artworks) {
                        for (const artwork of result.artworks) {
                            if (!seenIds.has(artwork.id)) {
                                suggestedArtworks.push(artwork);
                                seenIds.add(artwork.id);
                            }
                        }
                    }
                    
                    // Limit to 10 suggestions total
                    if (suggestedArtworks.length >= 10) break;
                    
                } catch (error) {
                    console.log(`ArtSearch: Error searching for "${query}":`, error);
                    continue;
                }
            }
            
            console.log(`ArtSearch: Found ${suggestedArtworks.length} suggested artworks`);
            return suggestedArtworks;
            
        } catch (error) {
            console.error('Error suggesting artworks:', error);
            return [];
        }
    }

    private analyzeShaderCharacteristics(shaderCode: string): string[] {
        const characteristics: string[] = [];
        
        // Convert to lowercase for easier matching
        const code = shaderCode.toLowerCase();
        
        // Color analysis
        if (code.includes('vec3') || code.includes('rgb')) {
            if (code.includes('red') || code.includes('1.0, 0.0, 0.0')) characteristics.push('red');
            if (code.includes('blue') || code.includes('0.0, 0.0, 1.0')) characteristics.push('blue');
            if (code.includes('green') || code.includes('0.0, 1.0, 0.0')) characteristics.push('green');
            if (code.includes('yellow') || code.includes('1.0, 1.0, 0.0')) characteristics.push('yellow');
            if (code.includes('purple') || code.includes('violet')) characteristics.push('purple');
            if (code.includes('orange')) characteristics.push('orange');
            if (code.includes('pink')) characteristics.push('pink');
            if (code.includes('black') || code.includes('0.0, 0.0, 0.0')) characteristics.push('black');
            if (code.includes('white') || code.includes('1.0, 1.0, 1.0')) characteristics.push('white');
        }
        
        // Style analysis
        if (code.includes('noise') || code.includes('random')) characteristics.push('abstract');
        if (code.includes('fractal') || code.includes('mandelbrot')) characteristics.push('fractal');
        if (code.includes('wave') || code.includes('sin') || code.includes('cos')) characteristics.push('wave');
        if (code.includes('circle') || code.includes('sphere')) characteristics.push('geometric');
        if (code.includes('line') || code.includes('stroke')) characteristics.push('line');
        if (code.includes('gradient') || code.includes('lerp')) characteristics.push('gradient');
        if (code.includes('texture') || code.includes('sampler')) characteristics.push('textured');
        if (code.includes('pixel') || code.includes('step')) characteristics.push('pixelated');
        if (code.includes('blur') || code.includes('smooth')) characteristics.push('soft');
        if (code.includes('sharp') || code.includes('edge')) characteristics.push('sharp');
        
        // Movement and animation
        if (code.includes('time') || code.includes('u_time')) characteristics.push('animated');
        if (code.includes('mouse') || code.includes('u_mouse')) characteristics.push('interactive');
        
        // Artistic movements
        if (characteristics.includes('abstract') && characteristics.includes('colorful')) characteristics.push('expressionist');
        if (characteristics.includes('geometric') && characteristics.includes('sharp')) characteristics.push('cubist');
        if (characteristics.includes('wave') && characteristics.includes('soft')) characteristics.push('impressionist');
        if (characteristics.includes('fractal') && characteristics.includes('mathematical')) characteristics.push('mathematical');
        
        // Default characteristics if none found
        if (characteristics.length === 0) {
            characteristics.push('abstract', 'modern', 'contemporary');
        }
        
        return characteristics;
    }

    private buildSearchQueriesFromCharacteristics(characteristics: string[]): string[] {
        const queries: string[] = [];
        
        // Famous artists known for specific styles
        const artistMap: { [key: string]: string[] } = {
            'abstract': ['Kandinsky', 'Pollock', 'Rothko', 'Mondrian'],
            'expressionist': ['Van Gogh', 'Munch', 'Klimt'],
            'impressionist': ['Monet', 'Renoir', 'Degas'],
            'cubist': ['Picasso', 'Braque'],
            'geometric': ['Mondrian', 'Malevich', 'Albers'],
            'surrealist': ['Dali', 'Magritte', 'Ernst'],
            'minimalist': ['Rothko', 'Newman', 'Reinhardt'],
            'colorful': ['Matisse', 'Kandinsky', 'Klee'],
            'mathematical': ['Escher', 'Vasarely'],
            'wave': ['Hokusai', 'Monet'],
            'fractal': ['Escher', 'Vasarely'],
            'modern': ['Warhol', 'Lichtenstein', 'Johns'],
            'contemporary': ['Koons', 'Hirst', 'Basquiat']
        };
        
        // Build queries based on characteristics
        for (const characteristic of characteristics) {
            // Add characteristic as a search term
            queries.push(characteristic);
            
            // Add associated artists
            if (artistMap[characteristic]) {
                for (const artist of artistMap[characteristic]) {
                    queries.push(artist);
                }
            }
        }
        
        // Add some general art terms
        queries.push('painting', 'artwork', 'masterpiece');
        
        // Remove duplicates and limit to 15 queries
        const uniqueQueries = Array.from(new Set(queries)).slice(0, 15);
        
        return uniqueQueries;
    }
}

export const artSearchService = new ArtSearchService();
