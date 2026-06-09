import { timingSafeEqual } from 'node:crypto';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createSpotifyMcpServer, startTokenRefresh } from './mcp-server.js';

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

async function handleStatelessRequest(request: Request, parsedBody?: unknown): Promise<Response> {
    const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
    });

    const server = createSpotifyMcpServer();
    await server.connect(transport);
    return transport.handleRequest(request, parsedBody !== undefined ? { parsedBody } : undefined);
}

async function handlePost(request: Request): Promise<Response> {
    const body = await request.json();
    return handleStatelessRequest(request, body);
}

async function handleSessionRequest(request: Request): Promise<Response> {
    return handleStatelessRequest(request);
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
