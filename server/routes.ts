import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

// Mock embedding generation for simulation mode
// In a real production environment with GPU support, we would use TensorFlow.js or Python backend
function generateMockEmbedding(image: string): number[] {
  // Generate a deterministic but unique-looking vector based on image string length/content
  // This simulates the extraction process
  const hash = image.length; 
  return Array(512).fill(0).map((_, i) => Math.sin(hash + i));
}

function compareEmbeddings(emb1: number[], emb2: number[]): number {
  // Euclidean distance simulation
  let sum = 0;
  for (let i = 0; i < emb1.length; i++) {
    sum += Math.pow(emb1[i] - emb2[i], 2);
  }
  return Math.sqrt(sum);
}

// Simple liveness check simulation
function checkLiveness(image: string): { score: number; isReal: boolean } {
  // In a real system, this would analyze texture, blinking, etc.
  // For simulation, we assume images passed are valid "live" captures unless marked specific way
  // We return a high score to simulate "Live"
  return { score: 0.98, isReal: true }; 
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post(api.auth.enroll.path, async (req, res) => {
    try {
      const { name, role, images } = api.auth.enroll.input.parse(req.body);
      
      // 1. Process images and generate embedding (Average of 5 frames)
      // In simulation: just take the first one's "mock" embedding
      if (images.length === 0) {
        return res.status(400).json({ message: "No images provided" });
      }

      const embedding = generateMockEmbedding(images[0]);
      
      const user = await storage.createUser({
        name,
        role,
        embedding: embedding
      });

      res.status(201).json(user);
    } catch (err) {
      res.status(400).json({ message: "Enrollment failed" });
    }
  });

  app.post(api.auth.verify.path, async (req, res) => {
    try {
      const { image } = api.auth.verify.input.parse(req.body);
      
      // 1. Liveness Detection
      const liveness = checkLiveness(image);
      if (!liveness.isReal) {
        await storage.createLog({
          status: 'spoof',
          spoofScore: liveness.score.toString(),
          timestamp: new Date()
        });
        return res.status(200).json({ 
          verified: false, 
          status: "spoof", 
          message: "Liveness check failed. Fake face detected." 
        });
      }

      // 2. Generate Embedding
      const inputEmbedding = generateMockEmbedding(image);

      // 3. Match against all users (Linear search for MVP)
      const users = await storage.getAllUsers();
      let bestMatch: any = null;
      let minDistance = Infinity;
      const THRESHOLD = 0.5; // Arbitrary threshold for simulation

      for (const user of users) {
        if (!user.embedding) continue;
        const storedEmbedding = user.embedding as number[];
        const dist = compareEmbeddings(inputEmbedding, storedEmbedding);
        
        if (dist < minDistance) {
          minDistance = dist;
          bestMatch = user;
        }
      }

      if (bestMatch && minDistance < THRESHOLD) {
        await storage.createLog({
          userId: bestMatch.id,
          status: 'success',
          spoofScore: liveness.score.toString(),
          timestamp: new Date()
        });
        
        return res.status(200).json({
          verified: true,
          user: bestMatch,
          status: "success"
        });
      } else {
        await storage.createLog({
          status: 'failed',
          spoofScore: liveness.score.toString(),
          timestamp: new Date()
        });

        return res.status(200).json({
          verified: false,
          status: "failed",
          message: "User not recognized"
        });
      }

    } catch (err) {
      res.status(400).json({ message: "Verification failed" });
    }
  });

  app.get(api.logs.list.path, async (req, res) => {
    const logs = await storage.getLogs();
    res.json(logs);
  });

  return httpServer;
}
