import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createSpotifyMcpServer, startTokenRefresh } from './mcp-server.js';

startTokenRefresh();

async function main() {
  const server = createSpotifyMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
