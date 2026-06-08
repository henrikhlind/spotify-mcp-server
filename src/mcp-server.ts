import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { albumTools } from './albums.js';
import { playTools } from './play.js';
import { playlistTools } from './playlist.js';
import { readTools } from './read.js';
import { createSpotifyApi } from './utils.js';

export function createSpotifyMcpServer(): McpServer {
  const server = new McpServer({
    name: 'spotify-controller',
    version: '1.0.0',
  });

  [...readTools, ...playTools, ...albumTools, ...playlistTools].forEach(
    (tool) => {
      server.tool(tool.name, tool.description, tool.schema, tool.handler);
    },
  );

  return server;
}

export function startTokenRefresh(): void {
  setInterval(
    async () => {
      try {
        await createSpotifyApi();
      } catch {
        // Errors will surface on the next tool call; nothing actionable here.
      }
    },
    45 * 60 * 1000,
  );
}
