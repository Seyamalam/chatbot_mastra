# Chatbot App

A full-stack AI chatbot application with Google OAuth authentication, conversation memory, and Google integrations (Contacts & Gmail).

## Tech Stack

- **Frontend**: Next.js 16 with TanStack Query
- **Backend**: Hono (Bun runtime)
- **AI**: Mastra with OpenAI GPT-4o-mini
- **Auth**: Better-Auth with Google OAuth
- **Database**: PostgreSQL with Drizzle ORM
- **Memory**: Mastra Memory with semantic recall (PgVector)

## Prerequisites

- [Bun](https://bun.sh/) v1.0+
- [PostgreSQL](https://www.postgresql.org/) 15+ with pgvector extension
- [Google Cloud Console](https://console.cloud.google.com/) project with OAuth credentials
- [OpenAI API Key](https://platform.openai.com/api-keys)

## Project Structure

```
chatbot/
├── apps/
│   ├── api/          # Hono backend with Mastra agent
│   └── web/          # Next.js frontend
├── packages/
│   └── shared/       # Drizzle schema and shared types
└── package.json      # Root workspace config
```

## Setup

### 1. Install Dependencies

```bash
cd chatbot
bun install
```

### 2. Set Up PostgreSQL

Create a PostgreSQL database with the pgvector extension:

```sql
CREATE DATABASE chatbot;
\c chatbot
CREATE EXTENSION IF NOT EXISTS vector;
```

### 3. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Google People API
   - Gmail API
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client IDs**
5. Configure the OAuth consent screen:
   - Add scopes: `email`, `profile`, `contacts.readonly`, `gmail.readonly`
6. Create OAuth client:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3001/api/auth/callback/google`
7. Copy the Client ID and Client Secret

### 4. Configure Environment Variables

Create `.env` file in `apps/api/`:

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env`:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/chatbot"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
BETTER_AUTH_SECRET="generate-a-random-32-char-secret"
BETTER_AUTH_URL="http://localhost:3001"
FRONTEND_URL="http://localhost:3000"
OPENAI_API_KEY="your-openai-api-key"
```

Generate a secure secret for `BETTER_AUTH_SECRET`:
```bash
openssl rand -base64 32
```

### 5. Set Up Database Schema

Push the Drizzle schema to your database:

```bash
cd packages/shared
bun run db:push
```

Mastra will automatically create its tables (`mastra_threads`, `mastra_messages`, etc.) on first run.

## Running the App

### Development Mode

Start both frontend and backend:

```bash
bun run dev
```

Or run them separately:

```bash
# Terminal 1 - Backend (port 3001)
bun run dev:api

# Terminal 2 - Frontend (port 3000)
bun run dev:web
```

### Access the App

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## Usage

1. Open http://localhost:3000
2. Click "Sign in with Google"
3. Authorize the app to access your contacts and emails
4. Start chatting with the AI assistant
5. Ask about your contacts: "Who are my contacts?"
6. Ask about your emails: "What are my recent emails?"

## Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run specific test file
bun test src/__tests__/auth.test.ts
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/chat/stream` | Send message and receive streaming response |
| GET | `/chat/history` | Get conversation history |
| GET | `/api/auth/*` | Better-Auth endpoints |

## Features

- **Streaming Responses**: Real-time AI responses using Server-Sent Events
- **Conversation Memory**: Messages persist across sessions with semantic recall
- **Google Contacts**: Ask the AI about your contacts
- **Google Gmail**: Ask the AI about your recent emails
- **Observability**: Built-in telemetry for debugging and monitoring

## Troubleshooting

### "Google access token not available"
- Ensure you've signed in with Google
- Check that the OAuth scopes include `contacts.readonly` and `gmail.readonly`
- Try signing out and signing back in

### Database connection errors
- Verify PostgreSQL is running
- Check `DATABASE_URL` in your `.env` file
- Ensure the pgvector extension is installed

### OAuth redirect errors
- Verify the redirect URI in Google Cloud Console matches `http://localhost:3001/api/auth/callback/google`
- Check `BETTER_AUTH_URL` is set to `http://localhost:3001`

## License

MIT
