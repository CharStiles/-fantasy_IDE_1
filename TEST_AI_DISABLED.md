# Testing AI Node Disabled Functionality

This document explains how to test the AI node disabled functionality when the OpenAI API key is not available.

## Implementation Summary

The following changes have been made to handle missing API keys gracefully:

### 1. Server-side Changes

**`server/services/gpt.ts`:**
- Added `isOpenAIAvailable()` function to check if API key is present
- Modified OpenAI client initialization to only create when API key is available
- Modified `sendMessage()` to throw an error if API key is missing
- Added proper error handling for missing API keys
- **FIXED**: Server no longer crashes when API key is missing

**`server/index.ts`:**
- Modified AI query handler to check API availability before processing
- Added specific error messages for missing API keys
- Improved error handling for API key issues

**`server/routes.ts`:**
- Added `/api/ai/status` endpoint to check AI availability
- Returns availability status and helpful message

**`server/services/diffService.ts`:**
- Modified `generateSummary()` and `generateArtReference()` to handle missing API keys
- Returns default values instead of making API calls when key is missing

### 2. Client-side Changes

**`client/src/lib/node-system/AINodeManager.js`:**
- Added `checkAIAvailability()` method to check API status on initialization
- Modified constructor to start with AI disabled until availability is confirmed
- Added visual indicators for disabled state (gray status indicator, disabled inputs)
- Updated toolbar integration to disable AI button when not available
- Added proper error messages in UI when AI is disabled

**`client/src/lib/node-system/index.js`:**
- Uncommented AI node manager import and initialization
- Added AI node button to toolbar with conditional availability
- Added `updateToolbar()` method to update button state based on AI availability
- Modified toolbar creation to happen after AI node manager initialization

**`client/src/styles/nodes.css`:**
- Added CSS styles for disabled AI input and button states
- Added styles for disabled connection status indicator

## Testing the Implementation

### Test 1: AI Available (Normal Operation)

1. Ensure `.env` file contains `OPENAI_API_KEY=your_key_here`
2. Start the server: `npm run dev`
3. Check AI status: `curl http://localhost:3000/api/ai/status`
4. Expected response: `{"available":true,"message":"AI functionality is available"}`
5. In the UI, the "Add AI Tile" button should be enabled
6. AI nodes should work normally with green connection status

### Test 2: AI Disabled (Missing API Key) - FIXED

1. Rename `.env` file: `mv .env .env.backup`
2. Restart the server: `pkill -f "tsx server/index.ts" && npm run dev`
3. **VERIFIED**: Server starts without crashing
4. Check AI status: `curl http://localhost:3000/api/ai/status`
5. Expected response: `{"available":false,"message":"AI functionality is disabled. Please add OPENAI_API_KEY to your environment variables."}`
6. In the UI, the "Add AI Tile" button should be disabled (grayed out)
7. If AI nodes exist, they should show:
   - Gray connection status indicator
   - Disabled input field with placeholder text
   - Disabled send button with "Disabled" text
   - Error message in response area
8. **VERIFIED**: Socket.IO connection works properly (no more connection errors)

### Test 3: Diff Service Behavior

1. With API key missing, diff summaries and art references should use default values:
   - Summary: "Shader modified"
   - Art reference: "Abstract Expressionism by Pollock"
2. No API calls should be made to OpenAI

### Test 4: Socket.IO Error Handling

1. With API key missing, AI queries via Socket.IO should return helpful error messages
2. The error message should guide users to add the API key
3. **VERIFIED**: No more Socket.IO connection errors when API key is missing

## Visual Indicators

When AI is disabled:
- **Toolbar button**: Grayed out, disabled, with tooltip explaining the issue
- **AI node status indicator**: Gray circle instead of green/red
- **Input field**: Disabled with placeholder text explaining the issue
- **Send button**: Disabled with "Disabled" text
- **Response area**: Shows error message with instructions

## Error Messages

The implementation provides clear, helpful error messages:
- "AI functionality is disabled. Please add OPENAI_API_KEY to your environment variables to enable AI features."
- "AI functionality is disabled - API key not available"

## Benefits

1. **Graceful degradation**: The application continues to work without AI features
2. **Clear user feedback**: Users understand why AI is disabled and how to enable it
3. **No crashes**: Missing API keys don't cause application errors
4. **Consistent behavior**: All AI-related features are properly disabled
5. **Easy re-enabling**: Simply adding the API key re-enables all AI features
6. **Fixed Socket.IO issues**: No more connection errors when API key is missing

## Recent Fixes

### Server Crash Issue (RESOLVED)
- **Problem**: Server was crashing when OpenAI API key was missing due to unconditional OpenAI client initialization
- **Solution**: Modified `gpt.ts` to only create OpenAI client when API key is available
- **Result**: Server now starts successfully without API key and properly reports AI as disabled

### Socket.IO Connection Error (RESOLVED)
- **Problem**: Socket.IO was failing to connect when server crashed due to missing API key
- **Solution**: Fixed server crash issue above
- **Result**: Socket.IO connections work properly in both enabled and disabled AI states
