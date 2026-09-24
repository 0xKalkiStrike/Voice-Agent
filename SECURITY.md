# AURA Security Architecture & Guardrails

Security and privacy are primary design requirements for AURA.

## Security Layers

1. **Prompt Injection Defense**:
   - External document content and web search snippets are wrapped inside strict `<UNTRUSTED_DOCUMENT_CONTENT>` boundary tags.
   - Suspicious instruction override patterns (e.g. "ignore previous instructions") are automatically replaced with `[REDACTED_SUSPICIOUS_INSTRUCTION]`.

2. **Tool Permission Model**:
   - **READ**: Can execute automatically (e.g. `search_documents`, `calculator`, `project_status`).
   - **WRITE**: Requires user confirmation unless `auto_approve_write` setting is enabled (e.g. `create_draft`, `notification`).
   - **DESTRUCTIVE**: Always requires explicit user confirmation (e.g. deleting files or database records).

3. **Path Traversal Protection**:
   - All document access and file operations resolve target paths against base directories using `SecurityGuard.sanitize_path`.

4. **Secret Redaction**:
   - API keys, bearer tokens, passwords, and private credentials are automatically redacted before logs or responses are returned.
