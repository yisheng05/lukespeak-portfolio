# Multi-Agent Regulatory Synthesis: Stateful LangGraph Workflows for Cross-Jurisdiction Compliance

Analyzing regulatory compliance policies across international financial hubs—such as comparing dormant asset recovery laws across the UK, Switzerland, and Singapore—presents significant challenges for single-prompt LLM systems. Standard RAG tools often hallucinate jurisdiction boundaries, mix legal frameworks, or produce unsupported summaries lacking direct citations.

To solve this, we created `dormant-asset-policy-strategic`—a production multi-agent system built on **LangGraph** that orchestrates six parallel domain expert agents, enforces strict citation tag matching (`[REF-N]`), and renders an interactive evidence matrix in Streamlit.

---

## Multi-Agent State Graph Architecture

Instead of passing massive regulatory PDFs into a single monolithic prompt, our system decomposes regulatory analysis into a directed graph of specialized agents:

```
                  ┌────────────────────────┐
                  │ 1. Intent & Persona    │
                  │    Classifier          │
                  └───────────┬────────────┘
                              │
                              ▼
                  ┌────────────────────────┐
                  │ 2. Document &          │
                  │    Jurisdiction Mapper │
                  └───────────┬────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Reader Agent:   │  │ Reader Agent:   │  │ Reader Agent:   │
│ UK Policy       │  │ Switzerland     │  │ Singapore       │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                              ▼
                  ┌────────────────────────┐
                  │ 3. Synthesis & Citation│
                  │    Verification Agent  │
                  └───────────┬────────────┘
                              │
                              ▼
                  ┌────────────────────────┐
                  │ 4. Interactive         │
                  │    Evidence Matrix     │
                  └────────────────────────┘
```

---

## Implementing Stateful Multi-Agent LangGraph

The entire workflow passes a unified `PolicyAnalysisState` object through each node in the LangGraph topology:

```python
from typing import TypedDict, List, Dict, Annotated
import operator

class PolicyAnalysisState(TypedDict):
    user_query: str
    persona: str  # e.g., 'Regulatory Architect' or 'Social Impact Strategist'
    jurisdictions: List[str]
    raw_evidence: Annotated[List[Dict], operator.add]  # Thread-safe accumulator
    synthesis_report: str
    citation_map: Dict[str, str]  # Maps [REF-1] -> exact PDF quote & page number
```

### Parallel Reader Node Execution

When analyzing multiple statutory documents, LangGraph executes parallel `Reader` agents for each detected jurisdiction:

```python
from langgraph.graph import StateGraph, END

def reader_node(state: PolicyAnalysisState, jurisdiction: str):
    """Specialized reader that extracts literal quotes for a specific jurisdiction."""
    docs = load_pdf_sources(jurisdiction)
    extracted_quotes = []
    
    for doc in docs:
        quotes = extract_literal_policy_statements(doc, state['user_query'])
        for q in quotes:
            ref_id = f"REF-{len(state['raw_evidence']) + 1}"
            extracted_quotes.append({
                "ref_id": ref_id,
                "jurisdiction": jurisdiction,
                "page": doc.page_number,
                "quote": q.text,
                "source": doc.filename
            })
            
    return {"raw_evidence": extracted_quotes}
```

---

## Strict Citation Tag Matching (`[REF-N]`)

To prevent narrative hallucination in the final strategic synthesis report, the `Synthesis Agent` is constrained by strict prompt and state validation rules:

1. **No Fact Without Reference:** Every statement in the synthesis report must end with an explicit reference tag (e.g., `[REF-1]`, `[REF-2]`).
2. **Evidence Visualizer Integration:** In the Streamlit UI, clicking any `[REF-N]` tag highlights the exact source PDF quote, page number, and document provenance in a side-by-side drawer.

```python
def verify_synthesis_citations(report: str, evidence_list: List[Dict]) -> bool:
    import re
    valid_refs = {item['ref_id'] for item in evidence_list}
    found_refs = set(re.findall(r'\[(REF-\d+)\]', report))
    
    # Ensure all cited references actually exist in extracted evidence
    invalid_citations = found_refs - valid_refs
    if invalid_citations:
        raise ValueError(f"Report contains unverified citations: {invalid_citations}")
    return True
```

---

## Comparative Jurisdictional Matrix

The system dynamically constructs a comparative policy matrix across jurisdictions based on persona inquiry pillars:

| Inquiry Pillar | United Kingdom (Dormant Assets Act) | Switzerland (FINMA Guidelines) | Singapore (Banking Act Sec 52) |
| :--- | :--- | :--- | :--- |
| **Dormancy Threshold** | 15 years inactive `[REF-1]` | 10 years no contact `[REF-4]` | 6 years inactive `[REF-7]` |
| **Reclaim Rights** | In perpetuity via Reclaim Fund `[REF-2]` | 50-year statutory limit `[REF-5]` | Statutory transfer to State `[REF-8]` |
| **Social Value Allocation** | Directed to housing/youth causes `[REF-3]` | Returned to cantonal treasury `[REF-6]` | Central Revenue Account `[REF-9]` |

---

## Key Developer Takeaways

1. **Use Fan-Out / Fan-In Topology for Multi-Document Processing:** Use LangGraph's parallel node execution to analyze separate documents independently before passing results to a single synthesis node.
2. **Bind Citations to Immutable Primary Keys:** Map every piece of retrieved evidence to an explicit key (`[REF-N]`) early in the pipeline to maintain strict auditability.
3. **Persona-Conditioned Analysis:** Tailor prompt instructions based on the user's role (e.g., risk manager vs. policy developer) to filter out irrelevancies without losing factual precision.

---

