import { storage } from "../storage";

export interface ShaderDiff {
    id: string;
    nodeId: string;
    oldCode: string;
    newCode: string;
    diff: string;
    summary: string;
    artReference: string;
    timestamp: Date;
}

class DiffService {
  private diffs: Map<string, ShaderDiff> = new Map();

  async saveDiff(nodeId: string, oldCode: string, newCode: string): Promise<string> {
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
    };

    this.diffs.set(id, shaderDiff);
    
    // Generate summary using OpenAI
    try {
      shaderDiff.summary = await this.generateSummary(diff, newCode);
    } catch (error) {
      console.error('Failed to generate summary:', error);
      shaderDiff.summary = 'Summary generation failed';
    }

    // Generate art reference using OpenAI
    try {
      shaderDiff.artReference = await this.generateArtReference(newCode);
    } catch (error) {
      console.error('Failed to generate art reference:', error);
      shaderDiff.artReference = 'Art reference generation failed';
    }

    return id;
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
            content: `This is GLSL shader code. Suggest a famous work of art that it visually or conceptually reminds you of. Consider colors, patterns, movement, or style. Respond with just the artwork name and artist like "Starry Night by Van Gogh" or "Composition II by Mondrian". If unsure, make up a plausible art reference.

Shader code:
${newCode}

Art reference:`
          }],
          temperature: 0.9,
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