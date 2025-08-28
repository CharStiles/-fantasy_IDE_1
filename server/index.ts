import express, { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { Server } from "socket.io";
import { createServer } from "http";
import { sendMessage, isOpenAIAvailable } from "./services/gpt";
import { sendTextMessage, sendImageMessage, isAnthropicAvailable } from "./services/anthropic";
import { diffService } from "./services/diffService";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"]
    }
  });

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    console.log('Socket.IO: Client connected with ID:', socket.id);
    console.log('Socket.IO: Total connected clients:', io.engine.clientsCount);

    socket.on('ai-query', async (message) => {
      try {
        console.log('Socket.IO: Received AI query from client:', socket.id);
        console.log('Socket.IO: Query content:', message);
        
        // Check if OpenAI is available before processing
        if (!isOpenAIAvailable()) {
          socket.emit('ai-response', "AI functionality is disabled. Please add OPENAI_API_KEY to your environment variables to enable AI features.");
          return;
        }
        
        const response = await sendMessage(message);
        console.log('Socket.IO: AI response received:', response);
        
        socket.emit('ai-response', response);
        console.log('Socket.IO: Response sent to client:', socket.id);
      } catch (error) {
        console.error('Socket.IO: Error processing AI query:', error);
        console.error('Socket.IO: Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
        
        // Provide a more specific error message for API key issues
        if (error instanceof Error && error.message.includes('API key not configured')) {
          socket.emit('ai-response', "AI functionality is disabled. Please add OPENAI_API_KEY to your environment variables to enable AI features.");
        } else {
          socket.emit('ai-response', "Sorry, there was an error processing your request.");
        }
      }
    });

    socket.on('anthropic-text', async (data) => {
      try {
        console.log('Socket.IO: Received Anthropic text query from client:', socket.id);
        console.log('Socket.IO: Query content:', data);
        
        const { message, model } = data;
        
        // Check if Anthropic is available before processing
        if (!isAnthropicAvailable()) {
          socket.emit('anthropic-text-response', "Anthropic functionality is disabled. Please add ANTHROPIC_API_KEY to your environment variables to enable AI features.");
          return;
        }
        
        const response = await sendTextMessage(message, model);
        console.log('Socket.IO: Anthropic text response received:', response);
        
        socket.emit('anthropic-text-response', response);
        console.log('Socket.IO: Anthropic text response sent to client:', socket.id);
      } catch (error) {
        console.error('Socket.IO: Error processing Anthropic text query:', error);
        console.error('Socket.IO: Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
        
        // Provide a more specific error message for API key issues
        if (error instanceof Error && error.message.includes('API key not configured')) {
          socket.emit('anthropic-text-response', "Anthropic functionality is disabled. Please add ANTHROPIC_API_KEY to your environment variables to enable AI features.");
        } else {
          socket.emit('anthropic-text-response', "Sorry, there was an error processing your request.");
        }
      }
    });

    socket.on('anthropic-image', async (data) => {
      try {
        console.log('Socket.IO: Received Anthropic image query from client:', socket.id);
        console.log('Socket.IO: Image query data:', { imageType: data.imageType, promptLength: data.prompt?.length });
        
        const { imageBase64, imageType, prompt, model } = data;
        
        // Check if Anthropic is available before processing
        if (!isAnthropicAvailable()) {
          socket.emit('anthropic-image-response', "Anthropic functionality is disabled. Please add ANTHROPIC_API_KEY to your environment variables to enable AI features.");
          return;
        }
        
        const response = await sendImageMessage(imageBase64, imageType, prompt, model);
        console.log('Socket.IO: Anthropic image response received:', response);
        
        socket.emit('anthropic-image-response', response);
        console.log('Socket.IO: Anthropic image response sent to client:', socket.id);
      } catch (error) {
        console.error('Socket.IO: Error processing Anthropic image query:', error);
        console.error('Socket.IO: Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
        
        // Provide a more specific error message for API key issues
        if (error instanceof Error && error.message.includes('API key not configured')) {
          socket.emit('anthropic-image-response', "Anthropic functionality is disabled. Please add ANTHROPIC_API_KEY to your environment variables to enable AI features.");
        } else {
          socket.emit('anthropic-image-response', "Sorry, there was an error processing your request.");
        }
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket.IO: Client disconnected:', socket.id);
      console.log('Socket.IO: Disconnect reason:', reason);
      console.log('Socket.IO: Remaining connected clients:', io.engine.clientsCount);
    });
  });

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 3000
  // this serves both the API and the client
  const port = 3000;
  const serverInstance = httpServer.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });

  // Cleanup on server shutdown
  const cleanup = () => {
    console.log('Server shutting down, cleaning up diffs...');
    diffService.cleanupAllDiffs();
    process.exit(0);
  };

  // Handle graceful shutdown
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
  process.on('exit', () => {
    console.log('Server exiting, cleaning up diffs...');
    diffService.cleanupAllDiffs();
  });

})();
