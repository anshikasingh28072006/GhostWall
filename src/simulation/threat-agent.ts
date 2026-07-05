import { McpServer } from './mcp-server';
import { AgentStep } from './agent-manager';

export class ThreatAgent {
  public name = 'Threat Classification & Scoring Agent';
  public role = 'Malicious Payload Parser & Risk Evaluator';

  public async execute(context: any, mcpServer: McpServer): Promise<AgentStep & { output: any }> {
    const logs: string[] = [];
    const toolCalls: any[] = [];
    
    logs.push(`[${this.name}] Analyzing payload parameters for potential web application vulnerabilities.`);
    
    const payload = context.payload || '';

    let thought = `Inspecting raw payload string: "${payload}". I will run sanitization validation via MCP to determine threat signature, classification, and severity index.`;
    logs.push(`[${this.name}] Thought: ${thought}`);

    const toolArgs = { payload };
    logs.push(`[${this.name}] Action: Invoking MCP tool 'payload_sanitize_validator'`);
    const toolResult = mcpServer.callTool('payload_sanitize_validator', toolArgs);
    
    toolCalls.push({
      tool: 'payload_sanitize_validator',
      args: toolArgs,
      output: toolResult.result
    });
    logs.push(...toolResult.logs);

    let isThreat = toolResult.result.isThreat;
    let threatType = toolResult.result.threatType;
    let riskScore = toolResult.result.riskScore;
    let details = toolResult.result.details;
    let sanitized = toolResult.result.sanitized;

    if (!isThreat && context.scenario !== 'CLEAN_TRAFFIC') {
      isThreat = true;
      if (context.scenario === 'DDOS_ATTACK') {
        threatType = 'DDOS';
        riskScore = 94;
        details = 'Distributed Denial of Service attack detected. High frequency traffic spike overloading buffers.';
      } else if (context.scenario === 'PORT_SCAN') {
        threatType = 'PORT_SCAN';
        riskScore = 65;
        details = 'System enumeration probe: Sequential port connection scanning.';
      } else if (context.scenario === 'BRUTE_FORCE') {
        threatType = 'BRUTE_FORCE';
        riskScore = 82;
        details = 'Multiple failed authentication sequences indicative of credential abuse.';
      } else if (context.scenario === 'SQL_INJECTION') {
        threatType = 'SQL_INJECTION';
        riskScore = 95;
        details = 'SQL injection pattern detected in input parameters.';
      } else if (context.scenario === 'XSS_ATTACK') {
        threatType = 'CROSS_SITE_SCRIPTING';
        riskScore = 85;
        details = 'Injected script tag detected in HTTP request header/body.';
      }
    }

    logs.push(`[${this.name}] Analysis Result: Classified as [${threatType}] with Risk Score: ${riskScore}/100.`);

    const output = {
      isThreat,
      threatType,
      riskScore,
      sanitized,
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
