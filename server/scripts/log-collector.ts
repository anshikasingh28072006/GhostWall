/**
 * CLI Tool: Log Collector Skill
 * 
 * Usage:
 *   npx ts-node server/scripts/log-collector.ts [logDir]
 */

import * as fs from 'fs';
import * as path from 'path';

function collectLogs(directoryPath: string) {
  console.log(`[Log Collector] Scanning directory: ${path.resolve(directoryPath)}`);
  
  // Simulated logs database if folder is empty or doesn't exist
  const mockSystemLogs = [
    { timestamp: '2026-07-05T10:15:30Z', ip: '192.168.1.55', event: 'SSH Login Success', code: 200 },
    { timestamp: '2026-07-05T10:18:12Z', ip: '203.0.113.4', event: 'Auth Failure: User admin', code: 401 },
    { timestamp: '2026-07-05T10:18:15Z', ip: '203.0.113.4', event: 'Auth Failure: User admin', code: 401 },
    { timestamp: '2026-07-05T10:18:18Z', ip: '203.0.113.4', event: 'Auth Failure: User root', code: 401 },
    { timestamp: '2026-07-05T10:20:00Z', ip: '198.51.100.22', event: 'API Request /v1/checkout', code: 200 },
    { timestamp: '2026-07-05T10:22:45Z', ip: '10.0.0.101', event: 'DDoS Alert: High SYN count', code: 503 },
    { timestamp: '2026-07-05T10:24:10Z', ip: '198.51.100.42', event: 'Port Scan: Port 22 Probe', code: 403 }
  ];

  let logEntries = mockSystemLogs;

  // Attempt to read actual files if they exist in the target path
  try {
    if (fs.existsSync(directoryPath) && fs.statSync(directoryPath).isDirectory()) {
      const files = fs.readdirSync(directoryPath).filter(f => f.endsWith('.log') || f.endsWith('.json'));
      if (files.length > 0) {
        logEntries = [];
        for (const file of files) {
          const filePath = path.join(directoryPath, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          try {
            const jsonLines = content.split('\n').filter(Boolean).map(line => JSON.parse(line));
            logEntries.push(...jsonLines);
          } catch {
            // Text log parsing fallback
            const lines = content.split('\n').filter(Boolean);
            for (const line of lines) {
              logEntries.push({
                timestamp: new Date().toISOString(),
                ip: 'UNKNOWN',
                event: line,
                code: 0
              });
            }
          }
        }
      }
    }
  } catch (err: any) {
    console.error(`[Warning] Could not scan filesystem folder: ${err.message}. Using built-in dataset.`);
  }

  // Generate Stats
  const ipCounts: Record<string, number> = {};
  const eventCounts: Record<string, number> = {};
  let totalLogs = logEntries.length;
  let anomaliesFound = 0;

  for (const entry of logEntries) {
    ipCounts[entry.ip] = (ipCounts[entry.ip] || 0) + 1;
    eventCounts[entry.event] = (eventCounts[entry.event] || 0) + 1;
    if (entry.code >= 400 || entry.event.toLowerCase().includes('failure') || entry.event.toLowerCase().includes('alert') || entry.event.toLowerCase().includes('scan')) {
      anomaliesFound++;
    }
  }

  // Print Report
  console.log('\n================================================================');
  console.log('                 GHOSTWALL LOG PARSING SUMMARY                  ');
  console.log('================================================================');
  console.log(`Total Logs Analyzed:  ${totalLogs}`);
  console.log(`Anomalies Registered: ${anomaliesFound}`);
  console.log(`Security Health Index: ${Math.max(0, 100 - anomaliesFound * 12)}/100`);
  console.log('\n--- IP Address Distribution ---');
  for (const [ip, count] of Object.entries(ipCounts)) {
    console.log(`  IP: ${ip.padEnd(20)} | Activity Count: ${count}`);
  }
  console.log('\n--- Event Trigger Breakdown ---');
  for (const [event, count] of Object.entries(eventCounts)) {
    console.log(`  Event: ${event.padEnd(30)} | Hits: ${count}`);
  }
  console.log('================================================================\n');

  return { totalLogs, anomaliesFound, ipCounts };
}

// Execution block
const targetDir = process.argv[2] || './logs';
collectLogs(targetDir);
export { collectLogs };
