# Stateful Cloud Run Webhooks: Building Zero-Hallucination Autonomous Tourism Agents with Hydro-Fill GIS Pipelines

Building serverless conversational agents for real-world geospatial applications presents two distinct engineering challenges:
1. **Infrastructure Latency Constraints:** Webhook providers like Telegram enforce a strict **5-second response timeout**. If an AI agent attempts to run multi-step tool calls or web queries within the request cycle, the webhook drops or duplicate retries overwhelm the service.
2. **Geospatial Hallucination:** General-purpose LLMs regularly hallucinate non-existent addresses, closed venues, or incorrect transit links when answering local spatial queries.

To solve both challenges, we designed and deployed `cloudrun-telegram-gemini`—a stateful, self-learning tourism concierge running on **Google Cloud Run** that pairs an **asynchronous thread-handoff architecture** with a dynamic **GIS Hydro-Fill Pipeline**.

---

## Architecture: Non-Blocking Webhook Thread Handoff

Serverless container runtimes (such as Cloud Run) spin down CPU allocations when an HTTP request finishes. However, long-running agent workflows require continuous compute without blocking the incoming webhook handler.

```
┌──────────────────┐               ┌───────────────────────────┐
│ Telegram Webhook │ ── HTTP POST ─►│ FastEngine FastAPI        │
└──────────────────┘               └─────────────┬─────────────┘
                                                 │
                                     1. ACK 200 OK (Instant <100ms)
                                                 │
                                                 ▼
                                   ┌───────────────────────────┐
                                   │ Background Thread Worker  │
                                   └─────────────┬─────────────┘
                                                 │
                                                 ▼
                                   ┌───────────────────────────┐
                                   │ TMR Perception Engine     │
                                   │ (Dialogue Acts & Negations)│
                                   └─────────────┬─────────────┘
                                                 │
                                                 ▼
                                   ┌───────────────────────────┐
                                   │ Faceted Knowledge Graph   │
                                   │ Cache Query               │
                                   └───────┬───────────┬───────┘
                              HIT │                   │ MISS
                                  ▼                   ▼
                           ┌─────────────┐     ┌───────────────────────┐
                           │ Grounded    │     │ Dynamic Hydro-Fill    │
                           │ Fact Set    │     │ (OSM + OneMap API)    │
                           └──────┬──────┘     └───────────┬───────────┘
                                  │                        │
                                  └────────────┬───────────┘
                                               │
                                               ▼
                                   ┌───────────────────────────┐
                                   │ Gemini Response Renderer  │
                                   └───────────────────────────┘
```

### The Non-Blocking Webhook Implementation

```python
from fastapi import FastAPI, BackgroundTasks, Request, Response
import threading

app = FastAPI()

@app.post("/webhook")
async def telegram_webhook(request: Request, background_tasks: BackgroundTasks):
    data = await request.json()
    
    # Immediately dispatch heavy processing to background worker
    background_tasks.add_task(process_agent_pipeline, data)
    
    # Acknowledge Telegram instantly to prevent webhook retries
    return Response(status_code=200)
```

---

## Perception with Negative Constraints & TMR

Most conversational bots fail when handling complex spatial exclusions, such as: *"Find me a quiet coffee shop with Wi-Fi near Bugis, but NOT in Orchard Road or major shopping malls."*

Our system uses Gemini 2.0 Flash to extract a **Text Meaning Representation (TMR)** containing explicit positive and negative logical operators:

```json
{
  "dialogue_act": "REQUEST_RECOMMENDATION",
  "category": "cafe",
  "spatial_anchor": {
    "planning_area": "Bugis",
    "radius_meters": 800
  },
  "positive_constraints": ["wifi", "quiet"],
  "negative_constraints": [
    {"type": "EXCLUDE_LOCATION", "value": "Orchard"},
    {"type": "EXCLUDE_CATEGORY", "value": "shopping_mall"}
  ]
}
```

---

## The Dynamic Hydro-Fill Pipeline

Rather than relying on static vector embeddings that quickly grow stale, the system uses a **Triple-Threat Hydro-Fill Ingestion Pipeline**. When a user requests spatial entities not yet indexed in the local Faceted Knowledge Graph, the system dynamically hydrates its knowledge cache on the fly:

```python
class HydroFillPipeline:
    def hydrate_location(self, spatial_anchor: str, category: str):
        # 1. Geo-Hierarchy Resolution via OneMap API
        coords = self.onemap.geocode(spatial_anchor)
        planning_area = self.onemap.get_planning_area(coords.lat, coords.lon)
        
        # 2. OpenStreetMap Node Ingestion (Overpass API)
        nodes = self.osm.fetch_nodes_in_radius(
            lat=coords.lat, 
            lon=coords.lon, 
            tags={"amenity": category}
        )
        
        # 3. LLM Fact Enrichment & Distillation
        enriched_nodes = []
        for node in nodes:
            facts = self.gemini.enrich_cultural_context(node)
            enriched_nodes.append({
                "id": node.id,
                "name": node.name,
                "coords": (node.lat, node.lon),
                "planning_area": planning_area,
                "facts": facts
            })
            
        # 4. Atomic Merge into Master Knowledge Graph
        self.knowledge_graph.merge_nodes(enriched_nodes)
        return enriched_nodes
```

### Triple-Threat Hydro-Fill Components:
1. **Physicality (OpenStreetMap Overpass API):** Fetching real-time geo-coordinates, amenity tags, and physical node metadata.
2. **Geo-Hierarchy (OneMap API):** Official Singapore government spatial resolution mapping lat/lon coordinates into official urban planning zones.
3. **Fact Distillation (Gemini 2.0):** Transforming raw GIS tags into concise, verified factual capsules stored in `knowledge_graph.json`.

---

## Production Deployment on Google Cloud Run

Deploying this architecture to Google Cloud Run ensures auto-scaling from zero during off-peak hours to hundreds of concurrent sessions without maintaining dedicated VM clusters:

```bash
# Build & Submit Docker Image
gcloud builds submit --tag gcr.io/${GOOGLE_CLOUD_PROJECT}/telegram-gemini:latest

# Deploy Serverless Service
gcloud run deploy telegram-gemini \
  --image gcr.io/${GOOGLE_CLOUD_PROJECT}/telegram-gemini:latest \
  --region asia-southeast1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN},GOOGLE_API_KEY=${GEMINI_API_KEY}

# Set Webhook URL
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://telegram-gemini-teaemr476q-as.a.run.app/webhook"
```

---

## Architectural Lessons Learned

1. **Always ACK Webhooks Under 100ms:** Never execute LLM reasoning inside HTTP webhook handlers. Use async event queues or background tasks.
2. **Separate Spatial Geometry from Textual Facts:** Rely on spatial APIs (OSM/OneMap) for geographic truth, and use LLMs exclusively for contextual summary.
3. **Faceted Graphs Over Generic Vector DBs:** Fact-grounded JSON graphs allow explicit logical filtering (`NOT in Orchard`) that dense vector embeddings struggle to guarantee.

---

*Explore the full containerized source code and deployment scripts on [GitHub](https://github.com/lukeong7/cloudrun-telegram-gemini).*
