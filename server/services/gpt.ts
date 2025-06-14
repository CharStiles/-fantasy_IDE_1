import OpenAI from "openai";
import dotenv from "dotenv";
import { AxiosError } from "axios";

dotenv.config();

// Configuration based on AI_PROVIDER environment variable
const AI_PROVIDER = process.env.AI_PROVIDER || 'openai';

console.log(`Initializing ${AI_PROVIDER} configuration...`);

let openai: OpenAI;
let defaultModel: string;

switch (AI_PROVIDER.toLowerCase()) {
	case 'ollama':
		console.log("Configuring Ollama provider...");
		openai = new OpenAI({
			baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
			apiKey: 'ollama', // required but unused by Ollama
		});
		defaultModel = process.env.OLLAMA_MODEL || 'llama2';
		console.log("Ollama Base URL:", process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1');
		console.log("Ollama Model:", defaultModel);
		break;
	
	case 'openai':
	default:
		console.log("Configuring OpenAI provider...");
		console.log("API Key present:", !!process.env.OPENAI_API_KEY);
		console.log("Organization ID present:", !!process.env.OPENAI_ORG_ID);
		openai = new OpenAI({
			apiKey: process.env.OPENAI_API_KEY,
			organization: process.env.OPENAI_ORG_ID,
		});
		defaultModel = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
		break;
}

/**
 * Sends a message to AI provider (OpenAI or Ollama) with exponential backoff retry logic
 * for handling rate limit errors (429)
 * 
 * @param {string} message - The user message to send to the AI provider
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} initialDelay - Initial delay in ms before retrying (default: 1000)
 * @returns {Promise<string>} - The response content from the AI provider
 */
export async function sendMessage(
  message: string,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<string> {
  console.log(`Sending message to ${AI_PROVIDER} API...`);
  console.log("Message length:", message.length);
  console.log("Max retries:", maxRetries);
  console.log("Initial delay:", initialDelay);
  
  let currentRetry = 0;
  
  while (true) {
    try {
      console.log(`Attempt ${currentRetry + 1}/${maxRetries + 1} to send message`);
      
      const response = await openai.chat.completions.create({
        model: defaultModel,
        messages: [{ role: 'user', content: message }],
        temperature: 1.2,
        max_tokens: 1900,
      });
      
      console.log(`${AI_PROVIDER} API response received successfully`);
      console.log("Response has choices:", !!response.choices);
      console.log("Number of choices:", response.choices?.length);
      
      const content = response.choices[0].message?.content;
      console.log("Response content length:", content?.length);
      
      return content || "No response from AI";
      
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
          throw new Error(`${AI_PROVIDER} rate limit exceeded after maximum retries`);
        }
        
        const delay = initialDelay * Math.pow(2, currentRetry);
        console.log(`Rate limited by ${AI_PROVIDER}. Retrying in ${delay}ms... (Attempt ${currentRetry + 1}/${maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        currentRetry++;
      } else {
        console.error(`${AI_PROVIDER} API Error:`, error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    }
  }
} 