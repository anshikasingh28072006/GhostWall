export interface ValidationReport {
  isThreat: boolean;
  threatType: 'SQL_INJECTION' | 'CROSS_SITE_SCRIPTING' | 'PATH_TRAVERSAL' | 'COMMAND_INJECTION' | 'NONE';
  riskScore: number;
  originalPayload: string;
  sanitizedPayload: string;
  mitigationRecommendation: string;
  timestamp: string;
}

export function validatePayload(payload: string): ValidationReport {
  const cleanPayload = payload.trim();
  
  const sqliPatterns = [
    /UNION\s+SELECT/i,
    /OR\s+['"]?\d+['"]?\s*=\s*['"]?\d+/i,
    /SELECT\s+.*FROM/i,
    /INSERT\s+INTO/i,
    /DROP\s+TABLE/i,
    /--/,
    /\bHEX\b/i
  ];
  
  const xssPatterns = [
    /<script[^>]*>/i,
    /javascript:/i,
    /onerror\s*=/i,
    /onload\s*=/i,
    /eval\s*\(/i,
    /alert\s*\(/i,
    /document\.cookie/i
  ];

  const traversalPatterns = [
    /\.\.\//,
    /\.\.\\/,
    /\/etc\/passwd/i,
    /c:\\windows\\system32/i
  ];

  const cmdInjectionPatterns = [
    /;\s*(rm|cat|ls|sh|bash|cmd|powershell)\b/i,
    /\|\s*(rm|cat|ls|sh|bash|cmd|powershell)\b/i,
    /&\s*(rm|cat|ls|sh|bash|cmd|powershell)\b/i
  ];

  let isThreat = false;
  let threatType: ValidationReport['threatType'] = 'NONE';
  let riskScore = 0;
  let sanitizedPayload = cleanPayload;
  let mitigationRecommendation = 'No action required. Traffic is clean.';

  for (const regex of traversalPatterns) {
    if (regex.test(cleanPayload)) {
      isThreat = true;
      threatType = 'PATH_TRAVERSAL';
      riskScore = 80;
      sanitizedPayload = cleanPayload.replace(/\.\.\//g, '').replace(/\.\.\\/g, '');
      mitigationRecommendation = 'Block directory traversal sequence. Validate file paths against whitelist.';
      break;
    }
  }

  if (!isThreat) {
    for (const regex of cmdInjectionPatterns) {
      if (regex.test(cleanPayload)) {
        isThreat = true;
        threatType = 'COMMAND_INJECTION';
        riskScore = 98;
        sanitizedPayload = cleanPayload.replace(/[;&|]/g, ' [RESTRICTED_CHAR] ');
        mitigationRecommendation = 'Critical block: Command execution characters detected. Implement parameterized arguments.';
        break;
      }
    }
  }

  if (!isThreat) {
    for (const regex of sqliPatterns) {
      if (regex.test(cleanPayload)) {
        isThreat = true;
        threatType = 'SQL_INJECTION';
        riskScore = 95;
        sanitizedPayload = cleanPayload
          .replace(/'/g, "''")
          .replace(/UNION/gi, '[BLOCKED_UNION]')
          .replace(/SELECT/gi, '[BLOCKED_SELECT]');
        mitigationRecommendation = 'Enforce SQL Prepared Statements and Parameterized Queries immediately.';
        break;
      }
    }
  }

  if (!isThreat) {
    for (const regex of xssPatterns) {
      if (regex.test(cleanPayload)) {
        isThreat = true;
        threatType = 'CROSS_SITE_SCRIPTING';
        riskScore = 88;
        sanitizedPayload = cleanPayload
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
          .replace(/\//g, '&#x2F;');
        mitigationRecommendation = 'Enable Content Security Policy (CSP), sanitize input, and contextually HTML-encode values.';
        break;
      }
    }
  }

  return {
    isThreat,
    threatType,
    riskScore,
    originalPayload: payload,
    sanitizedPayload,
    mitigationRecommendation,
    timestamp: new Date().toISOString()
  };
}
