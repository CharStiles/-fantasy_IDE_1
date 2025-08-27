import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { nodeSchema } from "@shared/schema";
import { diffService } from "./services/diffService";
import { isOpenAIAvailable } from "./services/gpt";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  app.get("/api/nodes", async (_req, res) => {
    const nodes = await storage.getAllNodes();
    res.json(nodes);
  });

  app.post("/api/nodes", async (req, res) => {
    const result = nodeSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    const node = await storage.createNode(result.data);
    res.json(node);
  });

  app.put("/api/nodes/:id", async (req, res) => {
    const result = nodeSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    const node = await storage.updateNode(parseInt(req.params.id), result.data);
    if (!node) {
      res.status(404).json({ error: "Node not found" });
      return;
    }
    res.json(node);
  });

  // AI availability check endpoint
  app.get("/api/ai/status", async (_req, res) => {
    try {
      const isAvailable = isOpenAIAvailable();
      res.json({ 
        available: isAvailable,
        message: isAvailable 
          ? "AI functionality is available" 
          : "AI functionality is disabled. Please add OPENAI_API_KEY to your environment variables."
      });
    } catch (error) {
      res.status(500).json({ 
        available: false,
        error: "Failed to check AI status" 
      });
    }
  });

  // Diff service routes
  app.post("/api/diffs", async (req, res) => {
    try {
      const { nodeId, oldCode, newCode } = req.body;
      if (!nodeId || !oldCode || !newCode) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }
      
      const diffId = await diffService.saveDiff(nodeId, oldCode, newCode);
      res.json({ id: diffId });
    } catch (error) {
      res.status(500).json({ error: "Failed to save diff" });
    }
  });

  app.get("/api/diffs", async (req, res) => {
    try {
      const { nodeId } = req.query;
      const diffs = nodeId 
        ? diffService.getDiffsByNode(nodeId as string)
        : diffService.getAllDiffs();
      res.json(diffs);
    } catch (error) {
      res.status(500).json({ error: "Failed to retrieve diffs" });
    }
  });

  app.get("/api/diffs/:id", async (req, res) => {
    try {
      const diff = diffService.getDiff(req.params.id);
      if (!diff) {
        res.status(404).json({ error: "Diff not found" });
        return;
      }
      res.json(diff);
    } catch (error) {
      res.status(500).json({ error: "Failed to retrieve diff" });
    }
  });

  app.post("/api/diffs/:id/minimize", async (req, res) => {
    try {
      diffService.minimizeDiff(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to minimize diff" });
    }
  });

  app.delete("/api/diffs/:id", async (req, res) => {
    try {
      diffService.deleteDiff(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete diff" });
    }
  });

  app.get("/api/diffs/:id/load", async (req, res) => {
    try {
      const code = diffService.loadDiff(req.params.id);
      if (!code) {
        res.status(404).json({ error: "Diff not found" });
        return;
      }
      res.json({ code });
    } catch (error) {
      res.status(500).json({ error: "Failed to load diff" });
    }
  });

  // Regenerate art reference for a specific diff
  app.post("/api/diffs/:id/regenerate-art", async (req, res) => {
      try {
          const { id } = req.params;
          const diff = diffService.getDiff(id);
          
          if (!diff) {
              return res.status(404).json({ error: 'Diff not found' });
          }

          const artReference = await diffService.generateArtReference(diff.newCode);
          diff.artReference = artReference;
          
          res.json({ success: true, artReference });
      } catch (error) {
          console.error('Error regenerating art reference:', error);
          res.status(500).json({ error: 'Failed to regenerate art reference' });
      }
  });

  return httpServer;
}
