// Test setup - set environment variables before any modules load
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
process.env.BETTER_AUTH_SECRET = "test-secret-key-for-testing";
process.env.BETTER_AUTH_URL = "http://localhost:3001";
process.env.FRONTEND_URL = "http://localhost:3000";
