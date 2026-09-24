# AURA Hackathon Demonstration Workflows

Three demonstration scenarios showing AURA's voice recognition, document intelligence, task management, and AMD acceleration diagnostics.

---

### DEMO 1: Document Intelligence & RAG
- **Voice Prompt**: *"Search my project documents and tell me what the biggest unresolved requirement is."*
- **AURA Action**:
  1. Transcribes voice input.
  2. Executes `search_documents` tool across local JSON document repository (`data/documents.json`).
  3. Retrieves relevant chunks with citations.
  4. Synthesizes concise answer citing source document and section.
  5. Responds via text & voice.

---

### DEMO 2: Project Management & Action Approval
- **Voice Prompt**: *"Find the incomplete tasks and prepare a summary for the team."*
- **AURA Action**:
  1. Executes `task_search` to query `data/tasks.json`.
  2. Identifies open and in-progress tasks.
  3. Prepares a draft summary using `create_draft` (WRITE level tool).
  4. Triggers permission approval request on UI: *"Tool 'create_draft' requires approval."*
  5. Upon user confirmation, finalizes summary and responds.

---

### DEMO 3: AMD Hardware Diagnostics & Environment Probe
- **Voice Prompt**: *"Check my local AI environment and tell me whether it is ready for accelerated inference."*
- **AURA Action**:
  1. Executes `system_information` tool.
  2. Queries AMD ROCm diagnostics module (`rocm-smi`, PyTorch HIP status).
  3. Displays actual GPU utilization, VRAM usage, and driver information in the AMD tab.
  4. Responds with status and hardware specs.
