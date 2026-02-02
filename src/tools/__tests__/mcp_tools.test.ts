/**
 * SPEC-TEST-03: Verifying MCP Tool Handler reliability
 * Integration tests for MCP tool handlers using InMemoryTransport
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CallToolResultSchema, type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ColorWizardServer } from '../../index.js';

describe('SPEC-TEST-03: MCP Tool Handlers - Integration Tests', () => {
    let server: ColorWizardServer;
    let client: Client;
    let serverTransport: InMemoryTransport;
    let clientTransport: InMemoryTransport;

    beforeEach(async () => {
        // Create linked pair of in-memory transports
        [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

        // Initialize server
        server = new ColorWizardServer();
        await server.run(serverTransport);

        // Initialize client
        client = new Client(
            {
                name: 'test-client',
                version: '1.0.0',
            },
            {
                capabilities: {},
            }
        );
        await client.connect(clientTransport);
    });

    afterEach(async () => {
        await client.close();
        await serverTransport.close();
    });

    describe('match_dmc_thread Tool', () => {
        it('SPEC-TEST-03.1: Verifying match_dmc_thread returns expected Editorial Modernism JSON structure', async () => {
            const tools = await client.listTools();
            const matchTool = tools.tools.find((t) => t.name === 'match_dmc_thread');
            expect(matchTool).toBeDefined();

            const result = await client.callTool(
                {
                    name: 'match_dmc_thread',
                    arguments: {
                        hex: '#FF0000',
                    },
                },
                CallToolResultSchema
            ) as CallToolResult;

            expect(result).toBeDefined();
            expect(result.content).toBeDefined();
            expect(Array.isArray(result.content)).toBe(true);
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('text');

            const textContent = result.content[0].type === 'text' ? result.content[0].text : '';
            expect(textContent).toContain('Instrument CW-02');
            expect(textContent).toContain('Material Match');
            expect(textContent).toContain('#FF0000');
        });

        it('SPEC-TEST-03.2: Verifying match_dmc_thread handles hex without hash prefix', async () => {
            const result = await client.callTool(
                {
                    name: 'match_dmc_thread',
                    arguments: {
                        hex: 'FF0000',
                    },
                },
                CallToolResultSchema
            ) as CallToolResult;

            expect(result.content[0].type === 'text' ? result.content[0].text : '').toContain('FF0000');
        });

        it('SPEC-TEST-03.3: Verifying match_dmc_thread rejects invalid hex format', async () => {
            await expect(
                client.callTool({
                    name: 'match_dmc_thread',
                    arguments: {
                        hex: 'INVALID',
                    },
                })
            ).rejects.toThrow();
        });
    });

    describe('apply_aesthetic_offset Tool', () => {
        it('SPEC-TEST-03.4: Verifying apply_aesthetic_offset with Lynchian profile returns correct structure', async () => {
            const result = await client.callTool(
                {
                    name: 'apply_aesthetic_offset',
                    arguments: {
                        colors: [
                            {
                                hex: '#FF0000',
                                rgb: { r: 255, g: 0, b: 0 },
                            },
                        ],
                        profile_name: 'Lynchian',
                    },
                },
                CallToolResultSchema
            ) as CallToolResult;

            expect(result).toBeDefined();
            expect(result.content).toBeDefined();
            expect(Array.isArray(result.content)).toBe(true);
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('text');

            const textContent = result.content[0].type === 'text' ? result.content[0].text : '';
            expect(textContent).toContain('Instrument CW-03');
            expect(textContent).toContain('Aesthetic Offset');
            expect(textContent).toContain('Lynchian');
            expect(textContent).toContain('Original Palette');
            expect(textContent).toContain('Artisan Palette');
        });

        it('SPEC-TEST-03.5: Verifying apply_aesthetic_offset with Brutalist profile applies correct transformations', async () => {
            const result = await client.callTool(
                {
                    name: 'apply_aesthetic_offset',
                    arguments: {
                        colors: [
                            {
                                hex: '#FF3333',
                                rgb: { r: 255, g: 51, b: 51 },
                            },
                        ],
                        profile_name: 'Brutalist',
                    },
                },
                CallToolResultSchema
            ) as CallToolResult;

            const textContent = result.content[0].type === 'text' ? result.content[0].text : '';
            expect(textContent).toContain('Brutalist');
            expect(textContent).toContain('Artisan Palette');
        });

        it('SPEC-TEST-03.6: Verifying apply_aesthetic_offset handles multiple colors', async () => {
            const result = await client.callTool(
                {
                    name: 'apply_aesthetic_offset',
                    arguments: {
                        colors: [
                            { hex: '#FF0000', rgb: { r: 255, g: 0, b: 0 } },
                            { hex: '#00FF00', rgb: { r: 0, g: 255, b: 0 } },
                            { hex: '#0000FF', rgb: { r: 0, g: 0, b: 255 } },
                        ],
                        profile_name: 'Lynchian',
                    },
                },
                CallToolResultSchema
            ) as CallToolResult;

            const textContent = result.content[0].type === 'text' ? result.content[0].text : '';
            expect(textContent).toContain('3 color(s)');
        });

        it('SPEC-TEST-03.7: Verifying apply_aesthetic_offset rejects invalid profile name', async () => {
            await expect(
                client.callTool({
                    name: 'apply_aesthetic_offset',
                    arguments: {
                        colors: [
                            {
                                hex: '#FF0000',
                                rgb: { r: 255, g: 0, b: 0 },
                            },
                        ],
                        profile_name: 'InvalidProfile',
                    },
                })
            ).rejects.toThrow();
        });
    });

    describe('Tool Listing', () => {
        it('SPEC-TEST-03.8: Verifying all expected tools are listed', async () => {
            const tools = await client.listTools();

            expect(tools.tools).toBeDefined();
            expect(tools.tools.length).toBeGreaterThanOrEqual(3);

            const toolNames = tools.tools.map((t) => t.name);
            expect(toolNames).toContain('analyze_image_region');
            expect(toolNames).toContain('match_dmc_thread');
            expect(toolNames).toContain('apply_aesthetic_offset');
        });

        it('SPEC-TEST-03.9: Verifying match_dmc_thread tool schema is correct', async () => {
            const tools = await client.listTools();
            const matchTool = tools.tools.find((t) => t.name === 'match_dmc_thread');

            expect(matchTool).toBeDefined();
            expect(matchTool?.inputSchema).toBeDefined();
            expect(matchTool?.inputSchema.type).toBe('object');
            expect(matchTool?.inputSchema.properties?.hex).toBeDefined();
            expect(matchTool?.inputSchema.required).toContain('hex');
        });
    });

    describe('Error Handling', () => {
        it('SPEC-TEST-03.10: Verifying unknown tool returns MethodNotFound error', async () => {
            await expect(
                client.callTool({
                    name: 'unknown_tool',
                    arguments: {},
                })
            ).rejects.toThrow();
        });

        it('SPEC-TEST-03.11: Verifying missing required parameters returns InvalidParams error', async () => {
            await expect(
                client.callTool({
                    name: 'match_dmc_thread',
                    arguments: {},
                })
            ).rejects.toThrow();
        });
    });
});
