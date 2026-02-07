import { z } from 'zod';
import { insertUserSchema, users, logs } from './schema';

export const api = {
  auth: {
    enroll: {
      method: 'POST' as const,
      path: '/api/enroll' as const,
      input: z.object({
        name: z.string(),
        role: z.enum(['admin', 'manager', 'employee', 'guest']),
        images: z.array(z.string())
      }),
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: z.object({ message: z.string() })
      }
    },
    verify: {
      method: 'POST' as const,
      path: '/api/verify' as const,
      input: z.object({
        image: z.string()
      }),
      responses: {
        200: z.object({
          verified: z.boolean(),
          user: z.custom<typeof users.$inferSelect>().optional(),
          status: z.string(),
          message: z.string().optional()
        }),
        401: z.object({ message: z.string() })
      }
    }
  },
  logs: {
    list: {
      method: 'GET' as const,
      path: '/api/logs' as const,
      responses: {
        200: z.array(z.custom<typeof logs.$inferSelect>())
      }
    }
  }
};
