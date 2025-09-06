interface GoogleSearchResult {
  title: string;
  link: string;
  snippet: string;
  pagemap?: {
    cse_image?: Array<{
      src: string;
    }>;
    cse_thumbnail?: Array<{
      src: string;
      width: string;
      height: string;
    }>;
  };
}

interface GoogleSearchResponse {
  items?: GoogleSearchResult[];
  searchInformation?: {
    totalResults: string;
  };
}

interface ArtworkResult {
  title: string;
  image: string;
  source: string;
  snippet?: string;
}

class GoogleSearchService {
  private apiKey: string | null = null;
  private searchEngineId: string | null = null;

  constructor() {
    this.apiKey = process.env.GOOGLE_SEARCH_API_KEY || null;
    this.searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID || null;
  }

  isAvailable(): boolean {
    return !!(this.apiKey && this.searchEngineId);
  }

  private async searchImages(query: string, numResults: number = 5): Promise<ArtworkResult[]> {
    if (!this.isAvailable()) {
      throw new Error('Google Search API not configured. Please add GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID to your environment variables.');
    }

    try {
      const searchQuery = `${query} artwork painting`;
      const url = `https://www.googleapis.com/customsearch/v1?key=${this.apiKey}&cx=${this.searchEngineId}&q=${encodeURIComponent(searchQuery)}&searchType=image&num=${numResults}&safe=medium`;

      console.log('Google Search: Searching for:', searchQuery);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Google Search API error: ${response.status} ${response.statusText}`);
      }

      const data: GoogleSearchResponse = await response.json();
      
      if (!data.items || data.items.length === 0) {
        console.log('Google Search: No results found for query:', searchQuery);
        return [];
      }

      const results: ArtworkResult[] = data.items.map((item, index) => ({
        title: this.cleanTitle(item.title),
        image: item.link,
        source: 'Google Search',
        snippet: item.snippet
      }));

      console.log(`Google Search: Found ${results.length} results for query: ${searchQuery}`);
      return results;

    } catch (error) {
      console.error('Google Search API error:', error);
      throw error;
    }
  }

  private cleanTitle(title: string): string {
    // Remove common image file extensions and clean up the title
    return title
      .replace(/\.(jpg|jpeg|png|gif|webp|bmp)$/i, '')
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async findArtworkForReference(artReference: string): Promise<ArtworkResult | null> {
    try {
      console.log('Google Search: Finding artwork for reference:', artReference);
      
      const results = await this.searchImages(artReference, 3);
      
      if (results.length === 0) {
        console.log('Google Search: No artwork found for reference:', artReference);
        return null;
      }

      // Return the first result (most relevant)
      const artwork = results[0];
      console.log('Google Search: Found artwork:', artwork.title);
      
      return artwork;

    } catch (error) {
      console.error('Google Search: Error finding artwork for reference:', error);
      return null;
    }
  }

  async suggestArtworksForShader(shaderCode: string, canvasImage?: string): Promise<ArtworkResult[]> {
    try {
      // Extract keywords from shader code to create search queries
      const keywords = this.extractKeywordsFromShader(shaderCode);
      
      if (keywords.length === 0) {
        console.log('Google Search: No keywords extracted from shader code');
        return [];
      }

      // Create search queries based on keywords
      const queries = this.generateSearchQueries(keywords);
      
      const allResults: ArtworkResult[] = [];
      
      // Search for each query and combine results
      for (const query of queries.slice(0, 3)) { // Limit to 3 queries to avoid rate limits
        try {
          const results = await this.searchImages(query, 2);
          allResults.push(...results);
        } catch (error) {
          console.error(`Google Search: Error searching for query "${query}":`, error);
        }
      }

      // Remove duplicates based on image URL
      const uniqueResults = allResults.filter((result, index, self) => 
        index === self.findIndex(r => r.image === result.image)
      );

      console.log(`Google Search: Found ${uniqueResults.length} unique artworks for shader`);
      return uniqueResults.slice(0, 5); // Return max 5 results

    } catch (error) {
      console.error('Google Search: Error suggesting artworks for shader:', error);
      return [];
    }
  }

  private extractKeywordsFromShader(shaderCode: string): string[] {
    // Extract potential art-related keywords from shader code
    const keywords: string[] = [];
    
    // Look for color-related terms
    const colorTerms = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'black', 'white', 'gray', 'rainbow', 'spectrum'];
    colorTerms.forEach(term => {
      if (shaderCode.toLowerCase().includes(term)) {
        keywords.push(term);
      }
    });

    // Look for pattern-related terms
    const patternTerms = ['spiral', 'wave', 'circle', 'square', 'triangle', 'fractal', 'mandala', 'kaleidoscope', 'geometric', 'abstract'];
    patternTerms.forEach(term => {
      if (shaderCode.toLowerCase().includes(term)) {
        keywords.push(term);
      }
    });

    // Look for movement-related terms
    const movementTerms = ['flow', 'swirl', 'rotate', 'pulse', 'oscillate', 'vibrate', 'ripple', 'wave'];
    movementTerms.forEach(term => {
      if (shaderCode.toLowerCase().includes(term)) {
        keywords.push(term);
      }
    });

    // Look for artistic style terms
    const styleTerms = ['impressionist', 'expressionist', 'cubist', 'surreal', 'minimalist', 'abstract', 'realistic', 'pop art'];
    styleTerms.forEach(term => {
      if (shaderCode.toLowerCase().includes(term)) {
        keywords.push(term);
      }
    });

    return [...new Set(keywords)]; // Remove duplicates
  }

  private generateSearchQueries(keywords: string[]): string[] {
    const queries: string[] = [];
    
    // Create queries combining keywords with art terms
    const artTerms = ['artwork', 'painting', 'art', 'artist', 'masterpiece'];
    
    // Single keyword + art term
    keywords.forEach(keyword => {
      artTerms.forEach(artTerm => {
        queries.push(`${keyword} ${artTerm}`);
      });
    });

    // Multiple keywords
    if (keywords.length >= 2) {
      queries.push(keywords.slice(0, 2).join(' '));
    }

    // Famous artists for abstract/geometric patterns
    if (keywords.some(k => ['abstract', 'geometric', 'minimalist'].includes(k))) {
      queries.push('Kandinsky abstract art');
      queries.push('Mondrian geometric art');
      queries.push('Pollock abstract expressionism');
    }

    return queries;
  }

  // Test method to verify API configuration
  async testConnection(): Promise<{ success: boolean; message: string; results?: any }> {
    try {
      if (!this.isAvailable()) {
        return {
          success: false,
          message: 'Google Search API not configured. Please add GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID to your environment variables.'
        };
      }

      const results = await this.searchImages('Van Gogh Starry Night', 1);
      
      return {
        success: true,
        message: 'Google Search API connection successful',
        results: results
      };

    } catch (error) {
      return {
        success: false,
        message: `Google Search API connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

export const googleSearchService = new GoogleSearchService();
