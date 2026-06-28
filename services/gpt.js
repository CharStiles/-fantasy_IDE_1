require('dotenv').config();
const OpenAI = require("openai");

// Configuration based on AI_PROVIDER environment variable
const AI_PROVIDER = process.env.AI_PROVIDER || 'openai';

let openai;
let defaultModel;

switch (AI_PROVIDER.toLowerCase()) {
	case 'ollama':
		openai = new OpenAI({
			baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
			apiKey: 'ollama', // required but unused by Ollama
		});
		defaultModel = process.env.OLLAMA_MODEL || 'llama2';
		break;
	
	case 'openai':
	default:
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
async function sendMessage(message, maxRetries = 3, initialDelay = 1000) {
	let currentRetry = 0;
	
	while (true) {
		try {
			const response = await openai.chat.completions.create({
				model: defaultModel,
				messages: [{ role: 'user', content: message }],
				temperature: 1.2,
				max_tokens: 1900,
			});
			
			// Return the message content from the AI provider
			return response.choices[0].message.content;
			
		} catch (error) {
			// Log the complete error object for debugging
			console.error('Full error object:', error);
			
			// Check if this is a rate limit error (429)
			if (error.response && error.response.status === 429) {
				// Check if we've reached max retries
				if (currentRetry >= maxRetries) {
					console.error(`Rate limit exceeded. Max retries (${maxRetries}) reached.`);
					throw new Error(`${AI_PROVIDER} rate limit exceeded after maximum retries`);
				}
				
				// Calculate delay with exponential backoff: initialDelay * 2^retryAttempt
				const delay = initialDelay * Math.pow(2, currentRetry);
				console.log(`Rate limited by ${AI_PROVIDER}. Retrying in ${delay}ms... (Attempt ${currentRetry + 1}/${maxRetries})`);
				
				// Wait for the calculated delay
				await new Promise(resolve => setTimeout(resolve, delay));
				
				// Increment retry counter
				currentRetry++;
			} else {
				// For other types of errors, log and rethrow
				console.error(`${AI_PROVIDER} API Error:`, error.message);
				
				// Try to log response error info if available
				if (error.response) {
					console.error('Status:', error.response.status);
					console.error('Status Text:', error.response.statusText);
					console.error('Headers:', error.response.headers);
					
					// Safely try to log the data
					try {
						console.error('Response data:', JSON.stringify(error.response.data));
					} catch (e) {
						console.error('Response data available but could not stringify');
					}
				}
				
				throw error;
			}
		}
	}
}

module.exports = sendMessage;