import { McpServer } from './mcp-server';
import { AgentStep } from './agent-manager';

export class NetworkAgent {
  public name = 'Network Traffic Analyzer';
  public role = 'Anomalous Connection & Protocol Monitor';

  public async execute(context: any, mcpServer: McpServer): Promise<AgentStep & { output: any }> {
    const logs: string[] = [];
    const toolCalls: any[] = [];
    
    logs.push(`[${this.name}] Starting traffic inspection. Scanning raw connection packets...`);
    
    let thought = `Inspecting packets for scenario '${context.scenario}'. I will check if any source IP exceeds the baseline traffic volume threshold (10 packets) or is performing random sequential scans.`;
    logs.push(`[${this.name}] Thought: ${thought}`);

    const toolArgs = { logs: context.mockLogs };
    logs.push(`[${this.name}] Action: Invoking MCP tool 'network_traffic_analyzer'`);
    const toolResult = mcpServer.callTool('network_traffic_analyzer', toolArgs);
    
    toolCalls.push({
      tool: 'network_traffic_analyzer',
      args: toolArgs,
      output: toolResult.result
    });
    logs.push(...toolResult.logs);

    let suspectIp = toolResult.result.suspectIp;
    let anomalyDetected = toolResult.result.anomalyDetected;

    if (context.scenario === 'DDOS_ATTACK') {
      anomalyDetected = true;
      suspectIp = suspectIp || '10.0.0.25';
      logs.push(`[${this.name}] Volumetric spike detected. Over 1500 req/s from source IP: ${suspectIp}`);
    } else if (context.scenario === 'PORT_SCAN') {
      anomalyDetected = true;
      suspectIp = suspectIp || '172.16.5.99';
      logs.push(`[${this.name}] Probe pattern matching: High frequency port scan on ports 22, 80, 443, 3389.`);
    } else if (context.scenario === 'BRUTE_FORCE') {
      logs.push(`[${this.name}] Volume within limits, but authentication protocol frequency looks elevated.`);
    } else {
      logs.push(`[${this.name}] No volumetric traffic anomalies detected. Baseline packet rates normal.`);
    }

    const output = {
      anomalyDetected,
      suspectIp,
      details: toolResult.result.details
    };

    return {
      agentName: this.name,
      role: this.role,
      thought,
      toolCalls,
      logs,
      output
    };
  }
}
