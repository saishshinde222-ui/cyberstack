export type Finding = {
  severity: "critical" | "high" | "medium" | "low";
  rule: string;
  file: string;
  line?: number;
  message: string;
  recommendation?: string;
};

const SECRET_PATTERNS: { pattern: RegExp; rule: string; severity: Finding["severity"] }[] = [
  { pattern: /(?:aws_access_key_id|AKIA[A-Z0-9]{16})\s*=\s*["']?[A-Za-z0-9/+=]{20,}["']?/i, rule: "AWS_ACCESS_KEY", severity: "critical" },
  { pattern: /(?:aws_secret_access_key|secret)\s*=\s*["']?[A-Za-z0-9/+=]{40}["']?/i, rule: "AWS_SECRET_KEY", severity: "critical" },
  { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*["']?[a-zA-Z0-9_-]{20,}["']?/i, rule: "API_KEY_EXPOSED", severity: "high" },
  { pattern: /(?:password|passwd|pwd)\s*[:=]\s*["'][^"']+["']/i, rule: "HARDCODED_PASSWORD", severity: "high" },
  { pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/, rule: "PRIVATE_KEY", severity: "critical" },
  { pattern: /(?:ghp_|github_pat_)[a-zA-Z0-9_]{20,}/, rule: "GITHUB_TOKEN", severity: "critical" },
  { pattern: /sk-[a-zA-Z0-9]{32,}/, rule: "OPENAI_KEY", severity: "high" },
];

const VULN_DEPS: Record<string, string> = {
  "lodash": "4.17.21",
  "axios": "1.6.0",
  "minimist": "1.2.6",
  "yargs-parser": "18.1.3",
  "immer": "9.0.6",
  "next": "13.0.0",
  "express": "4.18.0",
  "moment": "2.29.4",
  "jquery": "3.5.0",
  "serialize-javascript": "6.0.0",
  "node-fetch": "2.6.7",
};

const CODE_PATTERNS: { pattern: RegExp; rule: string; severity: Finding["severity"] }[] = [
  { pattern: /\beval\s*\(/i, rule: "EVAL_USAGE", severity: "high" },
  { pattern: /\.innerHTML\s*=/i, rule: "INNERHTML_ASSIGNMENT", severity: "medium" },
  { pattern: /document\.write\s*\(/i, rule: "DOCUMENT_WRITE", severity: "medium" },
  { pattern: /(?:SELECT|INSERT|UPDATE|DELETE)\s+[^;]*\+/i, rule: "SQL_CONCATENATION", severity: "critical" },
  { pattern: /new\s+Function\s*\(/i, rule: "DYNAMIC_CODE", severity: "high" },
  { pattern: /dangerouslySetInnerHTML/i, rule: "REACT_DANGEROUS_HTML", severity: "medium" },
  { pattern: /localStorage\.setItem\s*\(\s*["'](?:token|password|secret)/i, rule: "SENSITIVE_STORAGE", severity: "high" },
  { pattern: /md5\s*\(|createHash\s*\(\s*["']md5["']/i, rule: "WEAK_HASH", severity: "medium" },
  { pattern: /console\.(log|debug|info)\s*\(/i, rule: "DEBUG_STATEMENT", severity: "low" },
  { pattern: /\bdebugger\s*;?/i, rule: "DEBUGGER_STATEMENT", severity: "low" },
  { pattern: /\.exec\s*\(\s*[^)]*\+/i, rule: "COMMAND_INJECTION_RISK", severity: "high" },
];

const CONFIG_PATTERNS: { pattern: RegExp; rule: string; severity: Finding["severity"] }[] = [
  { pattern: /NODE_ENV\s*[=:]\s*["']?development["']?/i, rule: "DEV_IN_PRODUCTION", severity: "medium" },
  { pattern: /DEBUG\s*[=:]\s*["']?true["']?/i, rule: "DEBUG_ENABLED", severity: "low" },
  { pattern: /origin\s*:\s*["']?\*["']?|CORS\s*:\s*["']?\*["']?/i, rule: "PERMISSIVE_CORS", severity: "high" },
  { pattern: /insecure\s*:\s*true|rejectUnauthorized\s*:\s*false/i, rule: "INSECURE_TLS", severity: "critical" },
  { pattern: /(?:API_KEY|SECRET|PASSWORD|TOKEN|DATABASE_PASSWORD|AWS_ACCESS_KEY)\s*[=:]/i, rule: "SENSITIVE_CONFIG", severity: "medium" },
  { pattern: /expose\s*:\s*["']?\*["']?/i, rule: "EXPOSED_PORTS", severity: "low" },
];

const MAX_FINDINGS_PER_SCAN = 50;

export function scanSecrets(files: { path: string; content: string }[]): Finding[] {
  const findings: Finding[] = [];
  for (const { path, content } of files) {
    if (findings.length >= MAX_FINDINGS_PER_SCAN) break;
    const lines = content.split("\n");
    lines.forEach((line, i) => {
      for (const { pattern, rule, severity } of SECRET_PATTERNS) {
        if (findings.length >= MAX_FINDINGS_PER_SCAN) return;
        if (pattern.test(line)) {
          findings.push({
            severity,
            rule,
            file: path,
            line: i + 1,
            message: `Potential secret detected: ${rule}`,
            recommendation: "Remove hardcoded secrets. Use environment variables or a secrets manager.",
          });
        }
      }
    });
  }
  return findings;
}

export function scanDependencies(files: { path: string; content: string }[]): Finding[] {
  const findings: Finding[] = [];
  const pkg = files.find((f) => f.path.endsWith("package.json"));
  if (!pkg) return findings;

  try {
    const data = JSON.parse(pkg.content);
    const deps = { ...data.dependencies, ...data.devDependencies };
    for (const [name, ver] of Object.entries(deps)) {
      const minVer = VULN_DEPS[name.toLowerCase()];
      if (minVer) {
        const v = String(ver).replace(/^[\^~]/, "").split("-")[0];
        const verNum = v.split(".").map(Number);
        const minNum = minVer.split(".").map(Number);
        let older = false;
        for (let i = 0; i < Math.max(verNum.length, minNum.length); i++) {
          const a = verNum[i] ?? 0;
          const b = minNum[i] ?? 0;
          if (a < b) { older = true; break; }
          if (a > b) break;
        }
        if (older) findings.push({
          severity: "high",
          rule: "VULNERABLE_DEPENDENCY",
          file: "package.json",
          message: `Known vulnerable dependency: ${name} ${ver}. Upgrade to ${minVer} or later.`,
          recommendation: `Run 'npm update ${name}' or upgrade manually.`,
        });
      }
    }
  } catch {
    // ignore parse errors
  }
  return findings;
}

export function scanCode(files: { path: string; content: string }[]): Finding[] {
  const findings: Finding[] = [];
  const codeExt = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"];
  for (const { path, content } of files) {
    if (findings.length >= MAX_FINDINGS_PER_SCAN) break;
    if (!codeExt.some((e) => path.endsWith(e))) continue;
    const lines = content.split("\n");
    lines.forEach((line, i) => {
      for (const { pattern, rule, severity } of CODE_PATTERNS) {
        if (findings.length >= MAX_FINDINGS_PER_SCAN) return;
        if (pattern.test(line)) {
          findings.push({
            severity,
            rule,
            file: path,
            line: i + 1,
            message: `Security concern: ${rule.replace(/_/g, " ")}`,
            recommendation: "Review and remediate. Use parameterized queries, sanitize user input, avoid eval.",
          });
        }
      }
    });
  }
  return findings;
}

export function scanConfig(files: { path: string; content: string }[]): Finding[] {
  const findings: Finding[] = [];
  const configPaths = [".env", ".env.example", "docker-compose", "Dockerfile", ".yml", ".yaml", "config.js"];
  for (const { path, content } of files) {
    if (findings.length >= MAX_FINDINGS_PER_SCAN) break;
    const isConfig = configPaths.some((p) => path.includes(p));
    if (!isConfig) continue;
    const lines = content.split("\n");
    lines.forEach((line, i) => {
      for (const { pattern, rule, severity } of CONFIG_PATTERNS) {
        if (findings.length >= MAX_FINDINGS_PER_SCAN) return;
        if (pattern.test(line)) {
          findings.push({
            severity,
            rule,
            file: path,
            line: i + 1,
            message: `Config issue: ${rule.replace(/_/g, " ")}`,
            recommendation: "Fix configuration for production security.",
          });
        }
      }
    });
  }
  return findings;
}
