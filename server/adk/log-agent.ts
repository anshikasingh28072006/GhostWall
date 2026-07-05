import { McpServer } from '../mcp-server';
import { AgentStep } from './agent-manager';

export class LogAgent {
  public name = 'Log Parser & Correlation Agent';
  public role = 'Audit Trail & Multi-stage Correlation Engine';

  public async execute(context: any, mcpServer: McpServer): Promise<AgentStep & { output: any }> {
    const logs: string[] = [];
    const toolCalls: any[] = [];
    
    logs.push(`[${this.name}] Correlating security alerts with identity authentication audits.`);
    
    const suspectIp = context.detectedIps[0] || '192.168.1.150';

    // Agent Thought Process
    let thought = `Checking if suspect IP '${suspectIp}' has prior history of failed access attempts, port probing, or suspicious request patterns in authentication databases.`;
    logs.push(`[${this.name}] Thought: ${thought}`);

    // Call MCP Tool: log_correlator
    const toolArgs = {
      authLogs: context.mockAuthLogs,
      networkAlerts: context.mockLogs
    };
    logs.push(`[${this.name}] Action: Invoking MCP tool 'log_correlator'`);
    const toolResult = mcpServer.callTool('log_correlator', toolArgs);
    
    toolCalls.push({
      tool: 'log_correlator',
      args: toolArgs,
      output: toolResult.result
    });
    logs.push(...toolResult.logs);

    let correlationDetected = toolResult.result.correlationDetected;
    let details = toolResult.result.details;

    if (context.scenario === 'BRUTE_FORCE') {
      correlationDetected = true;
      details = `Correlated attack trace: IP ${suspectIp} triggered 12 consecutive failed login attempts on endpoint '/api/auth/login' using user dictionary list.`;
      logs.push(`[${this.name}] CORRELATION ALERT: Multiple failed logins matched with IP ${suspectIp}.`);
    } else if (context.scenario === 'SQL_INJECTION') {
      logs.push(`[${this.name}] Request volume is normal, but authorization trail indicates targeting database APIs.`);
    } else if (context.scenario === 'XSS_ATTACK') {
      logs.push(`[${this.name}] Request payload targeting form injection. No prior brute force history.`);
    }

    const output = {
      correlationDetected,
      suspectIp,
      details
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
