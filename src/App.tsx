import { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  Activity, 
  Terminal, 
  Database, 
  Cpu, 
  AlertTriangle, 
  Play, 
  RotateCcw, 
  Lock, 
  Unlock, 
  Search, 
  Code
} from 'lucide-react';
import { McpServer } from './simulation/mcp-server';
import { AgentManager } from './simulation/agent-manager';
import { validatePayload } from './simulation/payload-validator';

interface ThreatLog {
  id: string;
  timestamp: string;
  type: string;
  sourceIp: string;
  severity: string;
  message: string;
  status: string;
}

interface SystemStatus {
  status: 'SECURE' | 'WARNING' | 'CRITICAL';
  activeFirewallRules: number;
  blockedIps: string[];
  systemHealth: {
    cpuUsagePercent: number;
    memoryUsagePercent: number;
    uptimeSeconds: number;
    logProcessingRate: string;
  };
  threatLogs: ThreatLog[];
}

interface McpResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

interface AgentStep {
  agentName: string;
  role: string;
  thought: string;
  toolCalls: { tool: string; args: any; output: any }[];
  logs: string[];
  output?: any;
}

// Singletons for client-side execution
const mcpServer = new McpServer();
const agentManager = new AgentManager();

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

export default function App() {
  // Main states
  const [statusData, setStatusData] = useState<SystemStatus | null>(null);
  const [mcpResources, setMcpResources] = useState<McpResource[]>([]);
  const [mcpTools, setMcpTools] = useState<McpTool[]>([]);
  
  // Simulation states
  const [selectedScenario, setSelectedScenario] = useState<string>('DDOS_ATTACK');
  const [customPayload, setCustomPayload] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationLogs, setSimulationLogs] = useState<any[]>([]);
  
  // Interactive Sandbox states
  const [sandboxInput, setSandboxInput] = useState<string>("SELECT * FROM users WHERE username = 'admin' AND password = '1' OR '1'='1' --");
  const [sandboxResult, setSandboxResult] = useState<any | null>(null);
  const [isSandboxing, setIsSandboxing] = useState<boolean>(false);

  // Active Tab: 'agents' | 'mcp'
  const [activeTab, setActiveTab] = useState<'agents' | 'mcp'>('agents');

  // Terminal scroll reference
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Read state from client-side MCP Server singleton
  const fetchStatus = () => {
    try {
      const systemStatus = JSON.parse(mcpServer.readResource('ghostwall://system/status').content);
      const rawLogs = JSON.parse(mcpServer.readResource('ghostwall://threats/logs').content);
      
      setStatusData({
        ...systemStatus,
        threatLogs: rawLogs
      });
    } catch (err) {
      console.error('Error fetching system status:', err);
    }
  };

  const fetchMcpInfo = () => {
    try {
      setMcpResources(mcpServer.listResources());
      setMcpTools(mcpServer.listTools());
    } catch (err) {
      console.error('Error fetching MCP definitions:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchMcpInfo();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [simulationLogs]);

  // Run a scenario through local ADK Agent Manager directly in-browser
  const handleRunSimulation = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimulationLogs([
      { type: 'prompt', text: `> ghostwall-core --scenario=${selectedScenario} --initialize` },
      { type: 'info', text: `[SYSTEM] Preparing offline sandbox environment for threat analysis...` },
      { type: 'info', text: `[SYSTEM] Loading local simulated dataset & authentication logs.` },
    ]);

    // Custom IP seeding based on scenario
    let suspectIp = '203.0.113.88';
    if (selectedScenario === 'DDOS_ATTACK') {
      suspectIp = '10.0.0.25';
      for (let i = 0; i < 15; i++) {
        mockTrafficLogs.push({
          timestamp: new Date().toISOString(),
          sourceIp: suspectIp,
          destIp: '192.168.1.1',
          port: 80,
          byteCount: 64
        });
      }
    } else if (selectedScenario === 'BRUTE_FORCE') {
      suspectIp = '172.16.8.5';
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
      // Run the multi-agent ADK loop on the client
      const data = await agentManager.runSimulation(
        selectedScenario,
        customPayload || '',
        mockTrafficLogs,
        mockAuthLogs,
        mcpServer
      );

      const steps: AgentStep[] = data.steps;
      let stepIndex = 0;

      const runNextStep = () => {
        if (stepIndex < steps.length) {
          const step = steps[stepIndex];
          setSimulationLogs(prev => [
            ...prev,
            { type: 'success', text: `\n=== Running Agent: ${step.agentName} ===` },
            { type: 'prompt', text: `Role: ${step.role}` },
            { type: 'warning', text: `Thought: ${step.thought}` },
            ...step.logs.map(log => ({
              type: log.includes('ALERT') || log.includes('CRITICAL') ? 'error' : 
                    log.includes('Countermeasure') || log.includes('restricted') ? 'success' : 'info',
              text: log
            }))
          ]);
          stepIndex++;
          setTimeout(runNextStep, 900);
        } else {
          // Completed
          setSimulationLogs(prev => [
            ...prev,
            { type: 'success', text: `\n[Simulation Complete] Classification: ${data.threatType} | Threat Score: ${data.threatScore}/100 | Action: ${data.mitigationApplied}` }
          ]);
          setIsSimulating(false);
          fetchStatus();
        }
      };

      setTimeout(runNextStep, 600);

    } catch (err: any) {
      setSimulationLogs(prev => [
        ...prev,
        { type: 'error', text: `[ERROR] Failed to run simulation: ${err.message}` }
      ]);
      setIsSimulating(false);
    }
  };

  // Reset environmental states locally
  const handleResetSimulation = () => {
    try {
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
      fetchStatus();
      setSimulationLogs([
        { type: 'prompt', text: `> ghostwall-firewall --flush --reset-blacklist` },
        { type: 'success', text: `[SYSTEM] Firewall policies flushed. Restored standard security baseline.` }
      ]);
    } catch (err) {
      console.error('Error resetting simulation:', err);
    }
  };

  // Run validation on sandbox inputs locally
  const handleValidateSandbox = () => {
    if (isSandboxing || !sandboxInput.trim()) return;
    setIsSandboxing(true);
    setSandboxResult(null);

    try {
      const report = validatePayload(sandboxInput);
      
      if (report.isThreat) {
        mcpServer.addMockLog({
          type: report.threatType,
          sourceIp: 'SANDBOX_USER',
          severity: report.riskScore > 85 ? 'high' : 'medium',
          message: `Payload Sandbox Flagged: ${report.threatType}. Original: ${report.originalPayload.slice(0, 40)}`,
          status: 'BLOCKED'
        });
      }
      
      setSandboxResult(report);
      fetchStatus();
    } catch (err) {
      console.error('Error validating sandbox payload:', err);
    } finally {
      setIsSandboxing(false);
    }
  };

  // Status computation for UI metrics
  const activeAlertsCount = statusData?.threatLogs.filter(l => l.status === 'ACTIVE' || l.status === 'BLOCKED').length || 0;
  const isSystemSecure = activeAlertsCount === 0 && (statusData?.activeFirewallRules || 0) <= 1;
  const systemStatusColor = isSystemSecure ? 'secure' : activeAlertsCount > 1 ? 'critical' : 'warning';
  
  // Security gauge percentage
  const securityScore = Math.max(10, 100 - (statusData?.blockedIps.length || 0) * 10 - activeAlertsCount * 15);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Decorative scanline overlay */}
      <div className="scanlines"></div>

      {/* Modern security dashboard layout top */}
      <header className="glass-card" style={{ borderBottomLeftRadius: 16, borderBottomRightRadius: 16, borderTopLeftRadius: 0, borderTopRightRadius: 0, padding: '16px 24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', background: 'rgba(10, 15, 30, 0.85)' }}>
        
        {/* Modern Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={38} color="var(--color-cyan)" style={{ filter: 'drop-shadow(0 0 8px rgba(0, 243, 255, 0.4))' }} />
            <div style={{ position: 'absolute', width: '12px', height: '12px', background: 'var(--color-cyan)', borderRadius: '50%', filter: 'blur(4px)', animation: 'pulse-slow 2s infinite' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '0.05em', background: 'linear-gradient(90deg, #fff, var(--color-cyan))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              GHOSTWALL
            </h1>
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '2px', display: 'block', marginTop: '-2px' }}>
              OFFLINE CYBER THREAT DETECTOR
            </span>
          </div>
        </div>

        {/* Global Security Metrics */}
        <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={20} color="var(--color-cyan)" />
            <div>
              <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>System Integrity</span>
              <span className={`status-badge ${systemStatusColor}`} style={{ marginTop: '2px' }}>
                {isSystemSecure ? 'SECURE' : activeAlertsCount > 1 ? 'BREACH ATTEMPT' : 'THREAT MITIGATED'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Unlock size={20} color="var(--color-amber)" />
            <div>
              <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Security Health Index</span>
              <span style={{ display: 'block', fontSize: '18px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: securityScore > 80 ? 'var(--color-emerald)' : 'var(--color-amber)' }}>
                {securityScore}%
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Lock size={20} color="var(--color-rose)" />
            <div>
              <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Restricted IPs</span>
              <span style={{ display: 'block', fontSize: '18px', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: 'var(--color-rose)' }}>
                {statusData?.blockedIps.length || 0}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Cpu size={20} color="var(--color-cyan)" />
            <div>
              <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Log Process Rate</span>
              <span style={{ display: 'block', fontSize: '14px', fontWeight: '600', fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {statusData?.systemHealth.logProcessingRate || '0 req/s'}
              </span>
            </div>
          </div>

        </div>
      </header>

      {/* Main Content Grid */}
      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(480px, 2fr)', gap: '20px', padding: '24px', maxWidth: '1600px', width: '100%', margin: '0 auto' }}>
        
        {/* Left Column - Controls & Dashboard Lists */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Threat Simulator Panel */}
          <div className="glass-card card-danger">
            <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} color="var(--color-rose)" /> Threat Scenario Simulator
            </h2>
            
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
              Trigger offline local simulations. The ADK Multi-Agent loop will spin up step-by-step, querying tools and resources from the local Mock MCP Server.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>Select Attack Profile</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button 
                    className={`cyber-button ${selectedScenario === 'DDOS_ATTACK' ? 'active' : ''}`}
                    onClick={() => { setSelectedScenario('DDOS_ATTACK'); setCustomPayload(''); }}
                  >
                    DDoS (Volumetric)
                  </button>
                  <button 
                    className={`cyber-button ${selectedScenario === 'BRUTE_FORCE' ? 'active' : ''}`}
                    onClick={() => { setSelectedScenario('BRUTE_FORCE'); setCustomPayload(''); }}
                  >
                    Brute Force Auth
                  </button>
                  <button 
                    className={`cyber-button ${selectedScenario === 'SQL_INJECTION' ? 'active' : ''}`}
                    onClick={() => { setSelectedScenario('SQL_INJECTION'); setCustomPayload("UNION SELECT username, password FROM administrators --"); }}
                  >
                    SQL Injection
                  </button>
                  <button 
                    className={`cyber-button ${selectedScenario === 'XSS_ATTACK' ? 'active' : ''}`}
                    onClick={() => { setSelectedScenario('XSS_ATTACK'); setCustomPayload("<script>alert('SessionHijack')</script>"); }}
                  >
                    XSS Inject
                  </button>
                  <button 
                    className={`cyber-button ${selectedScenario === 'PORT_SCAN' ? 'active' : ''}`}
                    onClick={() => { setSelectedScenario('PORT_SCAN'); setCustomPayload(''); }}
                  >
                    Port Scan Probe
                  </button>
                  <button 
                    className={`cyber-button ${selectedScenario === 'CLEAN_TRAFFIC' ? 'active' : ''}`}
                    onClick={() => { setSelectedScenario('CLEAN_TRAFFIC'); setCustomPayload('GET /index.html HTTP/1.1'); }}
                  >
                    Clean Baseline
                  </button>
                </div>
              </div>

              {/* Custom payload string (Only relevant for Web Vulnerability attacks) */}
              {(selectedScenario === 'SQL_INJECTION' || selectedScenario === 'XSS_ATTACK' || selectedScenario === 'CLEAN_TRAFFIC') && (
                <div style={{ marginTop: '4px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>Attack Payload Parameter</label>
                  <input 
                    type="text" 
                    value={customPayload}
                    onChange={(e) => setCustomPayload(e.target.value)}
                    placeholder="Enter custom payload string..."
                    style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '6px', color: '#fff', fontSize: '13px', fontFamily: 'var(--font-mono)' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button 
                  className="cyber-button btn-danger" 
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={handleRunSimulation}
                  disabled={isSimulating}
                >
                  <Play size={16} /> {isSimulating ? 'Analyzing...' : 'Execute Threat Simulation'}
                </button>
                <button 
                  className="cyber-button" 
                  style={{ padding: '10px' }}
                  title="Flush Firewall & Reset"
                  onClick={handleResetSimulation}
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Active Mitigation list */}
          <div className="glass-card card-success" style={{ flex: 1 }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={18} color="var(--color-emerald)" /> Firewall Blacklists
            </h2>

            <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {statusData?.blockedIps && statusData.blockedIps.length > 0 ? (
                statusData.blockedIps.map(ip => (
                  <div key={ip} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255, 0, 85, 0.05)', border: '1px solid rgba(255,0,85,0.2)', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                    <span style={{ color: 'var(--color-rose)', fontWeight: 'bold' }}>{ip}</span>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>RESTRICTED ACCESS</span>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '16px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                  No active firewall rules.
                </div>
              )}
            </div>

            <h3 style={{ fontSize: '12px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Latest Security Threat Log</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
              {statusData?.threatLogs && statusData.threatLogs.length > 0 ? (
                statusData.threatLogs.map(log => (
                  <div key={log.id} style={{ padding: '10px', background: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 'bold', color: log.severity === 'high' ? 'var(--color-rose)' : 'var(--color-amber)', fontFamily: 'var(--font-mono)' }}>
                        [{log.type}]
                      </span>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p style={{ color: 'var(--color-text-primary)' }}>{log.message}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      <span>IP: {log.sourceIp}</span>
                      <span style={{ color: log.status === 'BLOCKED' || log.status === 'ACTIVE' ? 'var(--color-rose)' : 'var(--color-emerald)' }}>
                        Status: {log.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '16px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                  Threat history clear.
                </div>
              )}
            </div>
          </div>

        </section>

        {/* Right Column - Multi-Agent Terminals & Interactive Sandbox */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Tab Selector */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: '2px' }}>
            <button 
              className={`cyber-button ${activeTab === 'agents' ? 'active' : ''}`}
              onClick={() => setActiveTab('agents')}
              style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
            >
              <Terminal size={16} /> ADK Multi-Agent Logs
            </button>
            <button 
              className={`cyber-button ${activeTab === 'mcp' ? 'active' : ''}`}
              onClick={() => setActiveTab('mcp')}
              style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
            >
              <Database size={16} /> Local MCP Explorer
            </button>
          </div>

          {/* Active Tab View */}
          {activeTab === 'agents' ? (
            <div className="terminal-window">
              <div className="terminal-header">
                <div>
                  <span className="terminal-dot dot-red"></span>
                  <span className="terminal-dot dot-yellow"></span>
                  <span className="terminal-dot dot-green"></span>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: '8px', fontWeight: 'bold' }}>ADK_AGENT_ORCHESTRATOR.SH</span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--color-cyan)' }}>LOCAL SIMULATOR STATUS: ACTIVE</span>
              </div>
              <div className="terminal-body">
                {simulationLogs.length > 0 ? (
                  simulationLogs.map((log, idx) => (
                    <div key={idx} className={`terminal-line ${log.type}`}>
                      {log.text}
                    </div>
                  ))
                ) : (
                  <div style={{ color: 'var(--color-text-muted)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px' }}>
                    <Terminal size={32} color="var(--color-cyan)" style={{ opacity: 0.3 }} />
                    <span>Awaiting threat execution log triggers...</span>
                  </div>
                )}
                <div ref={terminalEndRef} />
              </div>
            </div>
          ) : (
            <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '425px', overflowY: 'auto' }}>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-cyan)', marginBottom: '4px' }}>Model Context Protocol Local Instance</h3>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Exposes offline data structures (Resources) and functions (Tools) registered to local AI agents.</p>
              </div>

              <div>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 'bold' }}>Exposed Resources</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {mcpResources.map(r => (
                    <div key={r.uri} style={{ padding: '10px', background: 'var(--bg-secondary)', border: '1px solid rgba(0, 243, 255, 0.15)', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#fff', fontFamily: 'var(--font-mono)' }}>{r.uri}</span>
                        <span style={{ fontSize: '10px', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', color: 'var(--color-cyan)' }}>{r.mimeType}</span>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{r.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 'bold' }}>Registered Tools</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {mcpTools.map(t => (
                    <div key={t.name} style={{ padding: '10px', background: 'var(--bg-secondary)', border: '1px solid rgba(0, 243, 255, 0.15)', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--color-emerald)', fontFamily: 'var(--font-mono)' }}>{t.name}()</span>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>JSON Schema Available</span>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>{t.description}</p>
                      <pre style={{ fontSize: '10px', background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '4px', overflowX: 'auto', color: 'var(--color-cyan)', fontFamily: 'var(--font-mono)' }}>
                        {JSON.stringify(t.inputSchema.properties, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Interactive Payload Validator Sandbox */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Code size={18} color="var(--color-cyan)" /> Payload Sanitizer Sandbox (Offline Heuristic Shield)
            </h2>
            
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
              Test inputs against the threat classification signature engine. Evaluates SQLi, XSS, Path Traversal, and Command injection, outputting validation rules.
            </p>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                value={sandboxInput}
                onChange={(e) => setSandboxInput(e.target.value)}
                placeholder="Paste payload string to inspect..."
                style={{ flex: 1, padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '6px', color: '#fff', fontSize: '13px', fontFamily: 'var(--font-mono)' }}
              />
              <button 
                className="cyber-button"
                onClick={handleValidateSandbox}
                disabled={isSandboxing}
              >
                <Search size={16} /> Analyze
              </button>
            </div>

            {sandboxResult && (
              <div style={{ padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Classification</span>
                  <span style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', color: sandboxResult.isThreat ? 'var(--color-rose)' : 'var(--color-emerald)', marginTop: '2px' }}>
                    {sandboxResult.isThreat ? `${sandboxResult.threatType} (Risk: ${sandboxResult.riskScore}/100)` : 'CLEAN INPUT'}
                  </span>

                  <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginTop: '12px' }}>Original Input</span>
                  <pre style={{ fontSize: '11px', whiteSpace: 'pre-wrap', color: '#fff', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>{sandboxResult.originalPayload}</pre>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Sanitized Safe Payload</span>
                  <pre style={{ fontSize: '11px', whiteSpace: 'pre-wrap', color: 'var(--color-emerald)', marginTop: '2px', background: 'rgba(0, 255, 66, 0.05)', padding: '4px', borderRadius: '4px', border: '1px solid rgba(0, 255, 66, 0.1)', fontFamily: 'var(--font-mono)' }}>
                    {sandboxResult.sanitizedPayload}
                  </pre>

                  <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginTop: '12px' }}>Defense Recommendation</span>
                  <p style={{ fontSize: '11px', color: 'var(--color-text-primary)', marginTop: '2px' }}>{sandboxResult.mitigationRecommendation}</p>
                </div>
              </div>
            )}
          </div>

        </section>

      </main>

      {/* Footer Info */}
      <footer style={{ textAlign: 'center', padding: '16px', color: 'var(--color-text-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)', borderTop: '1px solid var(--color-border)', marginTop: 'auto', background: 'rgba(8, 12, 20, 0.9)' }}>
        GHOSTWALL AI-BASED CYBER THREAT DETECTION FRAMEWORK • PRESENTED FOR CAPSTONE presentation • 100% OFFLINE HEURISTIC AI SIMULATOR
      </footer>

    </div>
  );
}
