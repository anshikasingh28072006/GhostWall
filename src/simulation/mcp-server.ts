/**
 * Client-side Mock Model Context Protocol (MCP) Server
 */

export interface McpResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export class McpServer {
  private resources: McpResource[] = [
    {
      uri: 'ghostwall://threats/logs',
      name: 'Simulated Threat Logs Database',
      description: 'Historical and real-time database of security incidents, alerts, and mitigated attack vectors.',
      mimeType: 'application/json'
    },
    {
      uri: 'ghostwall://system/status',
      name: 'GhostWall System Health & Controls',
      description: 'System health indicators (CPU, memory, active firewall blocks, network interface throughput).',
      mimeType: 'application/json'
    }
  ];

  private tools: McpTool[] = [
    {
      name: 'network_traffic_analyzer',
      description: 'Scans network connection logs for volumetric anomalies, port-scanning behaviors, and DDoS signals.',
      inputSchema: {
        type: 'object',
        properties: {
          logs: {
            type: 'array',
            items: { type: 'object' },
            description: 'Array of network packet connection records containing sourceIp, destIp, port, byteCount, and timestamp.'
          }
        },
        required: ['logs']
      }
    },
    {
      name: 'payload_sanitize_validator',
      description: 'Validates and sanitizes payload strings offline. Detects patterns corresponding to SQL Injection, Cross-Site Scripting (XSS), and command Injection.',
      inputSchema: {
        type: 'object',
        properties: {
          payload: {
            type: 'string',
            description: 'Raw network request payload or user input string to evaluate.'
          }
        },
        required: ['payload']
      }
    },
    {
      name: 'log_correlator',
      description: 'Correlates network alerts with authentication logs to identify multi-stage attacks like credential stuffing leading to command execution.',
      inputSchema: {
        type: 'object',
        properties: {
          authLogs: {
            type: 'array',
            items: { type: 'object' },
            description: 'Simulated authentication attempt logs (success/failure, source IP, username).'
          },
          networkAlerts: {
            type: 'array',
            items: { type: 'object' },
            description: 'Volumetric and protocol violation alert logs.'
          }
        },
        required: ['authLogs', 'networkAlerts']
      }
    },
    {
      name: 'firewall_mitigator',
      description: 'Triggers active response countermeasures (e.g., blacklisting source IP, rate-limiting connection pools, or subnet isolation).',
      inputSchema: {
        type: 'object',
        properties: {
          sourceIp: {
            type: 'string',
            description: 'IP address to block or restrict.'
          },
          action: {
            type: 'string',
            enum: ['BLOCK_IP', 'RATE_LIMIT', 'ISOLATE_SUBNET'],
            description: 'Type of mitigation action to take.'
          },
          reason: {
            type: 'string',
            description: 'Explanation for mitigation (for security logs auditing).'
          }
        },
        required: ['sourceIp', 'action']
      }
    }
  ];

  // Simulated state
  private activeBlocks: Set<string> = new Set(['198.51.100.42']);
  private mockLogs: any[] = [
    {
      id: 'evt_101',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      type: 'PORT_SCAN',
      sourceIp: '198.51.100.42',
      severity: 'medium',
      message: 'Suspicious sequential port probing on ports 21, 22, 80, 443, 8080.',
      status: 'BLOCKED'
    }
  ];

  public listResources(): McpResource[] {
    return this.resources;
  }

  public readResource(uri: string): { content: string } {
    if (uri === 'ghostwall://threats/logs') {
      return { content: JSON.stringify(this.mockLogs, null, 2) };
    }
    if (uri === 'ghostwall://system/status') {
      return {
        content: JSON.stringify({
          status: this.activeBlocks.size > 1 ? 'WARNING' : 'SECURE',
          activeFirewallRules: this.activeBlocks.size,
          blockedIps: Array.from(this.activeBlocks),
          systemHealth: {
            cpuUsagePercent: 12 + Math.floor(Math.random() * 8),
            memoryUsagePercent: 44,
            uptimeSeconds: 86400,
            logProcessingRate: '254 req/s'
          }
        }, null, 2)
      };
    }
    throw new Error(`Resource not found: ${uri}`);
  }

  public listTools(): McpTool[] {
    return this.tools;
  }

  public callTool(name: string, args: any): { result: any; logs: string[] } {
    const logs: string[] = [];
    logs.push(`[MCP Server] Executing tool: '${name}' with arguments: ${JSON.stringify(args)}`);

    switch (name) {
      case 'network_traffic_analyzer': {
        const packets = args.logs || [];
        logs.push(`[Network Analyzer] Processing ${packets.length} traffic entries.`);
        
        let anomalyDetected = false;
        let details = 'No anomalies detected.';
        let suspectIp = '';
        
        const ipCounts: Record<string, number> = {};
        for (const p of packets) {
          ipCounts[p.sourceIp] = (ipCounts[p.sourceIp] || 0) + 1;
        }
        
        for (const [ip, count] of Object.entries(ipCounts)) {
          if (count > 10) {
            anomalyDetected = true;
            suspectIp = ip;
            details = `High connection volume detected from source ${ip}: ${count} requests in short duration.`;
            logs.push(`[Network Analyzer] ALERT: Volumetric anomaly detected from ${ip}.`);
            break;
          }
        }
        
        return {
          result: {
            anomalyDetected,
            suspectIp,
            details,
            confidence: anomalyDetected ? 0.95 : 0.1
          },
          logs
        };
      }
      
      case 'payload_sanitize_validator': {
        const rawPayload = String(args.payload || '');
        logs.push(`[Payload Validator] Inspecting payload length: ${rawPayload.length} bytes.`);
        
        const sqliPattern = /(SELECT|UNION|INSERT|DELETE|UPDATE|DROP|' OR '1'='1|--|#)/i;
        const xssPattern = /(<script|javascript:|onerror=|onload=|eval\(|alert\()/i;
        const pathTraversalPattern = /(\.\.\/|\.\.\\)/;
        
        let isThreat = false;
        let threatType = 'NONE';
        let sanitized = rawPayload;
        let riskScore = 0;
        
        if (sqliPattern.test(rawPayload)) {
          isThreat = true;
          threatType = 'SQL_INJECTION';
          riskScore = 95;
          sanitized = rawPayload.replace(sqliPattern, '[SQL_EXPLOIT_BLOCKED]');
          logs.push(`[Payload Validator] CRITICAL: SQL Injection pattern matched.`);
        } else if (xssPattern.test(rawPayload)) {
          isThreat = true;
          threatType = 'CROSS_SITE_SCRIPTING';
          riskScore = 88;
          sanitized = rawPayload.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(xssPattern, '[XSS_EXPLOIT_BLOCKED]');
          logs.push(`[Payload Validator] CRITICAL: XSS pattern matched.`);
        } else if (pathTraversalPattern.test(rawPayload)) {
          isThreat = true;
          threatType = 'PATH_TRAVERSAL';
          riskScore = 80;
          sanitized = rawPayload.replace(/\.\.\//g, '').replace(/\.\.\\/g, '');
          logs.push(`[Payload Validator] WARNING: Directory Traversal attempt blocked.`);
        } else {
          logs.push(`[Payload Validator] Payload validation passed. Input sanitized safely.`);
        }
        
        return {
          result: {
            isThreat,
            threatType,
            riskScore,
            sanitized,
            details: isThreat ? `Threat detected: ${threatType} payload blocked.` : 'Payload is clean.'
          },
          logs
        };
      }
      
      case 'log_correlator': {
        const auth = args.authLogs || [];
        const network = args.networkAlerts || [];
        logs.push(`[Log Correlator] Correlating ${auth.length} auth logs with ${network.length} network alerts.`);
        
        let correlationDetected = false;
        let suspectIp = '';
        let details = 'No correlated multi-stage attack detected.';
        
        const failedAuthByIp: Record<string, number> = {};
        for (const a of auth) {
          if (a.status === 'failed') {
            failedAuthByIp[a.sourceIp] = (failedAuthByIp[a.sourceIp] || 0) + 1;
          }
        }
        
        for (const [ip, fails] of Object.entries(failedAuthByIp)) {
          if (fails >= 3) {
            const hasNetworkAlert = network.some((n: any) => n.sourceIp === ip);
            if (hasNetworkAlert) {
              correlationDetected = true;
              suspectIp = ip;
              details = `Correlated Alert: IP ${ip} completed brute force auth attempts (${fails} failures) and matched network scanning probes. Indicator of brute-force leading to credential stuffing.`;
              logs.push(`[Log Correlator] CORRELATION MATCH: ${ip} exhibiting multi-stage attack path.`);
              break;
            }
          }
        }
        
        return {
          result: {
            correlationDetected,
            suspectIp,
            details,
            severity: correlationDetected ? 'high' : 'low'
          },
          logs
        };
      }
      
      case 'firewall_mitigator': {
        const ip = args.sourceIp;
        const action = args.action;
        const reason = args.reason || 'Auto-block via threat analysis';
        
        logs.push(`[Firewall Mitigator] Mitigating threat. IP: ${ip}, Action: ${action}, Reason: ${reason}`);
        
        if (action === 'BLOCK_IP' || action === 'ISOLATE_SUBNET') {
          this.activeBlocks.add(ip);
        }
        
        const newLog = {
          id: `evt_${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: action,
          sourceIp: ip,
          severity: 'high',
          message: `Countermeasure executed: [${action}] applied to IP ${ip}. Reason: ${reason}`,
          status: 'ACTIVE'
        };
        
        this.mockLogs.unshift(newLog);
        
        return {
          result: {
            success: true,
            ruleAdded: `${action} on IP ${ip}`,
            activeBlockCount: this.activeBlocks.size
          },
          logs
        };
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  public addMockLog(log: any) {
    this.mockLogs.unshift({
      id: `evt_${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...log
    });
  }

  public getActiveBlocks(): string[] {
    return Array.from(this.activeBlocks);
  }

  public clearActiveBlocks() {
    this.activeBlocks.clear();
    this.activeBlocks.add('198.51.100.42');
  }
}
