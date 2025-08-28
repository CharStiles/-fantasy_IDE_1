import React, { useState, useEffect } from 'react';
import { 
  checkAnthropicStatus, 
  sendTextMessageAPI, 
  sendImageMessageAPI,
  sendTextMessageSocket,
  sendImageMessageSocket,
  fileToBase64
} from '../lib/anthropic';

interface AnthropicStatus {
  available: boolean;
  message: string;
}

export const AnthropicDemo: React.FC = () => {
  const [status, setStatus] = useState<AnthropicStatus | null>(null);
  const [textMessage, setTextMessage] = useState('');
  const [textResponse, setTextResponse] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePrompt, setImagePrompt] = useState('Please analyze this image and provide a detailed description.');
  const [imageResponse, setImageResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [useSocket, setUseSocket] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    const anthropicStatus = await checkAnthropicStatus();
    setStatus(anthropicStatus);
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textMessage.trim()) return;

    setLoading(true);
    setTextResponse('');

    try {
      if (useSocket) {
        sendTextMessageSocket(
          textMessage,
          'claude-opus-4-1-20250805',
          (response) => {
            setTextResponse(response);
            setLoading(false);
          },
          (error) => {
            setTextResponse(`Error: ${error}`);
            setLoading(false);
          }
        );
      } else {
        const response = await sendTextMessageAPI(textMessage);
        setTextResponse(response);
        setLoading(false);
      }
    } catch (error) {
      setTextResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setLoading(false);
    }
  };

  const handleImageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) return;

    setLoading(true);
    setImageResponse('');

    try {
      const imageBase64 = await fileToBase64(imageFile);
      const imageType = imageFile.type;

      if (useSocket) {
        sendImageMessageSocket(
          imageBase64,
          imageType,
          imagePrompt,
          'claude-opus-4-1-20250805',
          (response) => {
            setImageResponse(response);
            setLoading(false);
          },
          (error) => {
            setImageResponse(`Error: ${error}`);
            setLoading(false);
          }
        );
      } else {
        const response = await sendImageMessageAPI(imageBase64, imageType, imagePrompt);
        setImageResponse(response);
        setLoading(false);
      }
    } catch (error) {
      setImageResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
    } else {
      alert('Please select a valid image file');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Anthropic Claude API Demo</h1>
        
        {/* Status Check */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">API Status</h2>
          {status ? (
            <div className={`p-3 rounded-md ${status.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {status.message}
            </div>
          ) : (
            <div className="p-3 bg-gray-100 text-gray-800 rounded-md">Checking status...</div>
          )}
          <button 
            onClick={checkStatus}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Refresh Status
          </button>
        </div>

        {/* Connection Type Toggle */}
        <div className="mb-6">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={useSocket}
              onChange={(e) => setUseSocket(e.target.checked)}
              className="rounded"
            />
            <span>Use Socket.IO (instead of REST API)</span>
          </label>
        </div>

        {/* Text Message Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Text Message</h2>
          <form onSubmit={handleTextSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message
              </label>
              <textarea
                value={textMessage}
                onChange={(e) => setTextMessage(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                placeholder="Enter your message for Claude..."
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !textMessage.trim()}
              className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Text Message'}
            </button>
          </form>
          
          {textResponse && (
            <div className="mt-4">
              <h3 className="text-lg font-medium mb-2">Response:</h3>
              <div className="p-4 bg-gray-50 rounded-md whitespace-pre-wrap">
                {textResponse}
              </div>
            </div>
          )}
        </div>

        {/* Image Message Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Image Analysis</h2>
          <form onSubmit={handleImageSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Image File
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
              {imageFile && (
                <p className="mt-2 text-sm text-gray-600">
                  Selected: {imageFile.name} ({(imageFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prompt (optional)
              </label>
              <textarea
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Enter a prompt for image analysis..."
                disabled={loading}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading || !imageFile}
              className="px-6 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Analyzing...' : 'Analyze Image'}
            </button>
          </form>
          
          {imageResponse && (
            <div className="mt-4">
              <h3 className="text-lg font-medium mb-2">Analysis:</h3>
              <div className="p-4 bg-gray-50 rounded-md whitespace-pre-wrap">
                {imageResponse}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
