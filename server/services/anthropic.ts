import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import { AxiosError } from "axios";

dotenv.config();

console.log("Initializing Anthropic configuration...");
console.log("API Key present:", !!process.env.ANTHROPIC_API_KEY);
console.log("Organization ID present:", !!process.env.ANTHROPIC_ORG);

// Only create Anthropic client if API key is available
let anthropic: Anthropic | null = null;
if (process.env.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    organization: process.env.ANTHROPIC_ORG,
  });
}

/**
 * Check if Anthropic API key is available
 * @returns {boolean} - True if API key is present, false otherwise
 */
export function isAnthropicAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY && anthropic !== null;
}

/**
 * Sends a text message to Anthropic's Claude API with exponential backoff retry logic
 * for handling rate limit errors (429)
 * 
 * @param {string} message - The user message to send to Claude
 * @param {string} model - The model to use (default: "claude-opus-4-1-20250805")
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} initialDelay - Initial delay in ms before retrying (default: 1000)
 * @returns {Promise<string>} - The response content from Claude
 */
export async function sendTextMessage(
  message: string,
  model: string = "claude-opus-4-1-20250805",
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<string> {
  // Check if API key is available
  if (!isAnthropicAvailable()) {
    throw new Error('Anthropic API key not configured. Please add ANTHROPIC_API_KEY to your environment variables.');
  }

  if (!anthropic) {
    throw new Error('Anthropic client not initialized. Please add ANTHROPIC_API_KEY to your environment variables.');
  }

  console.log("Sending text message to Anthropic API...");
  console.log("Message length:", message.length);
  console.log("Model:", model);
  console.log("Max retries:", maxRetries);
  console.log("Initial delay:", initialDelay);
  
  let currentRetry = 0;
  
  while (true) {
    try {
      console.log(`Attempt ${currentRetry + 1}/${maxRetries + 1} to send text message`);
      
      const response = await anthropic.messages.create({
        model: model,
        max_tokens: 4000,
        messages: [{ role: 'user', content: message }],
      });
      
      console.log("Anthropic API response received successfully");
      console.log("Response has content:", !!response.content);
      console.log("Number of content blocks:", response.content?.length);
      
      const content = response.content[0]?.text;
      console.log("Response content length:", content?.length);
      
      return content || "No response from Claude";
      
    } catch (error: any) {
      console.error('Full error object:', error);
      
      if (error instanceof AxiosError) {
        console.error("Axios error details:", {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          headers: error.response?.headers
        });
      }
      
      if (error instanceof AxiosError && error.response?.status === 429) {
        if (currentRetry >= maxRetries) {
          console.error(`Rate limit exceeded. Max retries (${maxRetries}) reached.`);
          throw new Error('Anthropic rate limit exceeded after maximum retries');
        }
        
        const delay = initialDelay * Math.pow(2, currentRetry);
        console.log(`Rate limited by Anthropic. Retrying in ${delay}ms... (Attempt ${currentRetry + 1}/${maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        currentRetry++;
      } else {
        console.error('Anthropic API Error:', error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    }
  }
}

/**
 * Sends an image with optional text to Anthropic's Claude API with exponential backoff retry logic
 * for handling rate limit errors (429)
 * 
 * @param {string} imageBase64 - Base64 encoded image data (without data:image/... prefix)
 * @param {string} imageType - MIME type of the image (e.g., "image/jpeg", "image/png")
 * @param {string} prompt - Optional text prompt to accompany the image
 * @param {string} model - The model to use (default: "claude-opus-4-1-20250805")
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} initialDelay - Initial delay in ms before retrying (default: 1000)
 * @returns {Promise<string>} - The response content from Claude
 */
export async function sendImageMessage(
  imageBase64: string,
  imageType: string,
  prompt: string = "Please analyze this image and provide a detailed description.",
  model: string = "claude-opus-4-1-20250805",
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<string> {
  // Check if API key is available
  if (!isAnthropicAvailable()) {
    throw new Error('Anthropic API key not configured. Please add ANTHROPIC_API_KEY to your environment variables.');
  }

  if (!anthropic) {
    throw new Error('Anthropic client not initialized. Please add ANTHROPIC_API_KEY to your environment variables.');
  }

  console.log("Sending image message to Anthropic API...");
  console.log("Image type:", imageType);
  console.log("Prompt length:", prompt.length);
  console.log("Model:", model);
  console.log("Max retries:", maxRetries);
  console.log("Initial delay:", initialDelay);
  
  let currentRetry = 0;
  
  while (true) {
    try {
      console.log(`Attempt ${currentRetry + 1}/${maxRetries + 1} to send image message`);
      
      const response = await anthropic.messages.create({
        model: model,
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: imageType,
                  data: imageBase64
                }
              }
            ]
          }
        ],
      });
      
      console.log("Anthropic API response received successfully");
      console.log("Response has content:", !!response.content);
      console.log("Number of content blocks:", response.content?.length);
      
      const content = response.content[0]?.text;
      console.log("Response content length:", content?.length);
      
      return content || "No response from Claude";
      
    } catch (error: any) {
      console.error('Full error object:', error);
      
      if (error instanceof AxiosError) {
        console.error("Axios error details:", {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          headers: error.response?.headers
        });
      }
      
      if (error instanceof AxiosError && error.response?.status === 429) {
        if (currentRetry >= maxRetries) {
          console.error(`Rate limit exceeded. Max retries (${maxRetries}) reached.`);
          throw new Error('Anthropic rate limit exceeded after maximum retries');
        }
        
        const delay = initialDelay * Math.pow(2, currentRetry);
        console.log(`Rate limited by Anthropic. Retrying in ${delay}ms... (Attempt ${currentRetry + 1}/${maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        currentRetry++;
      } else {
        console.error('Anthropic API Error:', error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    }
  }
}
