# TadaAI - AI Assistant Management Platform

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue)](https://github.com)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

A comprehensive platform for managing AI assistants with OpenAI integration, Firebase authentication, and multi-client support. Features include conversational AI, function calling, disposable conversations, and custom assistant creation.

## Features

- ✅ **Multi-client Management** - Manage multiple clients with isolated assistants
- ✅ **AI Assistant Creation** - Create and configure OpenAI assistants with custom instructions
- ✅ **Function Calling** - Custom function integration for external API calls
- ✅ **Disposable Conversations** - Time-limited conversations with auto-cleanup
- ✅ **Firebase Authentication** - Secure user authentication and authorization
- ✅ **Real-time Database** - Firebase Realtime Database for data persistence
- ✅ **Image Analysis** - GPT-4 Vision integration for product image analysis
- ✅ **RESTful API** - Complete REST API with comprehensive endpoints
- ✅ **TypeScript** - Full type safety and modern development experience

## Technologies

- **Node.js** + **TypeScript**
- **Express.js** - Web framework
- **Firebase** - Authentication and Realtime Database
- **OpenAI API** - GPT models and assistants
- **Axios** - HTTP client for external API calls
- **JWT** - Token-based authentication
- **CORS** - Cross-origin resource sharing

## Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3000

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Firebase Client Configuration
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
FIREBASE_MEASSUREMENT_ID=your_measurement_id

# Firebase Admin Configuration
FIREBASE_ADMIN_TYPE=service_account
FIREBASE_ADMIN_PRIVATE_KEY_ID=your_private_key_id
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key\n-----END PRIVATE KEY-----\n"
FIREBASE_ADMIN_CLIENT_EMAIL=your_service_account@your_project.iam.gserviceaccount.com
FIREBASE_ADMIN_CLIENT_ID=your_client_id
FIREBASE_ADMIN_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_ADMIN_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_ADMIN_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_ADMIN_CLIENT_X509_CERT_URL=your_cert_url
FIREBASE_ADMIN_UNIVERSE_DOMAIN=googleapis.com

# Optional: External APIs
WIT_API_KEY=your_wit_ai_key_for_name_extraction
```

### 3. Run in Development

```bash
npm run dev
```

### 4. Build for Production

```bash
npm run build
npm start
```

The API will be available at `http://localhost:3000`

## API Documentation

### Authentication

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your_password"
}
```

**Response:**
```json
{
  "token": "firebase_id_token"
}
```

### Client Management

#### Create Client
```http
POST /api/clients
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Client Name",
  "email": "client@example.com",
  "plan": "basic",
  "webhookUrl": "https://client-webhook.com/endpoint"
}
```

#### List Clients
```http
GET /api/clients
Authorization: Bearer <token>
```

#### Get Client Details
```http
GET /api/clients/{clientId}
Authorization: Bearer <token>
```

### Assistant Management

#### Create Assistant for Client
```http
POST /api/clients/{clientId}/assistants
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Sales Assistant",
  "instructions": "You are a helpful sales assistant...",
  "description": "Assists with product sales and customer queries",
  "model": "gpt-4-turbo",
  "tools": ["code_interpreter"],
  "customFunctions": [
    {
      "name": "search_products",
      "description": "Search for products in inventory",
      "parameters": {
        "type": "object",
        "properties": {
          "category": {"type": "string"},
          "max_price": {"type": "number"},
          "available": {"type": "boolean"}
        }
      },
      "endpoint": "https://your-api.com/products/search",
      "method": "POST",
      "headers": {
        "Authorization": "Bearer your-api-key"
      }
    }
  ]
}
```

#### List Client Assistants
```http
GET /api/clients/{clientId}/assistants
Authorization: Bearer <token>
```

### Conversational AI

#### Chat with Assistant (Traditional)
```http
POST /api/chat/assistant
Content-Type: application/json

{
  "message": "Hello, can you help me find a smartphone?",
  "thread": "thread_id",
  "assistant": "assistant_id",
  "clientId": "client_id",
  "assistantId": "local_assistant_id"
}
```

#### Start Disposable Conversation
```http
POST /api/clients/{clientId}/conversations/start
Content-Type: application/json

{
  "assistantId": "local_assistant_id",
  "externalUserId": "user_123",
  "expiresIn": 60,
  "maxMessages": 50
}
```

#### Send Message in Disposable Conversation
```http
POST /api/clients/{clientId}/conversations/{conversationId}/message
Content-Type: application/json

{
  "message": "I'm looking for a laptop under $1000"
}
```

### Function Calling

#### Execute Custom Function
```http
POST /api/functions/execute/{clientId}/{assistantId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "functionName": "search_products",
  "arguments": {
    "category": "electronics",
    "max_price": 1000,
    "available": true
  }
}
```

### Utility Endpoints

#### Extract First Name
```http
GET /api/names/extract-first-name/{string}
```

#### Thread Management
```http
POST /api/thread
Authorization: Bearer <token>
Content-Type: application/json

{
  "assistant": "assistant_id"
}
```

## Built-in Functions

The platform includes several built-in functions that can be used by assistants:

### Product Search (`buscar_produtos`)
Searches for products with filtering capabilities.

**Parameters:**
- `categoria` (string): Product category
- `preco_max` (number): Maximum price
- `disponivel` (boolean): Availability filter
- `palavra_chave` (string): Keyword search

### Stock Verification (`verificar_estoque`)
Checks product stock levels.

**Parameters:**
- `produto_id` (number): Product ID
- `produto_nome` (string): Product name

### Image Analysis (`analisar_imagem_produto`)
Analyzes product images using GPT-4 Vision and finds similar products.

**Parameters:**
- `imagem_url` (string): Image URL to analyze
- `buscar_similares` (boolean): Whether to search for similar products

## Project Structure

```
├── routes/
│   ├── assistant.ts          # OpenAI assistant management
│   ├── auth.ts              # Firebase authentication
│   ├── chat.ts              # Chat endpoints with function calling
│   ├── clients.ts           # Client management
│   ├── client-assistants.ts # Client-specific assistants
│   ├── conversations.ts     # Disposable conversations
│   ├── function-calling.ts  # Custom function execution
│   ├── names.ts            # Name extraction utilities
│   ├── thread.ts           # Thread management
│   └── index.ts            # Route aggregation
├── middlewares/
│   ├── authentication.ts   # Firebase token verification
│   └── authorization.ts    # Role-based access control
├── types/
│   └── database.ts         # TypeScript interfaces
├── firebase.ts             # Firebase configuration
├── express.d.ts           # Express type extensions
├── envConfig.ts           # Environment configuration
└── server.ts              # Main server file
```

## Database Structure

The platform uses Firebase Realtime Database with the following structure:

```json
{
  "clients": {
    "client_id": {
      "info": {
        "name": "Client Name",
        "email": "client@example.com",
        "plan": "basic",
        "status": "active",
        "createdAt": 1234567890
      },
      "assistants": {
        "assistant_id": {
          "openaiAssistantId": "asst_...",
          "name": "Assistant Name",
          "instructions": "...",
          "model": "gpt-4-turbo",
          "tools": ["code_interpreter"],
          "customFunctions": [...],
          "status": "active",
          "createdAt": 1234567890
        }
      },
      "conversations": {
        "conversation_id": {
          "threadId": "thread_...",
          "assistantId": "asst_...",
          "externalUserId": "user_123",
          "status": "active",
          "startedAt": 1234567890,
          "autoDeleteAt": 1234567890,
          "messageCount": 5,
          "maxMessages": 50
        }
      }
    }
  },
  "threads": {
    "thread_uuid": {
      "threadId": "thread_...",
      "assistantId": "asst_...",
      "createdAt": 1234567890
    }
  }
}
```

## Key Features Explained

### Disposable Conversations
- **Time-limited**: Conversations automatically expire after a set duration
- **Message limits**: Maximum number of messages per conversation
- **Auto-cleanup**: Expired conversations are automatically cleaned up
- **External user mapping**: Link conversations to external user IDs (e.g., ManyChat)

### Function Calling
- **Custom functions**: Define custom functions that assistants can call
- **External API integration**: Call external APIs with authentication
- **Built-in functions**: Pre-built functions for common e-commerce operations
- **Error handling**: Robust error handling for failed function calls

### Multi-client Support
- **Isolated environments**: Each client has isolated assistants and data
- **Different plans**: Support for basic, premium, and enterprise plans
- **Custom configurations**: Client-specific assistant configurations

## Security

- **Firebase Authentication**: Secure user authentication with JWT tokens
- **Token verification**: Middleware for token validation with timeout
- **Role-based access**: Authorization middleware for different user roles
- **CORS protection**: Configured CORS for specific allowed origins
- **Input validation**: Request validation and sanitization

## Error Handling

The API provides comprehensive error handling with:
- **Structured error responses**: Consistent error format across all endpoints
- **Detailed error messages**: Clear error descriptions for debugging
- **Status codes**: Appropriate HTTP status codes for different error types
- **Logging**: Comprehensive error logging for monitoring

## Development

### Available Scripts

```bash
npm run dev     # Development with hot reload using ts-node-dev
npm run build   # Compile TypeScript to JavaScript
npm start       # Run compiled JavaScript version
npm test        # Run tests (currently placeholder)
```

### CORS Configuration

The server is configured to accept requests from:
- `http://localhost:5173` (Vite dev server)
- `http://localhost:3000` (Local development)
- `https://tadagpt.onrender.com` (Production deployment)
- `https://tadagpt.netlify.app` (Static site deployment)
- `https://tada-gpt-production.up.railway.app` (Railway deployment)

### Environment Variables

All sensitive configuration is handled through environment variables. Ensure you have all required variables set before running the application.

## Deployment

The application is designed to be deployed on various platforms:

- **Railway**: Configured for Railway deployment
- **Render**: Ready for Render deployment  
- **Netlify**: For frontend static site deployment
- **Any Node.js hosting**: Compatible with any Node.js hosting platform

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For support and questions, please contact the development team or create an issue in the repository.