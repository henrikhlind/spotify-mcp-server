import { randomUUID, timingSafeEqual } from 'node:crypto';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createSpotifyMcpServer, startTokenRefresh } from './mcp-server.js';

const transports: Record<string, WebStandardStreamableHTTPServerTransport> = {};
let tokenRefreshStarted = false;

function tokensMatch(expected: string, provided: string): boolean {
    if (expected.length !== provided.length) {
        return false;
    }

    return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

function verifyAuth(request: Request): Response | null {
    const expectedToken = process.env.MCP_AUTH_TOKEN;

    if (!expectedToken) {
        if (process.env.VERCEL) {
            return jsonError(503, 'MCP_AUTH_TOKEN is not configured on this deployment');
        }
        return null;
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return jsonError(401, 'Unauthorized');
    }

    const providedToken = authHeader.slice('Bearer '.length);
    if (!tokensMatch(expectedToken, providedToken)) {
        return jsonError(401, 'Unauthorized');
    }

    return null;
}

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

async function withAuth(request: Request, handler: (request: Request) => Promise<Response>): Promise<Response> {
    const authError = verifyAuth(request);
    if (authError) {
        return authError;
    }

    ensureTokenRefresh();
    return handler(request);
}

export async function handleMcpGet(request: Request): Promise<Response> {
    return withAuth(request, handleSessionRequest);
}

export async function handleMcpPost(request: Request): Promise<Response> {
    return withAuth(request, handlePost);
}

export async function handleMcpDelete(request: Request): Promise<Response> {
    return withAuth(request, handleSessionRequest);
}
