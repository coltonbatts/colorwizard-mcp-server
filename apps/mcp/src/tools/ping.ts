/**
 * Ping tool - Health check and echo utility
 */

export interface PingInput {
    message?: string;
}

export interface PingOutput {
    ok: true;
    echo: string;
    timestamp: string;
}

/**
 * Ping handler - Returns echo of input message with timestamp
 * @param input - Optional message to echo
 * @returns PingOutput with ok, echo, and timestamp
 */
export function pingHandler(input: PingInput = {}): PingOutput {
    const message = input.message || "pong";
    return {
        ok: true,
        echo: message,
        timestamp: new Date().toISOString(),
    };
}

/**
 * Ping tool definition for MCP
 */
export const pingTool = {
    name: "ping",
    description: "Health check tool that echoes a message with timestamp",
    inputSchema: {
        type: "object",
        properties: {
            message: {
                type: "string",
                description: "Optional message to echo (default: 'pong')",
            },
        },
    },
};
