# Data.gov MCP Server

An MCP server for accessing data from Data.gov, providing tools and resources for interacting with government datasets.

## Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/melaodoidao/datagov-mcp-server.git
    cd datagov-mcp-server
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Build the server:**

    ```bash
    npm run build
    ```

4. **Configure the MCP Server:**
   - Add the following entry to your `cline_mcp_settings.json` file (usually located in `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/` on macOS):
     ```json
      {
        "mcpServers": {
          "datagov": {
            "command": "node",
            "args": ["/Users/joaobondan/Documents/Cline/MCP/datagov-mcp-server/build/index.js"],
            "env": {}
          }
        }
      }
      ```
   -  If you are using the Claude Desktop app, add the entry to `~/Library/Application Support/Claude/claude_desktop_config.json` instead.

## Usage

This server provides the following tools:

*   `package_search`: Search for packages (datasets) on Data.gov.
*   `package_show`: Get details for a specific package (dataset).
*   `group_list`: List groups on Data.gov.
*   `tag_list`: List tags on Data.gov.

It also provides the following resource template:

*   `datagov://resource/{url}`: Access a Data.gov resource by its URL.

You can use these tools and resources with Cline by specifying the server name (`datagov-mcp-server`) and the tool/resource name.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License
