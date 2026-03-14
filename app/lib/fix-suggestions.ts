/** Suggest a fix for a line based on the finding rule */
export function suggestFix(rule: string, lineContent: string): string {
  const trimmed = lineContent.trim();

  switch (rule) {
    case "API_KEY_EXPOSED":
    case "AWS_ACCESS_KEY":
    case "AWS_SECRET_KEY":
    case "HARDCODED_PASSWORD":
    case "GITHUB_TOKEN":
    case "OPENAI_KEY":
    case "SENSITIVE_CONFIG": {
      const match = trimmed.match(/^([^=:]+)([=:])\s*["']?[^"']*["']?\s*;?$/);
      if (match) {
        const before = match[1].trim();
        const envVar = before.toUpperCase().replace(/[^A-Z0-9]/g, "_").replace(/_+/g, "_") || "SECRET";
        return `${before}${match[2]} process.env.${envVar} ?? "";`;
      }
      return trimmed.replace(/["'][^"']*["']/, 'process.env.SECRET ?? ""');
    }
    case "DEBUG_STATEMENT":
    case "DEBUGGER_STATEMENT":
      return ""; // remove line
    case "EVAL_USAGE":
      return trimmed.replace(/eval\s*\(\s*([^)]+)\s*\)/, "JSON.parse($1)"); // best-effort
    case "INSECURE_TLS":
      return trimmed.replace(/rejectUnauthorized\s*:\s*false/, "rejectUnauthorized: true");
    case "PERMISSIVE_CORS":
    case "CORS":
      return trimmed.replace(/origin\s*:\s*["']?\*["']?/, 'origin: process.env.ALLOWED_ORIGINS?.split(",") ?? []');
    case "DEV_IN_PRODUCTION":
      return trimmed.replace(/development/, "production");
    case "DEBUG_ENABLED":
      return trimmed.replace(/true/, "false");
    case "SQL_CONCATENATION":
      return trimmed.replace(/\+/g, "/* use parameterized query */ +");
    case "INNERHTML_ASSIGNMENT":
      return trimmed.replace(/\.innerHTML\s*=/, ".textContent =");
    case "WEAK_HASH":
      return trimmed.replace(/["']md5["']/, '"sha256"');
    case "DOCUMENT_WRITE":
      return trimmed.replace(/document\.write\s*\(/, "// Avoid document.write - use DOM APIs instead. ");
    case "SENSITIVE_STORAGE":
      return "// Remove: do not store tokens/passwords in localStorage. Use httpOnly cookies.";
    case "REACT_DANGEROUS_HTML":
      return trimmed.replace(/dangerouslySetInnerHTML/, "// Sanitize HTML first. dangerouslySetInnerHTML");
    case "DYNAMIC_CODE":
      return trimmed.replace(/new\s+Function\s*\(/, "// Avoid dynamic code. Use JSON.parse or safe eval. new Function(");
    case "COMMAND_INJECTION_RISK":
      return trimmed.replace(/\+/g, "/* sanitize input */ +");
    case "EXPOSED_PORTS":
      return trimmed.replace(/["']?\*["']?/, "specific-ports-only");
    default:
      return trimmed;
  }
}

export function canAutoFix(rule: string): boolean {
  return [
    "API_KEY_EXPOSED", "AWS_ACCESS_KEY", "AWS_SECRET_KEY", "HARDCODED_PASSWORD",
    "GITHUB_TOKEN", "OPENAI_KEY", "SENSITIVE_CONFIG", "DEBUG_STATEMENT", "DEBUGGER_STATEMENT",
    "EVAL_USAGE", "INSECURE_TLS", "PERMISSIVE_CORS", "DEV_IN_PRODUCTION", "DEBUG_ENABLED",
    "SQL_CONCATENATION", "INNERHTML_ASSIGNMENT", "WEAK_HASH", "DOCUMENT_WRITE",
    "SENSITIVE_STORAGE", "REACT_DANGEROUS_HTML", "DYNAMIC_CODE", "COMMAND_INJECTION_RISK",
    "EXPOSED_PORTS",
  ].includes(rule);
}
