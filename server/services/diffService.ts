import { storage } from "../storage";
import { sendImageMessage, isAnthropicAvailable } from "./anthropic";

export interface ShaderDiff {
    id: string;
    nodeId: string;
    oldCode: string;
    newCode: string;
    diff: string;
    summary: string;
    artReference: string;
    artworkImage?: string; // URL of the artwork image from ArtSearch
    artworkTitle?: string; // Title of the artwork
    canvasImage?: string; // Base64 encoded canvas screenshot
    canvasImageType?: string; // MIME type of the image
    timestamp: Date;
}

class DiffService {
  private diffs: Map<string, ShaderDiff> = new Map();
  private artworkSuggestionsCache: Map<string, any[]> = new Map(); // Cache for artwork suggestions
  private artworkReferenceCache: Map<string, any> = new Map(); // Cache for artwork references

  async saveDiff(nodeId: string, oldCode: string, newCode: string, canvasImage?: string, canvasImageType?: string): Promise<string> {
    const diff = this.generateDiff(oldCode, newCode);
    const id = `diff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const shaderDiff: ShaderDiff = {
      id,
      nodeId,
      timestamp: new Date(),
      oldCode,
      newCode,
      diff,
      summary: '', // Initialize summary
      artReference: '', // Initialize art reference
      canvasImage,
      canvasImageType,
    };

    this.diffs.set(id, shaderDiff);
    
    // Generate summary using OpenAI
    try {
      shaderDiff.summary = await this.generateSummary(diff, newCode);
    } catch (error) {
      console.error('Failed to generate summary:', error);
      shaderDiff.summary = 'Summary generation failed';
    }

    // Generate art reference using Anthropic if canvas image is available, otherwise use OpenAI
    try {
      if (canvasImage && canvasImageType) {
        shaderDiff.artReference = await this.generateArtReferenceFromImage(canvasImage, canvasImageType, newCode);
      } else {
        shaderDiff.artReference = await this.generateArtReference(newCode);
      }
      
      // Fetch artwork image for the generated art reference
      if (shaderDiff.artReference && shaderDiff.artReference !== 'Art reference generation failed') {
        const artwork = await this.findArtworkForReference(shaderDiff.artReference);
        if (artwork) {
          shaderDiff.artworkImage = artwork.image;
          shaderDiff.artworkTitle = artwork.title;
        }
      }
    } catch (error) {
      console.error('Failed to generate art reference:', error);
      shaderDiff.artReference = 'Art reference generation failed';
    }

    return id;
  }

  // Helper method to get artwork suggestions with caching and fallback
  private async getArtworkSuggestions(newCode: string): Promise<any[]> {
    // Create a simple hash of the shader code for caching
    const codeHash = newCode.replace(/\s+/g, '').substring(0, 100);
    
    // Check cache first
    if (this.artworkSuggestionsCache.has(codeHash)) {
      console.log('Using cached artwork suggestions');
      return this.artworkSuggestionsCache.get(codeHash)!;
    }
    
    let suggestedArtworks: any[] = [];
    
    try {
      // Try ArtSearch first
      const { artSearchService } = await import('./artSearch');
      if (artSearchService.isAvailable()) {
        console.log('Trying ArtSearch for shader suggestions');
        suggestedArtworks = await artSearchService.suggestArtworksForShader(newCode);
        
        if (suggestedArtworks.length > 0) {
          console.log(`ArtSearch found ${suggestedArtworks.length} suggestions`);
        } else {
          console.log('ArtSearch did not find suggestions, trying Google Search...');
        }
      }
      
      // If ArtSearch didn't find anything, try Google Search as fallback
      if (suggestedArtworks.length === 0) {
        const { googleSearchService } = await import('./googleSearch');
        if (googleSearchService.isAvailable()) {
          console.log('Trying Google Search for shader suggestions');
          const googleResults = await googleSearchService.suggestArtworksForShader(newCode);
          
          if (googleResults.length > 0) {
            // Convert Google Search results to match ArtSearch format
            suggestedArtworks = googleResults.map(result => ({
              title: result.title,
              image: result.image,
              source: 'Google Search'
            }));
            console.log(`Google Search found ${suggestedArtworks.length} suggestions`);
          }
        }
      }
      
      // Cache the results
      this.artworkSuggestionsCache.set(codeHash, suggestedArtworks);
      
      // Limit cache size to prevent memory issues
      if (this.artworkSuggestionsCache.size > 50) {
        const firstKey = this.artworkSuggestionsCache.keys().next().value;
        if (firstKey) {
          this.artworkSuggestionsCache.delete(firstKey);
        }
      }
      
      return suggestedArtworks;
    } catch (error) {
      console.log('Could not get artwork suggestions:', error);
      return [];
    }
  }

  // Helper method to find artwork for reference with caching and fallback
  public async findArtworkForReference(artReference: string): Promise<any | null> {
    // Check cache first
    if (this.artworkReferenceCache.has(artReference)) {
      console.log('Using cached artwork reference');
      return this.artworkReferenceCache.get(artReference);
    }
    
    let artwork = null;
    
    try {
      // Try ArtSearch first
      const { artSearchService } = await import('./artSearch');
      if (artSearchService.isAvailable()) {
        console.log('Trying ArtSearch for artwork reference:', artReference);
        artwork = await artSearchService.findArtworkForReference(artReference);
        
        if (artwork) {
          console.log('ArtSearch found artwork:', artwork.title);
        } else {
          console.log('ArtSearch did not find artwork, trying Google Search...');
        }
      }
      
      // If ArtSearch didn't find anything, try Google Search as fallback
      if (!artwork) {
        const { googleSearchService } = await import('./googleSearch');
        if (googleSearchService.isAvailable()) {
          console.log('Trying Google Search for artwork reference:', artReference);
          const googleResult = await googleSearchService.findArtworkForReference(artReference);
          
          if (googleResult) {
            // Convert Google Search result to match ArtSearch format
            artwork = {
              title: googleResult.title,
              image: googleResult.image,
              source: 'Google Search'
            };
            console.log('Google Search found artwork:', artwork.title);
          }
        }
      }
      
      // Cache the result (even if null)
      this.artworkReferenceCache.set(artReference, artwork);
      
      // Limit cache size to prevent memory issues
      if (this.artworkReferenceCache.size > 100) {
        const firstKey = this.artworkReferenceCache.keys().next().value;
        if (firstKey) {
          this.artworkReferenceCache.delete(firstKey);
        }
      }
      
      return artwork;
    } catch (error) {
      console.error('Failed to fetch artwork image:', error);
      return null;
    }
  }

  private generateDiff(oldCode: string, newCode: string): string {
    const oldLines = oldCode.split('\n');
    const newLines = newCode.split('\n');
    const diff: string[] = [];
    
    let i = 0, j = 0;
    while (i < oldLines.length || j < newLines.length) {
      if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
        diff.push(` ${oldLines[i]}`);
        i++;
        j++;
      } else if (j < newLines.length) {
        diff.push(`+${newLines[j]}`);
        j++;
      } else if (i < oldLines.length) {
        diff.push(`-${oldLines[i]}`);
        i++;
      }
    }
    
    return diff.join('\n');
  }

  private async generateSummary(diff: string, newCode: string): Promise<string> {
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.log('OpenAI API key not available, using default summary');
      return 'Shader modified';
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{
            role: 'user',
            content: `Analyze this shader code change and provide a very brief summary in 5-8 words maximum. Focus on the visual change.

Old code:
${diff}

New code:
${newCode}

Summary (5-8 words max):`
          }],
          temperature: 0.7,
          max_tokens: 30
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content.trim() || 'Shader modified';
    } catch (error) {
      console.error('Error generating summary:', error);
      return 'Shader modified';
    }
  }

  public async generateArtReference(newCode: string): Promise<string> {
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.log('OpenAI API key not available, using default art reference');
      return 'Abstract Expressionism by Pollock';
    }

    try {
      // Get artwork suggestions from cache or API
      let artworkSuggestions = '';
      const suggestedArtworks = await this.getArtworkSuggestions(newCode);
      
      if (suggestedArtworks.length > 0) {
        artworkSuggestions = `\n\nHere are some actual artworks from the ArtSearch database that might be relevant:\n`;
        suggestedArtworks.slice(0, 5).forEach((artwork, index) => {
          artworkSuggestions += `${index + 1}. "${artwork.title}"\n`;
        });
        artworkSuggestions += `\nPlease choose one of these artworks or suggest a similar one that exists in art history.`;
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{
            role: 'user',
            content: `This is GLSL shader code. Suggest a famous work of art that it visually or conceptually reminds you of. Consider colors, patterns, movement, or style. 

IMPORTANT: Choose from the suggested artworks below if any are relevant, or suggest a well-known artwork that actually exists in art history. Avoid making up fictional artworks.

Shader code:
${newCode}${artworkSuggestions}

Respond with just the artwork name and artist like "Starry Night by Van Gogh" or "Composition II by Mondrian".`
          }],
          temperature: 0.7,
          max_tokens: 50
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const artRef = data.choices[0].message.content.trim();
      return artRef || 'Abstract Expressionism by Pollock';
    } catch (error) {
      console.error('Error generating art reference:', error);
      return 'Abstract Expressionism by Pollock';
    }
  }

  public async generateArtReferenceFromImage(canvasImage: string, canvasImageType: string, newCode: string): Promise<string> {
    // Check if Anthropic API key is available
    if (!isAnthropicAvailable()) {
      console.log('Anthropic API key not available, falling back to OpenAI');
      return this.generateArtReference(newCode);
    }

    try {
      // Get artwork suggestions from cache or API
      let artworkSuggestions = '';
      const suggestedArtworks = await this.getArtworkSuggestions(newCode);
      
      if (suggestedArtworks.length > 0) {
        artworkSuggestions = `\n\nHere are some actual artworks from the ArtSearch database that might be relevant:\n`;
        suggestedArtworks.slice(0, 5).forEach((artwork, index) => {
          artworkSuggestions += `${index + 1}. "${artwork.title}"\n`;
        });
        artworkSuggestions += `\nPlease choose one of these artworks or suggest a similar one that exists in art history.`;
      }

      const prompt = `This is a screenshot of a GLSL shader visualization. Analyze the visual output and suggest a famous work of art that it visually or conceptually reminds you of. Consider colors, patterns, movement, style, and overall aesthetic. 

IMPORTANT: Choose from the suggested artworks below if any are relevant, or suggest a well-known artwork that actually exists in art history. Avoid making up fictional artworks.

The shader code that generated this image is:
${newCode}${artworkSuggestions}

Respond with just the artwork name and artist like "Starry Night by Van Gogh" or "Composition II by Mondrian".`;

      const response = await sendImageMessage(canvasImage, canvasImageType, prompt);
      return response || 'Abstract Expressionism by Pollock';
    } catch (error) {
      console.error('Error generating art reference from image:', error);
      // Fall back to OpenAI method
      return this.generateArtReference(newCode);
    }
  }

  getDiffsByNode(nodeId: string): ShaderDiff[] {
    return Array.from(this.diffs.values())
      .filter(diff => diff.nodeId === nodeId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getAllDiffs(): ShaderDiff[] {
    return Array.from(this.diffs.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getDiff(id: string): ShaderDiff | undefined {
    return this.diffs.get(id);
  }

  minimizeDiff(id: string): boolean {
    const diff = this.diffs.get(id);
    if (diff) {
      // For now, we'll just mark it as minimized by removing it
      // In a real implementation, you might want to keep it but mark it differently
      this.diffs.delete(id);
      return true;
    }
    return false;
  }

  deleteDiff(id: string): void {
    this.diffs.delete(id);
  }

  loadDiff(id: string): string | null {
    const diff = this.diffs.get(id);
    return diff ? diff.newCode : null;
  }

  // Cleanup method to delete all diffs
  cleanupAllDiffs(): void {
    console.log('Server: Cleaning up all diffs...');
    const diffCount = this.diffs.size;
    this.diffs.clear();
    console.log(`Server: Cleaned up ${diffCount} diffs`);
  }

  // Get total diff count for monitoring
  getDiffCount(): number {
    return this.diffs.size;
  }
}

export const diffService = new DiffService(); 