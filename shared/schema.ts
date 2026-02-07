import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(), // 'admin', 'manager', 'employee', 'guest'
  embedding: jsonb("embedding"), // Store face descriptor as JSON array
  createdAt: timestamp("created_at").defaultNow(),
});

export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"), // Can be null if unknown user
  timestamp: timestamp("timestamp").defaultNow(),
  status: text("status").notNull(), // 'success', 'failed', 'spoof'
  spoofScore: text("spoof_score"), // Store as text to preserve precision if needed
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertLogSchema = createInsertSchema(logs).omit({ id: true, timestamp: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Log = typeof logs.$inferSelect;
export type InsertLog = z.infer<typeof insertLogSchema>;

// Request types
export type EnrollRequest = {
  name: string;
  role: string;
  images: string[]; // Base64 images
};

export type VerifyRequest = {
  image: string; // Base64 image
};

export type VerifyResponse = {
  verified: boolean;
  user?: User;
  status: string;
  message?: string;
};
