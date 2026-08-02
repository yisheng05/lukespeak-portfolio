# Zero-Hallucination Cognitive Architectures: Grounding LLMs in Symbolic NIST AI RMF Ontologies

In heavily regulated industries—such as healthcare, banking, and government AI safety governance—a single hallucinated fact or falsely verified compliance check is catastrophic. While Retrieval-Augmented Generation (RAG) reduces hallucination rates in generic Q&A, it remains fundamentally probabilistic. When evaluating whether a complex machine learning deployment satisfies the **NIST AI Risk Management Framework (AI RMF)**, probabilistic "best-guesses" are a liability.

To achieve **true zero-hallucination compliance auditing**, we designed and open-sourced the `zero-hallucination-auditor`—a production cognitive agent that isolates the Large Language Model (LLM) strictly to natural language perception and rendering, while delegating 100% of audit reasoning, state tracking, and compliance evaluation to a deterministic symbolic engine.

---

## The Core Problem: Why Probabilistic RAG Fails Compliance

When traditional RAG systems assess regulatory compliance, they pass system document chunks into an LLM context window alongside a prompt like: *"Does this system satisfy NIST AI RMF GOVERN 1.2?"*

This approach suffers from three critical vulnerabilities:
1. **Semantic Drift:** LLMs equate informal, ambiguous phrasing (e.g., *"We ran stress tests last month"*) with formal requirements (e.g., *Documented stress testing across specified demographic distribution models*).
2. **Context Fragmentation:** Audit state across multi-turn discussions decays rapidly as conversation history grows.
3. **Reasoning Hallucination:** The model generates plausibly worded compliance summaries without verifying if required preconditions (e.g., system boundary definition) have been explicitly satisfied.

---

## The Architecture: The 5-Stage Meaning Representation Pipeline

To eliminate these failure modes, we implemented a **Faceted Cognitive Architecture** based on formal Meaning Representations:

```
[ User Input ]
      │
      ▼
┌───────────────────────────┐
│ 1. Perception Parser      │ ──► Extracts Text Meaning Representation (TMR)
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│ 2. Situation Model        │ ──► State Consolidation & Precondition Verification
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│ 3. Symbolic Deliberator   │ ──► Deterministic Graph Logic over NIST Ontology (MMR)
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│ 4. Action Specifier       │ ──► Generates Generation Meaning Representation (GMR)
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│ 5. Action Renderer        │ ──► Fluent LLM Text Formatting (Strict Grounding)
└───────────────────────────┘
```

### Stage 1: Text Meaning Representation (TMR) Parsing
When a user describes their AI deployment, the LLM is restricted to parsing raw natural language into a structured, machine-readable **Text Meaning Representation (TMR)** schema. It is explicitly forbidden from evaluating compliance at this stage.

```python
class TMRParser:
    """Parses raw text into structured Text Meaning Representation."""
    def parse(self, user_input: str, situation_context: dict) -> TMR:
        prompt = f"""
        Extract system actions, governance claims, and entities from user input.
        Do NOT evaluate compliance.
        Input: {user_input}
        Return JSON schema matching TMR specifications.
        """
        raw_json = self.llm.generate_json(prompt)
        return TMR.model_validate(raw_json)
```

### Stage 2: Situation Model (Stateful Memory)
The `SituationModel` maintains a deterministic state vector across audit sessions:

$$\text{AuditState}_{t+1} = \mathcal{F}(\text{AuditState}_t, \text{TMR}_t)$$

The state tracks verified facts, declared system boundaries, risk mitigation claims, and missing metadata. If required preconditions for an audit function are missing, the state machine transitions to an `INFO_REQUEST` state rather than attempting to generate an incomplete audit report.

### Stage 3: Symbolic Deliberation (MMR Engine)
The core compliance logic runs inside `SymbolicAuditor.py`. It executes exact graph-traversal queries against a machine-readable **NIST AI RMF Knowledge Graph**:

```python
class SymbolicAuditor:
    def evaluate(self, situation: SituationModel) -> MMR:
        mmr = MMR()
        for action in situation.extracted_actions:
            # Graph query against NIST AI RMF Ontology
            mapped_requirements = self.ontology.get_requirements(action.domain)
            
            for req in mapped_requirements:
                satisfied = self.check_preconditions(req, situation.facts)
                if satisfied:
                    mmr.add_verified_characteristic(req.trustworthiness_characteristic)
                else:
                    mmr.add_gap(req.id, missing_preconditions=req.get_missing(situation.facts))
                    
        return mmr  # Mental Meaning Representation
```

Because the evaluation runs in Python graph logic, **the LLM cannot hallucinate a compliance pass**. If a precondition is missing in the Knowledge Graph, the gap is mathematically guaranteed to be caught.

---

## Real-World Execution Walkthrough

### Scenario: Auditing a Healthcare AI System

1. **User:** *"We are deploying a new medical diagnosis model. We tested model accuracy on 10,000 patient records."*
2. **Perception (TMR):**
   - Action: `DeployModel` (Domain: Healthcare)
   - Fact: `AccuracyTestCompleted` (SampleCount: 10,000)
3. **Symbolic Deliberation (MMR):**
   - NIST RMF Query: `GOVERN 1.1` (System Boundaries) & `MAP 2.1` (Demographic Bias Analysis).
   - Evaluation: `AccuracyTestCompleted` is valid, but `DemographicDistribution` and `RiskBoundaryMap` are `MISSING`.
4. **Action Specification (GMR):**
   - Directs the renderer to request missing demographic distribution details before generating a compliance score.
5. **Renderer Response:**
   > *"Accuracy testing with 10,000 records has been logged under MEASURE 2.2. However, to evaluate NIST MAP 2.1 (Bias & Fairness), please clarify if demographic distribution metrics were evaluated across sub-populations."*

---

## Key Developer Takeaways

1. **Decouple Perception from Deliberation:** Never let an LLM decide if a requirement is met. Use LLMs to convert messy input into structured ASTs or TMRs, then use deterministic graph/logic code to evaluate rules.
2. **Enforce Preconditions as State Machine Guards:** Require explicit evidence tags before transitioning compliance states.
3. **Meaning Representations as Interfaces:** Standardizing interfaces into TMR $\rightarrow$ MMR $\rightarrow$ GMR creates audit-trailed software that can be verified and regression-tested using standard `pytest` suites.

---

*Explore the complete source code and ontology schemas on [GitHub](https://github.com/lukeong7/zero-hallucination-auditor).*
