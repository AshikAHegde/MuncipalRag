# Legal Knowledge Graph — Feature Specification

**Project:** MuncipalRag — Multi-Agent Legal RAG System  
**Date:** April 24, 2026  
**Authors:** Team MuncipalRag  

---

## 1. Executive Summary

This document describes a novel feature for the MuncipalRag platform: an **Automated Legal Knowledge Graph** that maps the structural relationships between laws, sections, amendments, and legal provisions. Unlike traditional flat vector search (RAG), this feature constructs a traversable graph of interconnected legal rules at document-upload time, enabling lawyers to visually explore how laws relate to each other and receive AI-powered insights about all transitively connected provisions for any given case.

> **Core Innovation:** The combination of Retrieval-Augmented Generation (semantic vector search) with a dynamically constructed Legal Knowledge Graph (structural relationship traversal) to provide holistic, multi-hop legal analysis that no existing legal-tech system offers.

---

## 2. Problem Statement

### How lawyers work today (manual process)

1. A lawyer reads **Section 420 (Cheating)** of the Indian Penal Code.
2. The text says *"Whoever cheats and thereby dishonestly induces..."* — the lawyer mentally recalls that "cheating" is **defined in Section 415**.
3. They look up Section 415, which references **Section 405 (Criminal breach of trust)** as a related offence.
4. They then consider whether **Section 120B (Criminal Conspiracy)** applies if multiple parties are involved.
5. They check if any **amendments** have modified these sections.
6. They consider **cross-domain implications** — e.g., does the fraud also trigger the **Prevention of Money Laundering Act**?

This entire process is **manual, error-prone, and time-consuming**. A lawyer must hold this mental graph in their head, and missing even one connection can weaken a case.

### What the current system does

The existing MuncipalRag system uses **flat vector search**: a user query is embedded and matched against document chunks in Pinecone. This finds *semantically similar* text but does **not understand structural relationships** between laws. It cannot tell you that Section 420 *requires* Section 415, or that a criminal fraud *triggers* a tax investigation.

### What the Knowledge Graph solves

The Knowledge Graph fills this structural gap by maintaining explicit, navigable relationships between legal provisions, enabling:

- **Automatic discovery** of all connected laws for a case
- **Visual exploration** of the legal landscape
- **Multi-hop reasoning** that catches connections a flat search would miss
- **Cross-domain cascading** — automatically linking criminal, civil, corporate, and tax implications

---

## 3. Technical Architecture

### 3.1 System Overview

```
┌─────────────────────────────────────────────────────────┐
│                   DOCUMENT UPLOAD                        │
│                                                         │
│  PDF → Text Extraction → Chunking → Pinecone Vectors   │
│                              ↓                          │
│              Graph Construction Pipeline                │
│    ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│    │ Regex-Based  │  │  LLM-Based   │  │  Metadata  │  │
│    │  Reference   │  │  Implicit    │  │   Based    │  │
│    │  Extraction  │  │  Relation    │  │   Domain   │  │
│    │  (High Conf) │  │  Detection   │  │   Links    │  │
│    └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  │
│           └─────────────────┼────────────────┘          │
│                             ↓                           │
│                    MongoDB Graph Store                   │
│              (Adjacency list per section)                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   CASE ANALYSIS QUERY                    │
│                                                         │
│  User Query → Pinecone (entry-point sections)           │
│                    ↓                                    │
│         Graph Traversal (BFS, 2-3 hops)                │
│                    ↓                                    │
│         Subgraph + Retrieved Texts                     │
│                    ↓                                    │
│         LLM Reasoning over Subgraph                    │
│                    ↓                                    │
│    ┌────────────────────────────────────┐               │
│    │  Interactive Graph Visualization  │               │
│    │  + Structured Legal Insights      │               │
│    └────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Graph Data Model

#### Node (Legal Provision)

| Field | Type | Description |
|-------|------|-------------|
| `sectionId` | String | Unique ID, e.g., `IPC-420`, `CA-166` |
| `sectionNumber` | String | e.g., "420" |
| `actName` | String | e.g., "Indian Penal Code" |
| `sectionTitle` | String | e.g., "Cheating and dishonestly inducing delivery of property" |
| `domain` | Enum | criminal, civil, corporate, tax |
| `summary` | String | LLM-generated 1-2 line summary |
| `punishment` | String | Applicable penalty (if any) |
| `sourceDocId` | String | Reference to the uploaded Document |
| `pineconeChunkIds` | String[] | Links to the vector chunks for full text retrieval |

#### Edge (Relationship)

| Field | Type | Description |
|-------|------|-------------|
| `from` | String | Source sectionId |
| `to` | String | Target sectionId |
| `type` | Enum | See "Edge Types" below |
| `confidence` | Enum | `high` (regex-detected) or `ai_inferred` (LLM-detected) |
| `reason` | String | Short explanation of why this link exists |
| `extractedFrom` | String | The original text snippet that established this link |

#### Edge Types

| Type | Meaning | Detection Method | Reliability |
|------|---------|------------------|-------------|
| `REFERENCES` | "as defined in Section X" | Regex | ~95% |
| `READ_WITH` | "read with Section X" | Regex | ~95% |
| `AMENDED_BY` | "amended by Act X of Year Y" | Regex | ~90% |
| `SUBJECT_TO` | "subject to the provisions of Section X" | Regex | ~90% |
| `NOTWITHSTANDING` | "notwithstanding anything in Section X" | Regex | ~90% |
| `PREREQUISITE` | Section X requires establishing Section Y first | LLM | ~80% |
| `EXCEPTION` | "nothing in this section applies if..." | LLM | ~80% |
| `ESCALATION` | Combined charges increase severity | LLM | ~75% |
| `CROSS_DOMAIN` | Criminal act triggers tax/corporate consequences | LLM + Domain Agents | ~80% |

### 3.3 MongoDB Schema

```javascript
// models/LegalGraph.js
const legalNodeSchema = new mongoose.Schema({
  sectionId:      { type: String, required: true, unique: true, index: true },
  sectionNumber:  { type: String, required: true },
  actName:        { type: String, required: true },
  sectionTitle:   { type: String, default: "" },
  domain:         { type: String, enum: ["criminal","civil","corporate","tax"] },
  summary:        { type: String, default: "" },
  punishment:     { type: String, default: "" },
  sourceDocId:    { type: String, index: true },
  pineconeChunkIds: [String],
  edges: [{
    targetSectionId: { type: String, required: true },
    type:       { type: String, enum: [
      "REFERENCES","READ_WITH","AMENDED_BY","SUBJECT_TO",
      "NOTWITHSTANDING","PREREQUISITE","EXCEPTION","ESCALATION","CROSS_DOMAIN"
    ]},
    confidence: { type: String, enum: ["high", "ai_inferred"], default: "high" },
    reason:     { type: String, default: "" },
    extractedFrom: { type: String, default: "" },
  }],
}, { timestamps: true });
```

---

## 4. Graph Construction Pipeline

### 4.1 Phase 1: Regex-Based Extraction (High Confidence)

Applied during document upload, after text chunking.

```javascript
const REFERENCE_PATTERNS = [
  { regex: /(?:section|sec\.?)\s+(\d+[A-Z]?)/gi,        type: "REFERENCES" },
  { regex: /read\s+with\s+(?:section|sec\.?)\s+(\d+)/gi, type: "READ_WITH" },
  { regex: /subject\s+to\s+(?:section|sec\.?)\s+(\d+)/gi,type: "SUBJECT_TO" },
  { regex: /amended\s+by\s+(.+?act.+?\d{4})/gi,          type: "AMENDED_BY" },
  { regex: /notwithstanding.+?(?:section|sec\.?)\s+(\d+)/gi, type: "NOTWITHSTANDING" },
];
```

For each chunk of text:
1. Identify which section this chunk belongs to (from metadata)
2. Run all regex patterns against the chunk text
3. For each match, create an edge: `{ from: currentSection, to: matchedSection, type, confidence: "high" }`
4. Store the matched text snippet as `extractedFrom`

### 4.2 Phase 2: LLM-Based Extraction (AI-Inferred)

After regex extraction, use a structured LLM prompt on each section's combined text:

```
You are a legal relationship extraction agent.
Given the text of a legal section, identify ALL other sections, acts,
or legal provisions that are logically connected.

For each connection, specify:
- target_section: "Section X of [Act Name]"
- relationship_type: PREREQUISITE | EXCEPTION | ESCALATION | CROSS_DOMAIN
- reason: one-sentence explanation

Return JSON only: { "connections": [...] }
Only include connections you are confident about from the text.
```

These edges are stored with `confidence: "ai_inferred"`.

### 4.3 Phase 3: Cross-Domain Links

Leverage the existing `comparisonAgent.js` results. When the comparison agent detects that a criminal conflict has tax implications, store this as a `CROSS_DOMAIN` edge in the graph.

---

## 5. Graph Traversal for Case Analysis

### 5.1 Entry Point Discovery

When a lawyer submits a case query:
1. **Pinecone search** identifies the top-K relevant sections (entry points)
2. These become the **seed nodes** for graph traversal

### 5.2 Subgraph Extraction (BFS)

```
function extractCaseSubgraph(seedNodes, maxDepth = 3):
    visited = Set()
    queue = seedNodes.map(n => ({ node: n, depth: 0 }))
    subgraph = { nodes: [], edges: [] }

    while queue is not empty:
        { node, depth } = queue.dequeue()
        if node in visited or depth > maxDepth:
            continue
        visited.add(node)
        subgraph.nodes.push(node)

        for each edge of node.edges:
            subgraph.edges.push(edge)
            if edge.target not in visited:
                queue.enqueue({ node: edge.target, depth: depth + 1 })

    return subgraph
```

### 5.3 Graph-Based Insights

Once the subgraph is extracted, compute:

| Insight | Algorithm | What it tells the lawyer |
|---------|-----------|--------------------------|
| **Most connected section** | Degree centrality | Which law is the "hub" — most referenced by other laws |
| **Critical path** | Shortest path between two sections | The chain of legal logic connecting two provisions |
| **Legal clusters** | Connected components | Groups of laws that form a self-contained legal framework |
| **Cascade risk** | Reachability analysis | How many cross-domain sections are reachable from the primary offence |
| **Amendment history** | Filter edges by `AMENDED_BY` | Timeline of how the relevant law has evolved |

---

## 6. Frontend Visualization

### 6.1 Interactive Graph View

Use **Cytoscape.js** (recommended) or D3.js to render an interactive force-directed graph:

- **Nodes** are colored by domain (red = criminal, amber = civil, blue = corporate, green = tax)
- **Edge thickness** indicates confidence (thick = high, thin = ai_inferred)
- **Edge color** indicates type (solid = reference, dashed = exception, dotted = cross-domain)
- **Clicking a node** opens a side panel with the full section text (retrieved from Pinecone)
- **Hovering an edge** shows the relationship reason and source text
- **Zoom/pan** for large graphs; focus mode to center on a specific section

### 6.2 Insights Panel

Alongside the graph, display a structured panel:

```
┌──────────────────────────────────────────────────────┐
│  CASE: "Client cheated out of ₹5 lakhs via          │
│         fake investment scheme"                      │
├──────────────────────────────────────────────────────┤
│  PRIMARY SECTIONS IDENTIFIED                         │
│  ● IPC 420 — Cheating (Criminal)                    │
│  ● IPC 415 — Definition of cheating (Criminal)      │
│                                                      │
│  CONNECTED PROVISIONS (via graph traversal)          │
│  ├─ IPC 120B — Criminal Conspiracy [READ_WITH]      │
│  ├─ IPC 467 — Forgery [PREREQUISITE]                │
│  ├─ PMLA Section 3 — Money Laundering [CROSS_DOMAIN]│
│  └─ IT Act Section 276C — Tax Evasion [CROSS_DOMAIN]│
│                                                      │
│  INSIGHTS                                            │
│  ⚡ Hub section: IPC 420 (connected to 6 provisions) │
│  ⚡ Cross-domain risk: 2 domains affected            │
│  ⚡ Maximum penalty path: IPC 420 + 120B = 10 years  │
│                                                      │
│  CONFIDENCE                                          │
│  ■■■■■ 4 high-confidence links (regex-detected)     │
│  ■■■░░ 2 AI-inferred links (LLM-detected)           │
└──────────────────────────────────────────────────────┘
```

---

## 7. API Design

### 7.1 New Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/graph/section/:sectionId` | Get a section node with its edges |
| `GET` | `/api/graph/subgraph?seeds=IPC-420,IPC-415&depth=3` | Get traversed subgraph |
| `GET` | `/api/graph/insights?seeds=IPC-420` | Get computed insights for a subgraph |
| `GET` | `/api/graph/search?q=cheating&domain=criminal` | Search nodes by text |
| `POST` | `/api/graph/case-analysis` | Full case analysis: query → entry points → subgraph → insights |

### 7.2 Integration with Existing Query Flow

```
Existing:  POST /api/query → orchestrator → domain agents → report
Proposed:  POST /api/query → orchestrator → domain agents → report
                                                    ↓
                                              graph traversal
                                                    ↓
                                            enriched report with
                                            connected provisions
```

The graph results would be added to the existing `review` object in the query response, making it backward-compatible.

---

## 8. Integration Points with Existing Codebase

| Existing File | Integration |
|---------------|-------------|
| `ragService.js → processDocument()` | After Pinecone indexing, trigger graph construction |
| `agentOrchestrator.js → handleQuery()` | After conflict detection, run graph traversal for enrichment |
| `adminController.js → uploadDocument()` | Add graph status tracking alongside Pinecone status |
| `AnswerCard.jsx` | Add "View Knowledge Graph" button that opens the graph visualizer |
| `App.jsx` | Add new route `/graph` for the full-page graph explorer |

---

## 9. Implementation Phases

### Phase 1 — Foundation (3-4 days)
- [ ] Create `LegalGraph` MongoDB model
- [ ] Build regex-based reference extractor
- [ ] Integrate extraction into `processDocument()` pipeline
- [ ] Create `/api/graph/section/:id` and `/api/graph/subgraph` endpoints
- [ ] Basic Cytoscape.js visualization in frontend

### Phase 2 — Intelligence (3-4 days)
- [ ] Add LLM-based implicit relationship extraction
- [ ] Build BFS subgraph traversal engine
- [ ] Compute graph insights (centrality, clusters, cascade risk)
- [ ] Create insights panel in frontend
- [ ] Add `/api/graph/case-analysis` endpoint

### Phase 3 — Integration (2-3 days)
- [ ] Integrate graph results into the existing lawyer-mode query flow
- [ ] Add graph enrichment to the report agent output
- [ ] Add "View Knowledge Graph" button in AnswerCard
- [ ] Edge confidence indicators and filtering in the UI

### Phase 4 — Polish (2-3 days)
- [ ] Graph search functionality
- [ ] Amendment timeline view
- [ ] Export graph as image/PDF
- [ ] Performance optimization for large graphs

**Total estimated effort: 10-14 days**

---

## 10. Reliability & Limitations

### Strengths
- **Explicit cross-references** (70-80% of edges) are detected with ~95% accuracy via regex
- **Graph traversal** is deterministic — once built, BFS/DFS is 100% reliable
- **Incremental construction** — graph grows as more documents are uploaded
- **Confidence labeling** — lawyers see which connections are regex-proven vs AI-inferred

### Limitations
- **Corpus dependency** — the graph only covers uploaded documents; missing PDFs = missing nodes
- **LLM inference errors** — AI-inferred edges may include false connections (~20% error rate)
- **Ambiguous section numbering** — different acts may have the same section numbers (solved by including act name in sectionId)
- **Amendment tracking** — requires that amendment documents are explicitly uploaded

### Mitigation Strategies
- Display confidence levels on every edge
- Allow lawyers to manually confirm or reject AI-inferred edges
- Maintain separate counters for regex vs AI-inferred edges in the insights panel
- Periodically re-run graph construction as new documents are added

---

## 11. Patent Claims (Draft)

1. **A computer-implemented method** for automatically constructing a legal knowledge graph from unstructured legal documents, comprising: extracting legal provision nodes and inter-provision relationships using a hybrid of deterministic pattern matching and large language model inference, storing said graph in a database, and traversing the graph in response to a legal query to identify all transitively connected provisions.

2. **A system** that combines vector-based semantic retrieval (RAG) with structural knowledge graph traversal to provide multi-hop legal analysis, wherein entry-point provisions are identified via embedding similarity and subsequently expanded via graph traversal to discover structurally connected but semantically distant legal provisions.

3. **A method** for computing legal risk scores by analyzing the topological properties of a dynamically constructed legal knowledge graph, including cross-domain cascade risk, provision centrality, and amendment impact propagation.

---

## 12. Competitive Advantage

| Existing Legal-Tech | What they do | What we do differently |
|---------------------|-------------|----------------------|
| Traditional legal search | Keyword matching | Semantic + structural graph search |
| LLM-based legal chat | Flat Q&A, no structure | Graph-backed multi-hop reasoning |
| Legal databases (SCC, Manupatra) | Manual cross-reference browsing | Automatic graph construction + traversal |
| General RAG systems | Vector similarity only | RAG + Knowledge Graph hybrid |

**No existing legal-tech platform automatically constructs and traverses a legal knowledge graph from uploaded documents.** This is the core differentiator.
