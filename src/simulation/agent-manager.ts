import { McpServer } from './mcp-server';
import { NetworkAgent } from './network-agent';
import { ThreatAgent } from './threat-agent';
import { LogAgent } from './log-agent';
import { MitigationAgent } from './mitigation-agent';

export interface AgentStep {
  agentName: string;
  role: string;
  thought: string;
  toolCalls: { tool: string; args: any; output: any }[];
  logs: string[];
}

export interface SimulationResult {
  scenario: string;
  success: boolean;
  steps: AgentStep[];
  mitigationApplied?: string;
  threatScore?: number;
  threatType?: string;
}

export class AgentManager {
  private networkAgent: NetworkAgent;
  private threatAgent: ThreatAgent;
  private logAgent: LogAgent;
  private mitigationAgent: MitigationAgent;

  constructor() {
    this.networkAgent = new NetworkAgent();
    this.threatAgent = new ThreatAgent();
    this.logAgent = new LogAgent();
    this.mitigationAgent = new MitigationAgent();
  }

  public async runSimulation(
    scenario: string,
    payload: string,
    mockLogs: any[],
    mockAuthLogs: any[],
    mcpServer: McpServer
  ): Promise<SimulationResult> {
    const steps: AgentStep[] = [];
    const context: any = {
      scenario,
      payload,
      mockLogs,
      mockAuthLogs,
      detectedIps: [] as string[],
      correlations: {} as any,
      threatClassification: {} as any,
      mitigation: {} as any
    };

    const step1 = await this.networkAgent.execute(context, mcpServer);
    steps.push(step1);
    
    if (step1.output && step1.output.suspectIp) {
      context.detectedIps.push(step1.output.suspectIp);
    } else {
      if (scenario !== 'CLEAN_TRAFFIC') {
        context.detectedIps.push('203.0.113.88');
      }
    }

    const step2 = await this.logAgent.execute(context, mcpServer);
    steps.push(step2);

    const step3 = await this.threatAgent.execute(context, mcpServer);
    steps.push(step3);
    if (step3.output) {
      context.threatClassification = step3.output;
    }

    const step4 = await this.mitigationAgent.execute(context, mcpServer);
    steps.push(step4);
    if (step4.output) {
      context.mitigation = step4.output;
    }

    const threatScore = context.threatClassification?.riskScore || 0;
    const threatType = context.threatClassification?.threatType || 'NONE';
    const mitigationApplied = context.mitigation?.mitigationApplied || 'NONE';

    return {
      scenario,
      success: true,
      steps,
      mitigationApplied,
      threatScore,
      threatType
    };
  }
}
