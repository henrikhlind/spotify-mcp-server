export async function GET(): Promise<Response> {
  return Response.json({
    status: 'ok',
    service: 'spotify-mcp-server',
    mcp: '/api/mcp',
  });
}
