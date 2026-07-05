import { McpServer } from './mcp-server';
import { AgentStep } from './agent-manager';

export class MitigationAgent {
  public name = 'Automated Response Mitigation Agent';
  public role = 'Active Defense & Containment Controller';

  public async execute(context: any, mcpServer: McpServer): Promise<AgentStep & { output: any }> {
    const logs: string[] = [];
    const toolCalls: any[] = [];
    
    logs.push(`[${this.name}] Assessing threat metrics to determine active countermeasure policies.`);
    
    const threatClassification = context.threatClassification || {};
    const riskScore = threatClassification.riskScore || 0;
    const threatType = threatClassification.threatType || 'NONE';
    const suspectIp = context.detectedIps[0] || '198.51.100.99';

    let thought = `Evaluating Threat: ${threatType}, Risk Score: ${riskScore}. Mitigation threshold is 70. I must choose between BLOCK_IP, RATE_LIMIT, or NO_ACTION.`;
    logs.push(`[${this.name}] Thought: ${thought}`);

    let action: 'BLOCK_IP' | 'RATE_LIMIT' | 'ISOLATE_SUBNET' | 'NO_ACTION' = 'NO_ACTION';
    let reason = '';

    if (riskScore >= 90) {
      action = (threatType === 'DDOS') ? 'ISOLATE_SUBNET' : 'BLOCK_IP';
      reason = `Critical risk (${riskScore}/100) of ${threatType} detected from ${suspectIp}. Immediate firewall block required.`;
    } else if (riskScore >= 70) {
      action = 'BLOCK_IP';
      reason = `High risk (${riskScore}/100) of ${threatType} detected from ${suspectIp}. Access blocked.`;
    } else if (riskScore >= 50) {
      action = 'RATE_LIMIT';
      reason = `Medium risk (${riskScore}/100) of ${threatType} detected from ${suspectIp}. Enforcing throttle filters.`;
    } else {
      action = 'NO_ACTION';
      reason = `Risk score ${riskScore}/100 is below alert threshold. Logging connection event.`;
    }

    let toolResult: any = null;

    if (action !== 'NO_ACTION') {
      const toolArgs = {
        sourceIp: suspectIp,
        action,
        reason
      };
      logs.push(`[${this.name}] Action: Invoking MCP tool 'firewall_mitigator' to execute mitigation: ${action}`);
      const resultObj = mcpServer.callTool('firewall_mitigator', toolArgs);
      
      toolResult = resultObj.result;
      toolCalls.push({
        tool: 'firewall_mitigator',
        args: toolArgs,
        output: toolResult
      });
      logs.push(...resultObj.logs);
      logs.push(`[${this.name}] Countermeasure successfully applied. Target IP ${suspectIp} is now restricted.`);
    } else {
      logs.push(`[${this.name}] Defensive action bypassed. Connection remains open.`);
    }

    const output = {
      mitigationApplied: action,
      ipRestricted: suspectIp,
      reason,
      mitigationDetails: toolResult
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
