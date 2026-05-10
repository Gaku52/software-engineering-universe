# MCP Agents

> Building agents using Model Context Protocol — the open standard for connecting AI applications to tools and data sources. Covers server/client implementation, tool definitions, and resource management.

## What You Will Learn

1. MCP design philosophy and architecture (client/server model)
2. Implementing MCP servers (providing tools, resources, and prompts)
3. Building MCP clients and integration patterns for agents
4. Advanced MCP server design (authentication, logging, middleware)
5. Integrating multiple MCP servers and dynamic tool management
6. Building remote MCP servers with SSE transport
7. Security, testing, and deployment strategies for production use


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content in [LangGraph](./01-langgraph.md)

---

## 1. Overview of MCP

### 1.1 What is MCP?

MCP (Model Context Protocol) is an **open standard protocol proposed by Anthropic for connecting AI applications to tools and data sources**. Like USB, it aims to standardize integrations so that "once implemented, any AI application can use it."

```
Without MCP (N x M problem):
  App1 ──custom integration──→ Tool1
  App1 ──custom integration──→ Tool2
  App2 ──custom integration──→ Tool1  ← every combination implemented separately
  App2 ──custom integration──→ Tool2

With MCP (N + M):
  App1 ──MCP──→ +---------+ ──MCP──→ Tool1
  App2 ──MCP──→ | MCP     | ──MCP──→ Tool2
                | Protocol|
                +---------+
  Unified via standard protocol → dramatically reduced implementation cost
```

### 1.2 Architecture

```
MCP Architecture

+------------------+                   +------------------+
|   MCP Host       |                   |   MCP Server     |
|  (AI App)        |                   |  (Tool Provider) |
|                  |     JSON-RPC      |                  |
|  +-----------+   |   over stdio/SSE  |  +-----------+   |
|  | MCP       |<========================>| MCP       |   |
|  | Client    |   |                   |  | Server    |   |
|  +-----------+   |                   |  +-----------+   |
|                  |                   |                  |
|  +-----------+   |   Features:       |  +-----------+   |
|  | LLM       |   |   - Tools        |  | Tool      |   |
|  +-----------+   |   - Resources     |  | Impl.     |   |
|                  |   - Prompts       |  +-----------+   |
|  +-----------+   |   - Sampling      |  +-----------+   |
|  | Agent     |   |                   |  | Data      |   |
|  | Logic     |   |                   |  | Source    |   |
|  +-----------+   |                   |  +-----------+   |
+------------------+                   +------------------+

 Hosts: Claude Desktop, Claude Code, Cursor, Cline...
 Servers: DB connections, API integrations, file operations, Git operations...
```

### 1.3 The Four MCP Feature Categories

```
Four features provided by MCP

1. Tools
   - Actions the LLM can invoke
   - Examples: DB search, API calls, file operations
   - The LLM decides when to use them

2. Resources
   - Data provided as context
   - Examples: documents, configuration files, database schemas
   - Selected by the user or application

3. Prompts
   - Reusable prompt templates
   - Examples: code review, summarization, translation templates
   - Selected and used by the user

4. Sampling
   - LLM invocation requests from the server
   - Examples: recursive processing on the server side
   - The server uses the client's LLM
```

---

## 2. Implementing an MCP Server

### 2.1 Basic MCP Server

```python
# Basic MCP server implementation (Python SDK)
from mcp.server import Server
from mcp.types import Tool, TextContent, Resource
from mcp.server.stdio import stdio_server
import json
import sqlite3
import asyncio

# Server instance
app = Server("company-tools")

# === Tool definitions ===
@app.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="query_employees",
            description="Search the employee database. Supports searching by name, department, and role.",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Employee name (partial match)"
                    },
                    "department": {
                        "type": "string",
                        "enum": ["engineering", "sales", "hr", "marketing"],
                        "description": "Department"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of results (default: 10)",
                        "default": 10
                    }
                }
            }
        ),
        Tool(
            name="create_ticket",
            description="Create a JIRA ticket. Returns the created ticket ID.",
            inputSchema={
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Ticket title"},
                    "description": {"type": "string", "description": "Detailed description"},
                    "priority": {
                        "type": "string",
                        "enum": ["high", "medium", "low"]
                    }
                },
                "required": ["title", "priority"]
            }
        )
    ]

# === Tool execution ===
@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "query_employees":
        conn = sqlite3.connect("/data/employees.db")
        cursor = conn.cursor()
        query = "SELECT * FROM employees WHERE 1=1"
        params = []

        if "name" in arguments:
            query += " AND name LIKE ?"
            params.append(f"%{arguments['name']}%")
        if "department" in arguments:
            query += " AND department = ?"
            params.append(arguments["department"])

        query += f" LIMIT {arguments.get('limit', 10)}"
        cursor.execute(query, params)
        results = cursor.fetchall()
        conn.close()

        return [TextContent(
            type="text",
            text=json.dumps(results, ensure_ascii=False)
        )]

    elif name == "create_ticket":
        ticket_id = create_jira_ticket(
            title=arguments["title"],
            description=arguments.get("description", ""),
            priority=arguments["priority"]
        )
        return [TextContent(
            type="text",
            text=f"Ticket created: {ticket_id}"
        )]

    return [TextContent(type="text", text=f"Unknown tool: {name}")]

# Start server
async def main():
    async with stdio_server() as (read, write):
        await app.run(read, write)

if __name__ == "__main__":
    asyncio.run(main())
```

### 2.2 Providing Resources

```python
# MCP resources: data provided as context to the AI
@app.list_resources()
async def list_resources() -> list[Resource]:
    return [
        Resource(
            uri="company://docs/api-guide",
            name="API Specification",
            description="Internal API specification (OpenAPI format)",
            mimeType="application/json"
        ),
        Resource(
            uri="company://docs/coding-standards",
            name="Coding Standards",
            description="Internal Python coding standards",
            mimeType="text/markdown"
        )
    ]

@app.read_resource()
async def read_resource(uri: str) -> str:
    if uri == "company://docs/api-guide":
        with open("/docs/api-spec.json") as f:
            return f.read()
    elif uri == "company://docs/coding-standards":
        with open("/docs/coding-standards.md") as f:
            return f.read()
    raise ValueError(f"Unknown resource: {uri}")
```

### 2.3 Dynamic Resources and Resource Templates

```python
from mcp.types import Resource, ResourceTemplate

# Dynamic resources: generate resources based on URL patterns
@app.list_resource_templates()
async def list_resource_templates() -> list[ResourceTemplate]:
    return [
        ResourceTemplate(
            uriTemplate="company://employees/{employee_id}/profile",
            name="Employee Profile",
            description="Profile information for the specified employee ID"
        ),
        ResourceTemplate(
            uriTemplate="company://projects/{project_id}/summary",
            name="Project Summary",
            description="Summary information for the specified project"
        ),
        ResourceTemplate(
            uriTemplate="company://metrics/{date}/dashboard",
            name="Daily Metrics",
            description="Dashboard data for the specified date"
        )
    ]

@app.read_resource()
async def read_resource(uri: str) -> str:
    import re

    # Employee profile
    match = re.match(r"company://employees/(\w+)/profile", uri)
    if match:
        employee_id = match.group(1)
        conn = sqlite3.connect("/data/employees.db")
        cursor = conn.execute(
            "SELECT * FROM employees WHERE id = ?", (employee_id,)
        )
        row = cursor.fetchone()
        conn.close()
        if row:
            return json.dumps({
                "id": row[0], "name": row[1],
                "department": row[2], "role": row[3]
            }, ensure_ascii=False)
        raise ValueError(f"Employee ID {employee_id} not found")

    # Project summary
    match = re.match(r"company://projects/(\w+)/summary", uri)
    if match:
        project_id = match.group(1)
        # Fetch project information
        return json.dumps({
            "project_id": project_id,
            "status": "active",
            "members": 12,
            "progress": "65%"
        }, ensure_ascii=False)

    raise ValueError(f"Unknown resource URI: {uri}")
```

### 2.4 Prompt Templates

```python
# MCP prompts: reusable prompt templates
from mcp.types import Prompt, PromptArgument, PromptMessage

@app.list_prompts()
async def list_prompts() -> list[Prompt]:
    return [
        Prompt(
            name="code_review",
            description="Perform a code review",
            arguments=[
                PromptArgument(
                    name="code",
                    description="Code to review",
                    required=True
                ),
                PromptArgument(
                    name="language",
                    description="Programming language",
                    required=False
                )
            ]
        ),
        Prompt(
            name="bug_report",
            description="Generate a bug report template",
            arguments=[
                PromptArgument(
                    name="title",
                    description="Bug summary",
                    required=True
                ),
                PromptArgument(
                    name="steps",
                    description="Steps to reproduce",
                    required=True
                ),
                PromptArgument(
                    name="severity",
                    description="Severity (critical/high/medium/low)",
                    required=False
                )
            ]
        ),
        Prompt(
            name="sql_query_helper",
            description="Generate SQL queries from natural language",
            arguments=[
                PromptArgument(
                    name="description",
                    description="Description of the data to retrieve",
                    required=True
                ),
                PromptArgument(
                    name="tables",
                    description="Available table names (comma-separated)",
                    required=False
                )
            ]
        )
    ]

@app.get_prompt()
async def get_prompt(name: str, arguments: dict) -> list[PromptMessage]:
    if name == "code_review":
        return [
            PromptMessage(
                role="user",
                content=f"""Please review the following {arguments.get('language', '')} code.

Evaluate it from the perspectives of security, performance, and readability,
and provide specific code examples for any improvements.

```
{arguments['code']}
```"""
            )
        ]

    elif name == "bug_report":
        severity = arguments.get("severity", "medium")
        return [
            PromptMessage(
                role="user",
                content=f"""Please create a bug report from the following information.

## Bug Summary
{arguments['title']}

## Severity
{severity}

## Steps to Reproduce
{arguments['steps']}

Please output in the following format:
1. Title
2. Environment information
3. Steps to reproduce (numbered)
4. Expected behavior
5. Actual behavior
6. Impact scope
7. Recommended action"""
            )
        ]

    elif name == "sql_query_helper":
        tables_info = arguments.get("tables", "unknown")
        return [
            PromptMessage(
                role="user",
                content=f"""Please generate a SQL query that meets the following requirements.

Requirements: {arguments['description']}
Available tables: {tables_info}

Please also include an explanation of the query and any performance considerations."""
            )
        ]

    raise ValueError(f"Unknown prompt: {name}")
```

### 2.5 Server Lifecycle Management

```python
from mcp.server import Server
from mcp.types import Tool, TextContent
from contextlib import asynccontextmanager
import logging

logger = logging.getLogger("mcp-server")

# Server with resource management
class DatabaseMCPServer:
    """MCP server that manages database connections"""

    def __init__(self, db_path: str):
        self.db_path = db_path
        self.conn = None
        self.server = Server("database-tools")
        self._setup_handlers()

    def _setup_handlers(self):
        """Register handlers"""

        @self.server.list_tools()
        async def list_tools() -> list[Tool]:
            return [
                Tool(
                    name="execute_query",
                    description="Execute a read-only SQL query (SELECT statements only)",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "SQL query to execute (SELECT statements only)"
                            }
                        },
                        "required": ["query"]
                    }
                ),
                Tool(
                    name="list_tables",
                    description="Get the list of tables in the database",
                    inputSchema={
                        "type": "object",
                        "properties": {}
                    }
                ),
                Tool(
                    name="describe_table",
                    description="Get schema information for a table",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "table_name": {
                                "type": "string",
                                "description": "Table name"
                            }
                        },
                        "required": ["table_name"]
                    }
                )
            ]

        @self.server.call_tool()
        async def call_tool(name: str, arguments: dict) -> list[TextContent]:
            if name == "execute_query":
                return await self._execute_query(arguments["query"])
            elif name == "list_tables":
                return await self._list_tables()
            elif name == "describe_table":
                return await self._describe_table(arguments["table_name"])
            return [TextContent(type="text", text=f"Unknown tool: {name}")]

    async def _execute_query(self, query: str) -> list[TextContent]:
        """Execute a SQL query (SELECT statements only)"""
        query_upper = query.strip().upper()
        if not query_upper.startswith("SELECT"):
            return [TextContent(
                type="text",
                text="Error: Only SELECT statements can be executed."
            )]

        # Check for dangerous keywords
        dangerous = ["DROP", "DELETE", "INSERT", "UPDATE", "ALTER", "CREATE"]
        for keyword in dangerous:
            if keyword in query_upper:
                return [TextContent(
                    type="text",
                    text=f"Error: Queries containing '{keyword}' cannot be executed."
                )]

        try:
            cursor = self.conn.execute(query)
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            rows = cursor.fetchall()
            result = {
                "columns": columns,
                "rows": [list(row) for row in rows[:100]],  # max 100 rows
                "total_rows": len(rows)
            }
            return [TextContent(
                type="text",
                text=json.dumps(result, ensure_ascii=False, indent=2)
            )]
        except Exception as e:
            return [TextContent(
                type="text",
                text=f"Query execution error: {str(e)}"
            )]

    async def _list_tables(self) -> list[TextContent]:
        """Get the list of tables"""
        cursor = self.conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )
        tables = [row[0] for row in cursor.fetchall()]
        return [TextContent(
            type="text",
            text=json.dumps({"tables": tables}, ensure_ascii=False)
        )]

    async def _describe_table(self, table_name: str) -> list[TextContent]:
        """Get table schema"""
        cursor = self.conn.execute(f"PRAGMA table_info({table_name})")
        columns = []
        for row in cursor.fetchall():
            columns.append({
                "name": row[1],
                "type": row[2],
                "not_null": bool(row[3]),
                "primary_key": bool(row[5])
            })
        return [TextContent(
            type="text",
            text=json.dumps({"table": table_name, "columns": columns}, ensure_ascii=False, indent=2)
        )]

    async def run(self):
        """Start the server"""
        import sqlite3
        self.conn = sqlite3.connect(self.db_path)
        logger.info(f"Database connected: {self.db_path}")

        try:
            async with stdio_server() as (read, write):
                await self.server.run(read, write)
        finally:
            if self.conn:
                self.conn.close()
                logger.info("Database disconnected")

# Start
if __name__ == "__main__":
    import sys
    db_path = sys.argv[1] if len(sys.argv) > 1 else "data.db"
    server = DatabaseMCPServer(db_path)
    asyncio.run(server.run())
```

---

## 3. Implementing an MCP Client

### 3.1 Basic Client

```python
# MCP client implementation (agent side)
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
import anthropic

async def run_mcp_agent():
    # Connect to the MCP server
    server_params = StdioServerParameters(
        command="python",
        args=["company_tools_server.py"],
        env={"DATABASE_PATH": "/data/employees.db"}
    )

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            # Get available tools
            tools_response = await session.list_tools()
            print(f"Available tools: {[t.name for t in tools_response.tools]}")

            # Convert to Anthropic API tool format
            anthropic_tools = [
                {
                    "name": t.name,
                    "description": t.description,
                    "input_schema": t.inputSchema
                }
                for t in tools_response.tools
            ]

            # Agent loop
            client = anthropic.Anthropic()
            messages = [{"role": "user", "content": "Search for employees in the engineering department"}]

            while True:
                response = client.messages.create(
                    model="claude-sonnet-4-20250514",
                    max_tokens=4096,
                    tools=anthropic_tools,
                    messages=messages
                )

                if response.stop_reason == "end_turn":
                    print(response.content[0].text)
                    break

                # Execute tools via MCP server
                for block in response.content:
                    if block.type == "tool_use":
                        result = await session.call_tool(
                            block.name, block.input
                        )
                        # Add result to messages
                        messages.append({
                            "role": "assistant",
                            "content": response.content
                        })
                        messages.append({
                            "role": "user",
                            "content": [{
                                "type": "tool_result",
                                "tool_use_id": block.id,
                                "content": result.content[0].text
                            }]
                        })
```

### 3.2 Integrated Client for Multiple MCP Servers

```python
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
import anthropic
import asyncio
from dataclasses import dataclass

@dataclass
class MCPServerConfig:
    name: str
    command: str
    args: list[str]
    env: dict[str, str] = None

class MultiServerMCPAgent:
    """Agent that integrates multiple MCP servers"""

    def __init__(self, server_configs: list[MCPServerConfig]):
        self.server_configs = server_configs
        self.sessions: dict[str, ClientSession] = {}
        self.tool_to_server: dict[str, str] = {}
        self.all_tools: list[dict] = []

    async def connect_all(self):
        """Connect to all MCP servers"""
        for config in self.server_configs:
            params = StdioServerParameters(
                command=config.command,
                args=config.args,
                env=config.env
            )

            read_stream, write_stream = await self._create_connection(params)
            session = ClientSession(read_stream, write_stream)
            await session.initialize()

            self.sessions[config.name] = session

            # Get tool list
            tools_response = await session.list_tools()
            for tool in tools_response.tools:
                self.tool_to_server[tool.name] = config.name
                self.all_tools.append({
                    "name": tool.name,
                    "description": f"[{config.name}] {tool.description}",
                    "input_schema": tool.inputSchema
                })

        print(f"Connected: {len(self.sessions)} servers, {len(self.all_tools)} tools")

    async def call_tool(self, tool_name: str, arguments: dict) -> str:
        """Execute a tool on the appropriate MCP server"""
        server_name = self.tool_to_server.get(tool_name)
        if not server_name:
            return f"Error: tool '{tool_name}' not found"

        session = self.sessions[server_name]
        result = await session.call_tool(tool_name, arguments)
        return result.content[0].text

    async def run_agent_loop(self, user_message: str) -> str:
        """Run the agent loop"""
        client = anthropic.Anthropic()
        messages = [{"role": "user", "content": user_message}]

        max_iterations = 10
        for _ in range(max_iterations):
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                tools=self.all_tools,
                messages=messages
            )

            if response.stop_reason == "end_turn":
                for block in response.content:
                    if hasattr(block, "text"):
                        return block.text
                return ""

            # Execute tools
            messages.append({
                "role": "assistant",
                "content": response.content
            })

            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result = await self.call_tool(block.name, block.input)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result
                    })

            if tool_results:
                messages.append({
                    "role": "user",
                    "content": tool_results
                })

        return "Maximum number of iterations reached"

    async def _create_connection(self, params):
        """Create a server connection (simplified)"""
        # In a real implementation, use the stdio_client context manager
        pass

# Usage example
async def main():
    configs = [
        MCPServerConfig(
            name="database",
            command="python",
            args=["db_server.py"],
            env={"DB_PATH": "/data/app.db"}
        ),
        MCPServerConfig(
            name="github",
            command="npx",
            args=["-y", "@modelcontextprotocol/server-github"],
            env={"GITHUB_TOKEN": "ghp_xxx"}
        ),
        MCPServerConfig(
            name="slack",
            command="npx",
            args=["-y", "@modelcontextprotocol/server-slack"],
            env={"SLACK_TOKEN": "xoxb-xxx"}
        )
    ]

    agent = MultiServerMCPAgent(configs)
    await agent.connect_all()
    result = await agent.run_agent_loop(
        "Summarize the latest GitHub PRs and unread Slack messages"
    )
    print(result)
```

### 3.3 Using Resources and Prompts

```python
async def use_resources_and_prompts(session: ClientSession):
    """Examples of using resources and prompts"""

    # Get resource list
    resources = await session.list_resources()
    for resource in resources.resources:
        print(f"Resource: {resource.name} ({resource.uri})")

    # Read a resource
    api_docs = await session.read_resource("company://docs/api-guide")
    print(f"API specification: {api_docs.contents[0].text[:200]}...")

    # Get prompt list
    prompts = await session.list_prompts()
    for prompt in prompts.prompts:
        print(f"Prompt: {prompt.name} - {prompt.description}")

    # Use a prompt
    review_prompt = await session.get_prompt(
        "code_review",
        arguments={
            "code": "def hello(): print('world')",
            "language": "Python"
        }
    )
    print(f"Generated prompt: {review_prompt.messages[0].content}")

    # Include a resource in the LLM context
    client = anthropic.Anthropic()
    coding_standards = await session.read_resource("company://docs/coding-standards")

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=f"""Please review according to the following coding standards:

{coding_standards.contents[0].text}""",
        messages=[{
            "role": "user",
            "content": review_prompt.messages[0].content
        }]
    )
```

---

## 4. MCP Configuration Files

### 4.1 Claude Desktop Configuration

```json
{
  "mcpServers": {
    "company-tools": {
      "command": "python",
      "args": ["/path/to/company_tools_server.py"],
      "env": {
        "DATABASE_PATH": "/data/employees.db",
        "JIRA_API_TOKEN": "..."
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/gaku/projects"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxx"
      }
    }
  }
}
```

### 4.2 Claude Code Configuration

```json
{
  "mcpServers": {
    "database": {
      "command": "python",
      "args": ["/path/to/db_mcp_server.py", "--db", "/data/analytics.db"],
      "env": {}
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-playwright"],
      "env": {}
    },
    "custom-api": {
      "command": "node",
      "args": ["/path/to/api_server.js"],
      "env": {
        "API_BASE_URL": "https://api.example.com",
        "API_KEY": "sk-xxx"
      }
    }
  }
}
```

### 4.3 Communication Protocol

```
MCP Communication Flow (JSON-RPC 2.0)

Client → Server: initialize
Server → Client: capabilities (list of supported features)

Client → Server: tools/list
Server → Client: [Tool1, Tool2, ...]

Client → Server: tools/call {name: "query", arguments: {...}}
Server → Client: {content: [{type: "text", text: "result"}]}

Client → Server: resources/list
Server → Client: [Resource1, Resource2, ...]

Client → Server: resources/read {uri: "company://docs/api"}
Server → Client: {content: "API document content..."}

Client → Server: prompts/list
Server → Client: [Prompt1, Prompt2, ...]

Client → Server: prompts/get {name: "code_review", arguments: {...}}
Server → Client: {messages: [{role: "user", content: "..."}]}
```

### 4.4 JSON-RPC Message Examples

```json
// Tool list request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}

// Tool list response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "query_employees",
        "description": "Search the employee database",
        "inputSchema": {
          "type": "object",
          "properties": {
            "name": {"type": "string", "description": "Employee name"}
          }
        }
      }
    ]
  }
}

// Tool execution request
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "query_employees",
    "arguments": {"name": "Tanaka", "department": "engineering"}
  }
}

// Tool execution response
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "[{\"id\": 1, \"name\": \"田中太郎\", \"dept\": \"engineering\"}]"
      }
    ]
  }
}
```

---

## 5. SSE Transport (Remote MCP Servers)

### 5.1 Implementing an SSE Server

```python
# Remote MCP server using SSE (Server-Sent Events) transport
from mcp.server import Server
from mcp.server.sse import SseServerTransport
from starlette.applications import Starlette
from starlette.routing import Route
from starlette.responses import JSONResponse
import uvicorn

app = Server("remote-tools")

# Tool definitions (same interface)
@app.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="web_search",
            description="Perform a web search",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "max_results": {"type": "integer", "default": 5}
                },
                "required": ["query"]
            }
        )
    ]

@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "web_search":
        # Execute web search
        results = await perform_web_search(
            arguments["query"],
            arguments.get("max_results", 5)
        )
        return [TextContent(type="text", text=json.dumps(results, ensure_ascii=False))]
    return [TextContent(type="text", text=f"Unknown tool: {name}")]

# SSE transport configuration
sse = SseServerTransport("/messages")

async def handle_sse(request):
    """Handle SSE connections"""
    async with sse.connect_sse(
        request.scope, request.receive, request._send
    ) as streams:
        await app.run(
            streams[0], streams[1],
            app.create_initialization_options()
        )

async def handle_messages(request):
    """Receive messages"""
    await sse.handle_post_message(request.scope, request.receive, request._send)

# Starlette application
starlette_app = Starlette(
    routes=[
        Route("/sse", handle_sse),
        Route("/messages", handle_messages, methods=["POST"]),
    ]
)

if __name__ == "__main__":
    uvicorn.run(starlette_app, host="0.0.0.0", port=8080)
```

### 5.2 Connecting an SSE Client

```python
from mcp.client.sse import sse_client

async def connect_remote_server():
    """Connect to a remote MCP server"""
    async with sse_client("http://remote-server:8080/sse") as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            # Same interface as a local MCP client
            tools = await session.list_tools()
            print(f"Remote tools: {[t.name for t in tools.tools]}")

            result = await session.call_tool(
                "web_search",
                {"query": "MCP protocol", "max_results": 3}
            )
            print(result.content[0].text)
```

---

## 6. TypeScript MCP Server

### 6.1 TypeScript Implementation

```typescript
// MCP server implementation in TypeScript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "analytics-server", version: "1.0.0" },
  { capabilities: { tools: {}, resources: {} } }
);

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "analyze_data",
      description: "Perform statistical analysis on a dataset",
      inputSchema: {
        type: "object" as const,
        properties: {
          dataset: {
            type: "string",
            description: "Dataset name",
          },
          metrics: {
            type: "array",
            items: { type: "string" },
            description: "Metrics to calculate (mean, median, std, etc.)",
          },
        },
        required: ["dataset"],
      },
    },
    {
      name: "generate_chart",
      description: "Generate a chart from data",
      inputSchema: {
        type: "object" as const,
        properties: {
          chart_type: {
            type: "string",
            enum: ["bar", "line", "pie", "scatter"],
          },
          data: {
            type: "object",
            description: "Chart data (arrays for x-axis and y-axis)",
          },
          title: { type: "string" },
        },
        required: ["chart_type", "data"],
      },
    },
  ],
}));

// Tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "analyze_data") {
    // Perform statistical analysis
    const results = await performAnalysis(
      args.dataset as string,
      (args.metrics as string[]) || ["mean", "median", "std"]
    );
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
  }

  if (name === "generate_chart") {
    const chartUrl = await createChart(
      args.chart_type as string,
      args.data as Record<string, unknown>,
      (args.title as string) || "Chart"
    );
    return {
      content: [
        { type: "text", text: `Chart generated: ${chartUrl}` },
      ],
    };
  }

  return {
    content: [{ type: "text", text: `Unknown tool: ${name}` }],
    isError: true,
  };
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## 7. Testing

### 7.1 Unit Tests for MCP Servers

```python
import pytest
import json
from unittest.mock import patch, MagicMock

# Direct testing of tool handlers
class TestQueryEmployeesTool:
    """Tests for the query_employees tool"""

    @pytest.fixture
    def mock_db(self, tmp_path):
        """Test database"""
        import sqlite3
        db_path = tmp_path / "test.db"
        conn = sqlite3.connect(str(db_path))
        conn.execute("""
            CREATE TABLE employees (
                id INTEGER PRIMARY KEY,
                name TEXT,
                department TEXT,
                role TEXT
            )
        """)
        conn.execute(
            "INSERT INTO employees VALUES (1, '田中太郎', 'engineering', 'Senior Engineer')"
        )
        conn.execute(
            "INSERT INTO employees VALUES (2, '鈴木花子', 'engineering', 'Manager')"
        )
        conn.execute(
            "INSERT INTO employees VALUES (3, '佐藤一郎', 'sales', 'Sales Rep')"
        )
        conn.commit()
        conn.close()
        return str(db_path)

    @pytest.mark.asyncio
    async def test_search_by_name(self, mock_db):
        """Can search by name"""
        with patch("__main__.sqlite3.connect") as mock_connect:
            mock_connect.return_value = sqlite3.connect(mock_db)
            result = await call_tool("query_employees", {"name": "田中"})
            data = json.loads(result[0].text)
            assert len(data) == 1
            assert "田中" in str(data)

    @pytest.mark.asyncio
    async def test_search_by_department(self, mock_db):
        """Can search by department"""
        with patch("__main__.sqlite3.connect") as mock_connect:
            mock_connect.return_value = sqlite3.connect(mock_db)
            result = await call_tool("query_employees", {"department": "engineering"})
            data = json.loads(result[0].text)
            assert len(data) == 2

    @pytest.mark.asyncio
    async def test_limit(self, mock_db):
        """Result limit works"""
        with patch("__main__.sqlite3.connect") as mock_connect:
            mock_connect.return_value = sqlite3.connect(mock_db)
            result = await call_tool("query_employees", {"limit": 1})
            data = json.loads(result[0].text)
            assert len(data) <= 1

    @pytest.mark.asyncio
    async def test_unknown_tool(self):
        """Unknown tool case"""
        result = await call_tool("nonexistent_tool", {})
        assert "Unknown tool" in result[0].text

class TestCreateTicketTool:
    """Tests for the create_ticket tool"""

    @pytest.mark.asyncio
    async def test_create_ticket(self):
        """Ticket is created"""
        with patch("__main__.create_jira_ticket") as mock_jira:
            mock_jira.return_value = "PROJ-123"
            result = await call_tool("create_ticket", {
                "title": "Test ticket",
                "priority": "high",
                "description": "For testing"
            })
            assert "PROJ-123" in result[0].text
            mock_jira.assert_called_once()
```

### 7.2 Interactive Testing with MCP Inspector

```bash
# Install and use MCP Inspector
npx @modelcontextprotocol/inspector

# Connect to a specific server for testing
npx @modelcontextprotocol/inspector python company_tools_server.py

# Inspector features:
# - View tool list
# - Interactively execute tools
# - Read resources
# - Retrieve prompts
# - View server logs
```

### 7.3 Integration Tests

```python
import pytest
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

class TestMCPServerIntegration:
    """Integration tests for the MCP server"""

    @pytest.fixture
    async def session(self):
        """MCP session for testing"""
        params = StdioServerParameters(
            command="python",
            args=["company_tools_server.py"],
            env={"DATABASE_PATH": ":memory:"}
        )
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                yield session

    @pytest.mark.asyncio
    async def test_list_tools(self, session):
        """Can retrieve the tool list"""
        result = await session.list_tools()
        tool_names = [t.name for t in result.tools]
        assert "query_employees" in tool_names
        assert "create_ticket" in tool_names

    @pytest.mark.asyncio
    async def test_tool_schema_valid(self, session):
        """Tool schema is valid"""
        result = await session.list_tools()
        for tool in result.tools:
            assert tool.inputSchema is not None
            assert "type" in tool.inputSchema
            assert tool.inputSchema["type"] == "object"

    @pytest.mark.asyncio
    async def test_list_resources(self, session):
        """Can retrieve the resource list"""
        result = await session.list_resources()
        assert len(result.resources) > 0

    @pytest.mark.asyncio
    async def test_list_prompts(self, session):
        """Can retrieve the prompt list"""
        result = await session.list_prompts()
        assert len(result.prompts) > 0
```

---

## 8. Security

### 8.1 Input Validation

```python
from pydantic import BaseModel, Field, validator
from typing import Optional
import re

class EmployeeQueryInput(BaseModel):
    """Input validation for employee search"""
    name: Optional[str] = Field(None, max_length=100)
    department: Optional[str] = Field(None)
    limit: int = Field(default=10, ge=1, le=100)

    @validator("name")
    def validate_name(cls, v):
        if v and not re.match(r"^[\w\s\-]+$", v):
            raise ValueError("Input contains invalid characters")
        return v

    @validator("department")
    def validate_department(cls, v):
        valid_depts = {"engineering", "sales", "hr", "marketing"}
        if v and v not in valid_depts:
            raise ValueError(f"Invalid department: {v}")
        return v

# Tool execution with validation
@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "query_employees":
        try:
            validated = EmployeeQueryInput(**arguments)
        except ValueError as e:
            return [TextContent(
                type="text",
                text=f"Input error: {str(e)}"
            )]

        # Execute query with validated values
        return await execute_employee_query(validated)
```

### 8.2 Authentication and Access Control

```python
import os
import hashlib
import hmac
from datetime import datetime

class AuthenticatedMCPServer:
    """MCP server with authentication"""

    def __init__(self):
        self.api_key = os.environ.get("MCP_API_KEY")
        self.allowed_tools: dict[str, list[str]] = {
            "read": ["query_employees", "list_tables", "describe_table"],
            "write": ["create_ticket", "update_employee"],
            "admin": ["execute_raw_query", "delete_record"]
        }

    def verify_request(self, request_meta: dict) -> str:
        """Authenticate the request and determine the role"""
        token = request_meta.get("auth_token")
        if not token:
            raise PermissionError("Authentication token is missing")

        # Determine the role from the token (use JWT in practice)
        role = self._decode_token(token)
        return role

    def check_permission(self, role: str, tool_name: str) -> bool:
        """Check access permission for a tool"""
        for permission_level, tools in self.allowed_tools.items():
            if tool_name in tools:
                if permission_level == "read":
                    return True  # All roles can read
                elif permission_level == "write":
                    return role in ["write", "admin"]
                elif permission_level == "admin":
                    return role == "admin"
        return False

    def _decode_token(self, token: str) -> str:
        """Decode the token (simplified)"""
        # In practice, implement JWT decoding
        if token.startswith("admin_"):
            return "admin"
        elif token.startswith("write_"):
            return "write"
        return "read"
```

### 8.3 Rate Limiting

```python
from collections import defaultdict
from datetime import datetime, timedelta
import asyncio

class RateLimiter:
    """Rate limiting for tool calls"""

    def __init__(self, max_calls_per_minute: int = 60):
        self.max_calls = max_calls_per_minute
        self.call_history: dict[str, list[datetime]] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def check_rate_limit(self, tool_name: str) -> bool:
        """Check rate limit"""
        async with self._lock:
            now = datetime.now()
            cutoff = now - timedelta(minutes=1)

            # Remove old history
            self.call_history[tool_name] = [
                t for t in self.call_history[tool_name] if t > cutoff
            ]

            if len(self.call_history[tool_name]) >= self.max_calls:
                return False

            self.call_history[tool_name].append(now)
            return True

rate_limiter = RateLimiter(max_calls_per_minute=30)

# Tool execution with rate limiting
@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if not await rate_limiter.check_rate_limit(name):
        return [TextContent(
            type="text",
            text=f"Rate limit exceeded: tool '{name}' is limited to {rate_limiter.max_calls} calls per minute"
        )]

    # Normal tool execution
    return await execute_tool(name, arguments)
```

---

## 9. Using Existing MCP Servers

```
Official and Community MCP Server List

Filesystem:
  @modelcontextprotocol/server-filesystem
  File read/write, directory operations

GitHub:
  @modelcontextprotocol/server-github
  Repository, issue, and PR operations

PostgreSQL:
  @modelcontextprotocol/server-postgres
  Database queries

Slack:
  @modelcontextprotocol/server-slack
  Send/receive messages, channel operations

Google Drive:
  @modelcontextprotocol/server-gdrive
  Document reading

Puppeteer:
  @modelcontextprotocol/server-puppeteer
  Web browsing, screenshots

Brave Search:
  @modelcontextprotocol/server-brave-search
  Web search

Memory:
  @modelcontextprotocol/server-memory
  Persistent key-value store

Fetch:
  @modelcontextprotocol/server-fetch
  Execute HTTP requests
```

### 9.1 Official Server Configuration Examples

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem",
               "/Users/gaku/projects", "/Users/gaku/documents"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxxx"
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres",
               "postgresql://user:pass@localhost:5432/mydb"]
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "BSA_xxxx"
      }
    }
  }
}
```

---

## 10. Comparison Tables

### 10.1 MCP vs REST API vs GraphQL

| Aspect | MCP | REST API | GraphQL |
|--------|-----|----------|---------|
| Purpose | AI-to-tool connection | General web API | Flexible data retrieval |
| Protocol | JSON-RPC 2.0 | HTTP | HTTP |
| Transport | stdio / SSE | HTTP | HTTP |
| Schema | JSON Schema | OpenAPI | GraphQL SDL |
| AI optimization | Native | Requires wrapper | Requires wrapper |
| Tool discovery | list_tools | Manual | Introspection |
| State management | Session-based | Stateless | Stateless |

### 10.2 MCP Server Implementation Language Comparison

| Language | SDK | Maturity | Ecosystem | Recommended use case |
|----------|-----|----------|-----------|----------------------|
| Python | mcp (official) | High | Largest | Data processing, ML |
| TypeScript | @modelcontextprotocol/sdk | High | Large | Web integrations |
| Rust | mcp-rust | Medium | Medium | High-performance requirements |
| Go | mcp-go | Medium | Medium | Infrastructure tools |

### 10.3 Transport Method Comparison

| Method | Communication | Latency | Security | Recommended use |
|--------|--------------|---------|----------|----------------|
| stdio | Local process | Lowest | Process isolation | Local tools |
| SSE | HTTP/Remote | Medium | HTTPS support | Remote servers |
| WebSocket | Bidirectional real-time | Low | WSS support | Real-time requirements |

### 10.4 MCP Host Support Status

| Host | MCP support | stdio | SSE | Notes |
|------|-------------|-------|-----|-------|
| Claude Desktop | Official | Supported | Supported | Most complete support |
| Claude Code | Official | Supported | Supported | CLI environment |
| Cursor | Supported | Supported | Partial | IDE integration |
| Cline | Supported | Supported | Partial | VS Code extension |
| Continue | Supported | Supported | Planned | Open-source IDE |

---

## 11. Anti-Patterns

### Anti-Pattern 1: Ignoring Security

```python
# BAD: Embedding user input directly into SQL
@app.call_tool()
async def call_tool(name, arguments):
    query = f"SELECT * FROM users WHERE name = '{arguments['name']}'"
    # SQL injection vulnerability!

# GOOD: Use parameterized queries
@app.call_tool()
async def call_tool(name, arguments):
    query = "SELECT * FROM users WHERE name = ?"
    cursor.execute(query, (arguments["name"],))
```

### Anti-Pattern 2: Swallowing Errors

```python
# BAD: Silently ignore errors and return an empty result
@app.call_tool()
async def call_tool(name, arguments):
    try:
        result = do_something(arguments)
        return [TextContent(type="text", text=result)]
    except Exception:
        return [TextContent(type="text", text="")]  # The LLM has no idea what happened

# GOOD: Explicitly return error information
@app.call_tool()
async def call_tool(name, arguments):
    try:
        result = do_something(arguments)
        return [TextContent(type="text", text=result)]
    except ValueError as e:
        return [TextContent(type="text",
                text=f"Input error: {e}. Please check the parameters.")]
    except ConnectionError:
        return [TextContent(type="text",
                text="Database connection error. Please try again later.")]
```

### Anti-Pattern 3: Insufficient Tool Descriptions

```python
# BAD: Vague description that the LLM cannot use properly
Tool(
    name="search",
    description="Search",  # Search what? How?
    inputSchema={"type": "object", "properties": {"q": {"type": "string"}}}
)

# GOOD: Specific and clear description
Tool(
    name="search_employees",
    description="Search the employee database by name, department, or role. Supports partial matching. Returns results up to the maximum count.",
    inputSchema={
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "description": "Search by employee name (partial match). Example: 'Tanaka'"
            },
            "department": {
                "type": "string",
                "enum": ["engineering", "sales", "hr"],
                "description": "Filter by department"
            },
            "limit": {
                "type": "integer",
                "description": "Maximum number of results (1-100, default 10)",
                "default": 10,
                "minimum": 1,
                "maximum": 100
            }
        }
    }
)
```

### Anti-Pattern 4: Huge Responses

```python
# BAD: Return all data as-is
@app.call_tool()
async def call_tool(name, arguments):
    cursor.execute("SELECT * FROM huge_table")
    results = cursor.fetchall()  # 1 million rows
    return [TextContent(type="text", text=json.dumps(results))]
    # Enormous token count overflows the LLM's context

# GOOD: Limit results and return with a summary
@app.call_tool()
async def call_tool(name, arguments):
    limit = min(arguments.get("limit", 50), 100)
    cursor.execute(f"SELECT * FROM huge_table LIMIT {limit}")
    results = cursor.fetchall()

    # Also return total count
    cursor.execute("SELECT COUNT(*) FROM huge_table")
    total_count = cursor.fetchone()[0]

    return [TextContent(type="text", text=json.dumps({
        "results": results,
        "returned": len(results),
        "total": total_count,
        "note": f"Showing top {len(results)} of {total_count} total records"
    }, ensure_ascii=False))]
```

### Anti-Pattern 5: Logging to stdout

```python
# BAD: Logging to stdout (disrupts MCP communication)
print("Debug: processing request...")  # Breaks stdio communication

# GOOD: Log to stderr
import sys
print("Debug: processing request...", file=sys.stderr)

# GOOD: Use the logging module (redirects to stderr)
import logging
logging.basicConfig(stream=sys.stderr, level=logging.DEBUG)
logger = logging.getLogger("mcp-server")
logger.info("Processing request...")
```

---

## 12. FAQ

### Q1: How do I debug an MCP server?

- **MCP Inspector**: Test interactively with `npx @modelcontextprotocol/inspector`
- **Logging**: Output logs to `stderr` (stdio is used for communication)
- **Unit tests**: Test server handler functions directly

### Q2: How many tools should a single MCP server have?

The recommendation is up to **10-20 tools**. Beyond that, split into multiple servers. Organizing by category (e.g., DB operations server, email operations server) makes them easier to manage.

### Q3: When should I use MCP vs Function Calling?

- **MCP**: When you want to share tools across multiple AI applications, or when you want process isolation for tools
- **Function Calling**: When everything is contained within a single application, or when you want the simplest implementation

The two are not mutually exclusive — it is common to convert MCP server tools into Function Calling format for use.

### Q4: How do I optimize MCP server performance?

- **Connection pooling**: Reuse database connections
- **Caching**: Cache frequently accessed data in memory
- **Async I/O**: Use asyncio to minimize I/O wait time
- **Response size limits**: Set an upper bound on returned data
- **Batch processing**: Handle multiple requests together

### Q5: How do I run an MCP server in Docker?

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "mcp_server.py"]
```

```yaml
# docker-compose.yml
services:
  mcp-db-server:
    build: ./mcp-db-server
    volumes:
      - ./data:/data
    environment:
      - DATABASE_PATH=/data/app.db
  mcp-api-server:
    build: ./mcp-api-server
    environment:
      - API_KEY=${API_KEY}
```

### Q6: How do I monitor an MCP server?

```python
# MCP server with Prometheus metrics
from prometheus_client import Counter, Histogram, start_http_server
import time

tool_calls = Counter(
    "mcp_tool_calls_total",
    "Total tool calls",
    ["tool_name", "status"]
)

tool_latency = Histogram(
    "mcp_tool_latency_seconds",
    "Tool execution latency",
    ["tool_name"]
)

@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    start = time.time()
    try:
        result = await execute_tool(name, arguments)
        tool_calls.labels(tool_name=name, status="success").inc()
        return result
    except Exception as e:
        tool_calls.labels(tool_name=name, status="error").inc()
        raise
    finally:
        tool_latency.labels(tool_name=name).observe(time.time() - start)

# Start metrics endpoint (separate port)
start_http_server(9090)
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping straight to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in professional settings?

Knowledge of this topic is frequently applied in day-to-day development work. It is especially important during code reviews and architecture design.

---

## Summary

| Item | Description |
|------|-------------|
| MCP | Standard protocol between AI and tools |
| 4 features | Tools, Resources, Prompts, Sampling |
| Transport | stdio (local) / SSE (remote) |
| Server implementation | Built with Python/TypeScript SDK |
| Clients | Used by Claude Desktop, Code, Cursor, etc. |
| Security | Input validation, authentication, rate limiting |
| Testing | Unit tests + MCP Inspector + integration tests |
| Principles | Security-first, accurately convey error information |

## What to Read Next

- [03-claude-agent-sdk.md](./03-claude-agent-sdk.md) -- MCP integration with the Claude Agent SDK
- [../00-fundamentals/02-tool-use.md](../00-fundamentals/02-tool-use.md) -- Fundamentals of tool use
- [../04-production/00-deployment.md](../04-production/00-deployment.md) -- Deploying MCP servers

## References

1. Model Context Protocol Specification -- https://modelcontextprotocol.io/
2. MCP GitHub Organization -- https://github.com/modelcontextprotocol
3. Anthropic, "Introducing the Model Context Protocol" (2024) -- https://www.anthropic.com/news/model-context-protocol
4. MCP Python SDK -- https://github.com/modelcontextprotocol/python-sdk
5. MCP TypeScript SDK -- https://github.com/modelcontextprotocol/typescript-sdk
