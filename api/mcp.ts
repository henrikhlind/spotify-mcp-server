import {
  handleMcpDelete,
  handleMcpGet,
  handleMcpPost,
} from '../src/mcp-http.js';

export const config = {
  maxDuration: 60,
};

export const GET = handleMcpGet;
export const POST = handleMcpPost;
export const DELETE = handleMcpDelete;
