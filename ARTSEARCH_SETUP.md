# ArtSearch API Integration Setup

This project now includes integration with the ArtSearch API to display artwork images in the diff visualization. When Claude generates an art reference for a shader, the system will automatically search for and display the corresponding artwork image.

## Setup Instructions

### 1. Get an ArtSearch API Key

1. Visit [ArtSearch.io](https://api.artsearch.io/)
2. Sign up for an account
3. Get your API key from the dashboard

### 2. Configure Environment Variables

Create a `.env` file in the project root (if it doesn't exist) and add your ArtSearch API key:

```bash
# ArtSearch API Key
ARTSEARCH_API=your_actual_api_key_here

# Other existing environment variables (if any)
# OPENAI_API_KEY=your_openai_api_key_here
# ANTHROPIC_API_KEY=your_anthropic_api_key_here
# DATABASE_URL=your_database_url_here
```

### 3. Restart the Server

After adding the API key, restart the development server:

```bash
npm run dev
```

## How It Works

### Enhanced Artwork Generation with ArtSearch Integration

1. **Shader Analysis**: When a shader diff is saved, the system analyzes the shader code for visual characteristics (colors, patterns, styles, etc.)
2. **ArtSearch Suggestions**: The system searches ArtSearch for relevant artworks based on the shader's visual characteristics
3. **AI-Guided Selection**: Claude receives a list of actual, searchable artworks and chooses the most relevant one
4. **Guaranteed Matches**: Since Claude chooses from artworks that exist in ArtSearch, the generated references are always findable
5. **Visual Display**: The selected artwork image is stored with the diff and displayed in the visualization

### Display Locations

- **Diff Nodes**: Artwork images appear as circular thumbnails above each diff node
- **Detail Panel**: Full artwork images are shown in the diff details panel
- **Tooltips**: Hover over artwork images to see the artwork title

### API Endpoints

- `POST /api/artsearch/find-artwork` - Search for artwork by art reference
- `POST /api/artsearch/suggest` - Get artwork suggestions for a shader based on visual characteristics
- `GET /api/artsearch/test` - Test the ArtSearch API connection
- The system automatically calls these endpoints when generating art references

### Fallback Behavior

- If no artwork is found, a placeholder emoji (🎨) is displayed
- If the API is unavailable, the system gracefully degrades without artwork images
- Existing diffs without artwork images will show the placeholder

## Example Usage

When you modify a shader and save a diff, the system will:

1. **Analyze your shader** for visual characteristics (e.g., red waves, abstract noise, geometric shapes)
2. **Search ArtSearch** for relevant artworks (e.g., "The Wave" by Hokusai, "Composition II" by Mondrian)
3. **Present suggestions to Claude** with actual artwork titles from the database
4. **Generate precise references** like "The Wave by Katsushika Hokusai" (guaranteed to exist in ArtSearch)
5. **Display the artwork image** in the diff visualization
6. **Store the artwork URL** for future use

### Shader Analysis Examples

- **Red wave shader** → Suggests: "The Wave" by Hokusai, wave paintings by Monet
- **Abstract noise shader** → Suggests: Works by Pollock, Rothko, Kandinsky
- **Geometric circles shader** → Suggests: Works by Mondrian, Malevich, Albers

## Troubleshooting

### API Key Issues
- Ensure your `.env` file is in the project root
- Verify the API key is correct and active
- Check that the server was restarted after adding the key

### No Artwork Found
- The ArtSearch database may not have the specific artwork
- Try different art references or more famous artworks
- The system will gracefully handle missing artwork

### Performance
- Artwork images are cached after first load
- API calls are only made when generating new art references
- The system uses efficient search strategies to find relevant artwork
