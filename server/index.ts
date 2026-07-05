import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { McpServer } from './mcp-server';
import { AgentManager } from './adk/agent-manager';
import { validatePayload } from './scripts/payload-validator';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

// Initialize core components
const mcpServer = new McpServer();
const agentManager = new AgentManager();

// Seed logs
let mockAuthLogs = [
  { timestamp: new Date(Date.now() - 60000).toISOString(), ip: '10.0.0.12', username: 'admin', status: 'failed' },
  { timestamp: new Date(Date.now() - 50000).toISOString(), ip: '10.0.0.12', username: 'admin', status: 'failed' },
  { timestamp: new Date(Date.now() - 40000).toISOString(), ip: '10.0.0.12', username: 'root', status: 'failed' },
  { timestamp: new Date(Date.now() - 30000).toISOString(), ip: '10.0.0.12', username: 'support', status: 'failed' }
];

let mockTrafficLogs = [
  { timestamp: new Date(Date.now() - 30000).toISOString(), sourceIp: '10.0.0.12', destIp: '192.168.1.1', port: 80, byteCount: 152 },
  { timestamp: new Date(Date.now() - 25000).toISOString(), sourceIp: '10.0.0.12', destIp: '192.168.1.1', port: 443, byteCount: 1024 },
  { timestamp: new Date(Date.now() - 20000).toISOString(), sourceIp: '10.0.0.12', destIp: '192.168.1.1', port: 22, byteCount: 48 }
];

/**
 * Endpoint: Reset simulation blocks and history
 */
app.post('/api/simulation/reset', (_req, res) => {
  mcpServer.clearActiveBlocks();
  mockAuthLogs = [
    { timestamp: new Date(Date.now() - 60000).toISOString(), ip: '10.0.0.12', username: 'admin', status: 'failed' },
    { timestamp: new Date(Date.now() - 50000).toISOString(), ip: '10.0.0.12', username: 'admin', status: 'failed' },
    { timestamp: new Date(Date.now() - 40000).toISOString(), ip: '10.0.0.12', username: 'root', status: 'failed' },
    { timestamp: new Date(Date.now() - 30000).toISOString(), ip: '10.0.0.12', username: 'support', status: 'failed' }
  ];
  mockTrafficLogs = [
    { timestamp: new Date(Date.now() - 30000).toISOString(), sourceIp: '10.0.0.12', destIp: '192.168.1.1', port: 80, byteCount: 152 }
  ];
  res.json({ success: true, message: 'Simulation environment and blacklists have been reset.' });
});

/**
 * Endpoint: Run simulated threat scenarios through ADK
 */
app.post('/api/simulation/run', async (req, res) => {
  const { scenario, payload } = req.body;
  
  // Custom IP seeding based on scenario
  let suspectIp = '203.0.113.88';
  if (scenario === 'DDOS_ATTACK') {
    suspectIp = '10.0.0.25';
    // Append high traffic
    for (let i = 0; i < 15; i++) {
      mockTrafficLogs.push({
        timestamp: new Date().toISOString(),
        sourceIp: suspectIp,
        destIp: '192.168.1.1',
        port: 80,
        byteCount: 64
      });
    }
  } else if (scenario === 'BRUTE_FORCE') {
    suspectIp = '172.16.8.5';
    // Append failed auth logs
    for (let i = 0; i < 5; i++) {
      mockAuthLogs.push({
        timestamp: new Date().toISOString(),
        ip: suspectIp,
        username: 'admin',
        status: 'failed'
      });
    }
  }

  try {
    const result = await agentManager.runSimulation(
      scenario,
      payload || '',
      mockTrafficLogs,
      mockAuthLogs,
      mcpServer
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint: Direct input validation sandbox
 */
app.post('/api/validate', (req, res) => {
  const { payload } = req.body;
  if (!payload) {
    return res.status(400).json({ error: 'Payload parameter is required.' });
  }
  
  const report = validatePayload(payload);
  
  // Add an entry in the MCP server threat logs if it was indeed flagged
  if (report.isThreat) {
    mcpServer.addMockLog({
      type: report.threatType,
      sourceIp: 'SANDBOX_USER',
      severity: report.riskScore > 85 ? 'high' : 'medium',
      message: `Payload Sandbox Flagged: ${report.threatType}. Original: ${report.originalPayload.slice(0, 40)}`,
      status: 'BLOCKED'
    });
  }

  return res.json(report);
});

/**
 * Endpoint: Get system status & blacklisted IPs
 */
app.get('/api/status', (_req, res) => {
  const systemStatus = JSON.parse(mcpServer.readResource('ghostwall://system/status').content);
  const rawLogs = JSON.parse(mcpServer.readResource('ghostwall://threats/logs').content);
  
  res.json({
    ...systemStatus,
    threatLogs: rawLogs
  });
});

/**
 * Endpoint: MCP Client Simulation Discovery - Resources
 */
app.get('/api/mcp/resources', (_req, res) => {
  res.json(mcpServer.listResources());
});

/**
 * Endpoint: MCP Client Simulation Discovery - Tools
 */
app.get('/api/mcp/tools', (_req, res) => {
  res.json(mcpServer.listTools());
});

/**
 * Start Server
 */
app.listen(port, () => {
  console.log(`[GhostWall Backend] Server is running offline on http://localhost:${port}`);
});
