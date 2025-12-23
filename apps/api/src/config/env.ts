// Environment configuration
export const env = {
  // Server
  PORT: process.env.PORT || "3001",
  NODE_ENV: process.env.NODE_ENV || "development",
  
  // Frontend URL for CORS
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL || "",
  
  // Google OAuth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  
  // Better Auth
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || "",
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "http://localhost:3001",
  
  // Google AI (for Mastra agent)
  GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY || "",
} as const;

export function validateEnv() {
  const required = [
    "DATABASE_URL",
    "GOOGLE_CLIENT_ID", 
    "GOOGLE_CLIENT_SECRET",
    "BETTER_AUTH_SECRET",
    "GOOGLE_GENERATIVE_AI_API_KEY",
  ];
  
  const missing = required.filter((key) => !env[key as keyof typeof env]);
  
  if (missing.length > 0 && env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  
  return true;
}
