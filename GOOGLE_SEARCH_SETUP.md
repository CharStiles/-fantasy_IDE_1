# Google Search API Setup Guide

This guide will help you set up Google's Programmable Search Engine as a fallback for the ArtSearch API to get better artwork images.

## Why Use Google Search?

- **Better Image Results**: Google's image search often returns higher quality and more relevant artwork images
- **Fallback System**: When ArtSearch doesn't find the right image, Google Search automatically takes over
- **Broader Coverage**: Access to a much larger database of artwork images
- **Intelligent Search**: Better understanding of art references and shader code

## Setup Steps

### 1. Get Google Custom Search API Key

1. Go to [Google Cloud Console](https://console.developers.google.com/)
2. Create a new project or select an existing one
3. Enable the "Custom Search API"
4. Go to "Credentials" → "Create Credentials" → "API Key"
5. Copy your API key

### 2. Create a Custom Search Engine

1. Go to [Google Custom Search Engine](https://cse.google.com/)
2. Click "Add" to create a new search engine
3. In "Sites to search", enter: `*` (to search the entire web)
4. Click "Create"
5. Go to "Setup" → "Basics"
6. Copy your "Search engine ID"

### 3. Configure Image Search

1. In your Custom Search Engine settings
2. Go to "Setup" → "Advanced"
3. Enable "Image search"
4. Set "Safe search" to "Medium" or "Off" (for art content)
5. Save your settings

### 4. Set Environment Variables

Add these to your environment variables:

```bash
export GOOGLE_SEARCH_API_KEY="your-api-key-here"
export GOOGLE_SEARCH_ENGINE_ID="your-search-engine-id-here"
```

Or add them to your `.env` file:

```
GOOGLE_SEARCH_API_KEY=your-api-key-here
GOOGLE_SEARCH_ENGINE_ID=your-search-engine-id-here
```

## Testing the Integration

Run the test script to verify everything is working:

```bash
node test-google-search.js
```

This will test:
- ✅ API configuration
- ✅ Artwork search functionality
- ✅ Shader code suggestions
- ✅ Fallback integration

## How It Works

### Fallback System

1. **Primary**: ArtSearch API tries to find artwork
2. **Fallback**: If ArtSearch fails, Google Search automatically takes over
3. **Caching**: Results are cached to avoid duplicate API calls
4. **Smart Queries**: Keywords are extracted from shader code for better results

### Search Process

```javascript
// Example flow:
1. User creates a shader diff
2. AI generates art reference: "Starry Night by Van Gogh"
3. ArtSearch tries to find the artwork
4. If ArtSearch fails → Google Search finds it
5. Result is cached and displayed
```

### API Endpoints

- `GET /api/google-search/test` - Test API configuration
- `POST /api/google-search/find-artwork` - Find specific artwork
- `POST /api/google-search/suggest` - Get artwork suggestions for shader

## Features

### Intelligent Keyword Extraction

The system analyzes shader code to extract relevant keywords:

- **Colors**: red, blue, green, rainbow, etc.
- **Patterns**: spiral, wave, fractal, geometric, etc.
- **Movement**: flow, swirl, pulse, ripple, etc.
- **Styles**: abstract, impressionist, minimalist, etc.

### Smart Search Queries

Based on extracted keywords, the system generates search queries like:
- "abstract geometric art"
- "Kandinsky abstract art"
- "Mondrian geometric art"
- "rainbow spectrum artwork"

### Result Formatting

Google Search results are automatically converted to match ArtSearch format:

```javascript
{
  title: "Starry Night - Van Gogh",
  image: "https://example.com/starry-night.jpg",
  source: "Google Search"
}
```

## Rate Limits

- **Free Tier**: 100 searches per day
- **Paid Tier**: Up to 10,000 searches per day
- **Caching**: Reduces API calls by caching results

## Troubleshooting

### Common Issues

1. **"API not configured" error**
   - Check your environment variables
   - Verify API key is correct
   - Ensure Custom Search API is enabled

2. **"No results found"**
   - Check your Search Engine ID
   - Verify image search is enabled
   - Try different art references

3. **Rate limit exceeded**
   - Wait for daily limit to reset
   - Consider upgrading to paid tier
   - Check caching is working

### Debug Mode

Enable debug logging by checking the server console for messages like:
```
Google Search: Finding artwork for reference: Starry Night by Van Gogh
Google Search: Found artwork: Starry Night - Van Gogh
```

## Cost Considerations

- **Free Tier**: 100 searches/day (usually sufficient for development)
- **Paid Tier**: $5 per 1,000 queries (for production use)
- **Caching**: Significantly reduces API usage

## Security Notes

- Keep your API key secure
- Don't commit API keys to version control
- Use environment variables for configuration
- Consider IP restrictions for production use

## Integration Benefits

✅ **Better Image Quality**: Higher resolution artwork images  
✅ **Automatic Fallback**: Seamless switching when ArtSearch fails  
✅ **Intelligent Search**: Smart keyword extraction from shader code  
✅ **Performance**: Cached results reduce API calls  
✅ **Reliability**: Multiple data sources for artwork images  

The Google Search integration enhances your Fantasy IDE with more reliable and higher-quality artwork image results! 🎨
