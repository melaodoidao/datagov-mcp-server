#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosError } from 'axios';

const BASE_URL = 'https://catalog.data.gov/api/3';

/**
 * Arguments for the package_search tool.
 */
interface PackageSearchArgs {
  q?: string;
  sort?: string;
  rows?: number;
  start?: number;
}

/**
 * Checks if the given arguments are valid for the package_search tool.
 * @param args The arguments to validate.
 * @returns True if the arguments are valid, false otherwise.
 */
const isValidPackageSearchArgs = (args: any): args is PackageSearchArgs =>
  typeof args === 'object' &&
  args !== null &&
  (args.q === undefined || typeof args.q === 'string') &&
  (args.sort === undefined || typeof args.sort === 'string') &&
  (args.rows === undefined || typeof args.rows === 'number') &&
  (args.start === undefined || typeof args.start === 'number');

/**
 * Arguments for the package_show tool.
 */
interface PackageShowArgs {
  id: string;
}

/**
 * Checks if the given arguments are valid for the package_show tool.
 * @param args The arguments to validate.
 * @returns True if the arguments are valid, false otherwise.
 */
const isValidPackageShowArgs = (args: any): args is PackageShowArgs =>
  typeof args === 'object' && args !== null && typeof args.id === 'string';

/**
 * Arguments for the group_list tool.
 */
interface GroupListArgs {
  order_by?: string;
  limit?: number;
  offset?: number;
  all_fields?: boolean;
}

/**
 * Checks if the given arguments are valid for the group_list tool.
 * @param args - The arguments to check.
 * @returns True if the arguments are valid, false otherwise.
 */
const isValidGroupListArgs = (args: any): args is GroupListArgs =>
  typeof args === 'object' &&
  args !== null &&
  (args.order_by === undefined || typeof args.order_by === 'string') &&
  (args.limit === undefined || typeof args.limit === 'number') &&
  (args.offset === undefined || typeof args.offset === 'number') &&
  (args.all_fields === undefined || typeof args.all_fields === 'boolean');

/**
 * Arguments for the tag_list tool.
 */
interface TagListArgs {
  query?: string;
  all_fields?: boolean;
}

/**
 * Checks if the given arguments are valid for the tag_list tool.
 * @param args The arguments to validate.
 * @returns True if the arguments are valid, false otherwise.
 */
const isValidTagListArgs = (args: any): args is TagListArgs =>
  typeof args === 'object' &&
  args !== null &&
  (args.query === undefined || typeof args.query === 'string') &&
  (args.all_fields === undefined || typeof args.all_fields === 'boolean');

/**
 * MCP server for interacting with the Data.gov API.
 */
class DataGovServer {
  private server: Server;
  private axiosInstance: any;

  /**
   * Constructs a new DataGovServer instance.
   */
  constructor() {
    this.server = new Server(
      {
        name: 'datagov-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.axiosInstance = axios.create({
      baseURL: BASE_URL,
    });

    this.setupResourceHandlers();
    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * Sets up the resource handlers for the server.
   */
  private setupResourceHandlers() {
    this.server.setRequestHandler(
      ListResourceTemplatesRequestSchema,
      async () => ({
        resourceTemplates: [
          {
            uriTemplate: 'datagov://resource/{url}',
            name: 'Data.gov Resource',
            description: 'Access a Data.gov resource by its URL',
          },
        ],
      })
    );

    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        const match = request.params.uri.match(/^datagov:\/\/resource\/(.+)$/);
        if (!match) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Invalid URI format: ${request.params.uri}`
          );
        }
        const url = decodeURIComponent(match[1]);

        try {
          const response = await axios.get(url, {
            responseType: 'arraybuffer', // Handle binary data
          });

          // Use a data URI to embed the content
          const base64 = Buffer.from(response.data, 'binary').toString(
            'base64'
          );
          const dataUri = `data:${response.headers['content-type']};base64,${base64}`;

          return {
            contents: [
              {
                uri: request.params.uri,
                text: dataUri, // Return the data URI
              },
            ],
          };
        } catch (error) {
          this.handleAxiosError(error); // Improved error handling
          throw error; // Re-throw to ensure MCP error handling
        }
      }
    );
  }

  /**
   * Sets up the tool handlers for the server.
   */
  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'package_search',
          description: 'Search for packages (datasets) on Data.gov',
          inputSchema: {
            type: 'object',
            properties: {
              q: { type: 'string', description: 'Search query' },
              sort: {
                type: 'string',
                description: 'Sort order (e.g., "score desc, name asc")',
              },
              rows: {
                type: 'number',
                description: 'Number of results per page',
              },
              start: {
                type: 'number',
                description: 'Starting offset for results',
              },
            },
          },
        },
        {
          name: 'package_show',
          description: 'Get details for a specific package (dataset)',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Package ID or name' },
            },
            required: ['id'],
          },
        },
        {
          name: 'group_list',
          description: 'List groups on Data.gov',
          inputSchema: {
            type: 'object',
            properties: {
              order_by: { type: 'string', description: 'Field to order by' },
              limit: { type: 'number', description: 'Maximum number of results' },
              offset: { type: 'number', description: 'Offset for results' },
              all_fields: { type: 'boolean', description: 'Return all fields' },
            },
          },
        },
        {
          name: 'tag_list',
          description: 'List tags on Data.gov',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query for tags' },
              all_fields: {
                type: 'boolean',
                description: 'Return all fields',
              },
            },
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'package_search':
          if (!isValidPackageSearchArgs(request.params.arguments)) {
            throw new McpError(
              ErrorCode.InvalidParams,
              'Invalid package_search arguments'
            );
          }
          return this.packageSearch(request.params.arguments);
        case 'package_show':
          if (!isValidPackageShowArgs(request.params.arguments)) {
            throw new McpError(
              ErrorCode.InvalidParams,
              'Invalid package_show arguments'
            );
          }
          return this.packageShow(request.params.arguments);
        case 'group_list':
          if (!isValidGroupListArgs(request.params.arguments)) {
            throw new McpError(
              ErrorCode.InvalidParams,
              'Invalid group_list arguments'
            );
          }
          return this.groupList(request.params.arguments);
        case 'tag_list':
          if (!isValidTagListArgs(request.params.arguments)) {
            throw new McpError(
              ErrorCode.InvalidParams,
              'Invalid tag_list arguments'
            );
          }
          return this.tagList(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  /**
   * Searches for packages on Data.gov.
   * @param args The search arguments.
   * @returns The search results.
   */
  private async packageSearch(args: PackageSearchArgs) {
    try {
      const response = await this.axiosInstance.get('/action/package_search', {
        params: args,
      });
      return {
        content: [
          { type: 'text', text: JSON.stringify(response.data, null, 2) },
        ],
      };
    } catch (error) {
      return this.handleAxiosError(error);
    }
  }

  /**
   * Retrieves details for a specific package on Data.gov.
   * @param args The package ID.
   * @returns The package details.
   */
  private async packageShow(args: PackageShowArgs) {
    try {
      const response = await this.axiosInstance.get('/action/package_show', {
        params: { id: args.id },
      });
      return {
        content: [
          { type: 'text', text: JSON.stringify(response.data, null, 2) },
        ],
      };
    } catch (error) {
      return this.handleAxiosError(error);
    }
  }

  /**
   * Retrieves a list of groups on Data.gov
   * @param {GroupListArgs} args - The arguments for the group list API call
   * @returns {Promise<{content: [{type: string, text: string}]}>} - The response from the API call
   */
  private async groupList(args: GroupListArgs) {
    try {
      const response = await this.axiosInstance.get('/action/group_list', {
        params: args,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
      };
    } catch (error) {
      return this.handleAxiosError(error);
    }
  }

  /**
   * Retrieves a list of tags from the Data.gov API.
   * @param args - The arguments for the tag list API call.
   * @returns The response from the API call.
   */
  private async tagList(args: TagListArgs) {
    try {
      const response = await this.axiosInstance.get('/action/tag_list', {
        params: args,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }],
      };
    } catch (error) {
      return this.handleAxiosError(error);
    }
  }

  /**
   * Handles errors from Axios requests.
   * @param error The error thrown by Axios.
   * @returns An error response object.
   */
  private handleAxiosError(error: unknown) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      let errorMessage = `Data.gov API error: ${axiosError.message}`;

      if (axiosError.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        errorMessage += `\nStatus: ${axiosError.response.status}`;
        if (axiosError.response.data) {
          // Try to extract a more specific error message from the response data
          const data = axiosError.response.data as any;
          // Check for CKAN error format
          if (data?.error?.message) {
            errorMessage += `\nMessage: ${data.error.message}`;
          } else if (data?.error) {
            errorMessage += `\nMessage: ${data.error}`;
          } else if (typeof data === 'string') {
            errorMessage += `\nData: ${data}`;
          }
        }
      } else if (axiosError.request) {
        // The request was made but no response was received
        errorMessage += '\nNo response received from the server.';
      }
      // else { error message already initialized }

      return {
        content: [{ type: 'text', text: errorMessage }],
        isError: true,
      };
    }

    // Handle non-Axios errors
    return {
      content: [{ type: 'text', text: `An unexpected error occurred: ${error}` }],
      isError: true,
    };
  }

  /**
   * Runs the MCP server.
   */
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Data.gov MCP server running on stdio');
  }
}

const server = new DataGovServer();
server.run().catch(console.error);
