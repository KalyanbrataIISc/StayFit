# StayFit

A Node.js application with Gemini AI integration capabilities. Use this to track your daily calorie intake using natural language. Please go the the setting and add your own Gemini API for uninterupted use.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory and add your environment variables:
```
PORT=3000
# Add your Gemini API key here when ready
# GEMINI_API_KEY=your_api_key_here
```

## Running the Application

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will start on port 3000 by default (or the port specified in your .env file).

## API Endpoints

- `GET /`: Welcome message
- `GET /health`: Health check endpoint

## Features to be Added

- Gemini AI integration
- User authentication
- More API endpoints 
