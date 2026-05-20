import { convertToModelMessages } from 'ai';
const messages = [
  {
    "id": "1b3381ee-ee33-45a2-b7b5-388bcef3f7a1",
    "role": "assistant",
    "parts": [
      { "type": "text", "text": "Test" },
      {
        "type": "tool-invocation",
        "toolCallId": "call_123",
        "toolName": "planDocument",
        "args": { "strategy": "test" },
        "result": "Success"
      }
    ]
  }
];

// Mocking convertToModelMessages because it's a bit complex in Vercel AI SDK
// I'll just use the actual project node modules
