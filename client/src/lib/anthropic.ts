import { io, Socket } from 'socket.io-client';

// Socket.IO connection
let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io('http://localhost:5000');
  }
  return socket;
}

// API endpoints
const API_BASE = 'http://localhost:5000/api';

/**
 * Check if Anthropic API is available
 */
export async function checkAnthropicStatus(): Promise<{ available: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE}/ai/status`);
    const data = await response.json();
    return data.anthropic;
  } catch (error) {
    console.error('Error checking Anthropic status:', error);
    return { available: false, message: 'Failed to check Anthropic status' };
  }
}

/**
 * Send text message to Anthropic via REST API
 */
export async function sendTextMessageAPI(
  message: string, 
  model: string = 'claude-opus-4-1-20250805'
): Promise<string> {
  try {
    const response = await fetch(`${API_BASE}/anthropic/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, model }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to send text message');
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Error sending text message:', error);
    throw error;
  }
}

/**
 * Send image message to Anthropic via REST API
 */
export async function sendImageMessageAPI(
  imageBase64: string,
  imageType: string,
  prompt: string = 'Please analyze this image and provide a detailed description.',
  model: string = 'claude-opus-4-1-20250805'
): Promise<string> {
  try {
    const response = await fetch(`${API_BASE}/anthropic/image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageBase64, imageType, prompt, model }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to send image message');
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Error sending image message:', error);
    throw error;
  }
}

/**
 * Send text message to Anthropic via Socket.IO
 */
export function sendTextMessageSocket(
  message: string,
  model: string = 'claude-opus-4-1-20250805',
  onResponse: (response: string) => void,
  onError: (error: string) => void
): void {
  const socket = getSocket();
  
  socket.emit('anthropic-text', { message, model });
  
  socket.once('anthropic-text-response', (response: string) => {
    onResponse(response);
  });
  
  socket.once('error', (error: string) => {
    onError(error);
  });
}

/**
 * Send image message to Anthropic via Socket.IO
 */
export function sendImageMessageSocket(
  imageBase64: string,
  imageType: string,
  prompt: string = 'Please analyze this image and provide a detailed description.',
  model: string = 'claude-opus-4-1-20250805',
  onResponse: (response: string) => void,
  onError: (error: string) => void
): void {
  const socket = getSocket();
  
  socket.emit('anthropic-image', { imageBase64, imageType, prompt, model });
  
  socket.once('anthropic-image-response', (response: string) => {
    onResponse(response);
  });
  
  socket.once('error', (error: string) => {
    onError(error);
  });
}

/**
 * Convert a file to base64 string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data:image/...;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convert canvas to base64 string
 */
export function canvasToBase64(canvas: HTMLCanvasElement, type: string = 'image/png'): string {
  const dataURL = canvas.toDataURL(type);
  return dataURL.split(',')[1];
}

/**
 * Disconnect Socket.IO connection
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
