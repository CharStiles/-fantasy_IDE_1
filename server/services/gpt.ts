import OpenAI from "openai";
import dotenv from "dotenv";
import { AxiosError } from "axios";

dotenv.config();

console.log("Initializing OpenAI configuration...");
console.log("API Key present:", !!process.env.OPENAI_API_KEY);
console.log("Organization ID present:", !!process.env.OPENAI_ORG_ID);

// Only create OpenAI client if API key is available
let openai: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    organization: process.env.OPENAI_ORG_ID,
  });
}

/**
 * Check if OpenAI API key is available
 * @returns {boolean} - True if API key is present, false otherwise
 */
export function isOpenAIAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY && openai !== null;
}

/**
 * Sends a message to OpenAI's API with exponential backoff retry logic
 * for handling rate limit errors (429)
 * 
 * @param {string} message - The user message to send to OpenAI
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} initialDelay - Initial delay in ms before retrying (default: 1000)
 * @returns {Promise<string>} - The response content from OpenAI
 */
export async function sendMessage(
  message: string,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<string> {
  // Check if API key is available
  if (!isOpenAIAvailable()) {
    throw new Error('OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.');
  }

  if (!openai) {
    throw new Error('OpenAI client not initialized. Please add OPENAI_API_KEY to your environment variables.');
  }

  console.log("Sending message to OpenAI API...");
  console.log("Message length:", message.length);
  console.log("Max retries:", maxRetries);
  console.log("Initial delay:", initialDelay);
  
  let currentRetry = 0;
  
  while (true) {
    try {
      console.log(`Attempt ${currentRetry + 1}/${maxRetries + 1} to send message`);
      
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: 'user', content: message }],
        temperature: 1.2,
        max_tokens: 1900,
      });
      
      console.log("OpenAI API response received successfully");
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
          throw new Error('OpenAI rate limit exceeded after maximum retries');
        }
        
        const delay = initialDelay * Math.pow(2, currentRetry);
        console.log(`Rate limited by OpenAI. Retrying in ${delay}ms... (Attempt ${currentRetry + 1}/${maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        currentRetry++;
      } else {
        console.error('OpenAI API Error:', error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    }
  }
} 