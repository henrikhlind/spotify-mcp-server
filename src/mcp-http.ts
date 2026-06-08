import { randomUUID } from 'node:crypto';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createSpotifyMcpServer, startTokenRefresh } from './mcp-server.js';

const transports: Record<string, WebStandardStreamableHTTPServerTransport> = {};
let tokenRefreshStarted = false;

function ensureTokenRefresh(): void {
  if (!tokenRefreshStarted) {
    startTokenRefresh();
    tokenRefreshStarted = true;
  }
}

function jsonError(status: number, message: string): Response {
  return Response.json(
    {
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message,
      },
      id: null,
    },
    { status },
  );
}

async function handlePost(request: Request): Promise<Response> {
  const body = await request.json();
  const sessionId = request.headers.get('mcp-session-id');
  let transport: WebStandardStreamableHTTPServerTransport | undefined;

  if (sessionId && transports[sessionId]) {
    transport = transports[sessionId];
  } else if (!sessionId && isInitializeRequest(body)) {
    transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (id) => {
        if (transport) {
          transports[id] = transport;
        }
      },
      onsessionclosed: (id) => {
        delete transports[id];
      },
    });

    const server = createSpotifyMcpServer();
    await server.connect(transport);
    return transport.handleRequest(request, { parsedBody: body });
  } else {
    return jsonError(400, 'Bad Request: No valid session ID provided');
  }

  return transport.handleRequest(request, { parsedBody: body });
}

async function handleSessionRequest(request: Request): Promise<Response> {
  const sessionId = request.headers.get('mcp-session-id');
  if (!(sessionId && transports[sessionId])) {
    return jsonError(400, 'Invalid or missing session ID');
  }

  return transports[sessionId].handleRequest(request);
}

export async function handleMcpGet(request: Request): Promise<Response> {
  ensureTokenRefresh();
  return handleSessionRequest(request);
}

export async function handleMcpPost(request: Request): Promise<Response> {
  ensureTokenRefresh();
  return handlePost(request);
}

export async function handleMcpDelete(request: Request): Promise<Response> {
  ensureTokenRefresh();
  return handleSessionRequest(request);
}
