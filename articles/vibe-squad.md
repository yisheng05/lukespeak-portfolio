# Real-Time Neighborhood Vibe Analysis: Multi-Agent Geospatial & Social Sentiment Engine

When evaluating urban neighborhoods for living, dining, or real estate investment, structured data alone—such as property transaction records or transit proximity—tells only half the story. The intangible "vibe" of a neighborhood—its ambient noise, weekend crowding, emerging indie cafes, or localized parking complaints—lives in unstructured social media discussions on platforms like Reddit and local forums.

To bridge this gap, we built **The Vibe Squad** (`vibe-squad`)—a multi-agent geospatial intelligence engine built on **LangGraph**, **Firecrawl**, **OneMap API**, **URA API**, and **Gemini 2.0 Flash**.

---

## Architecture: Hybrid Social & Spatial Synthesis

The system coordinates three specialized agents operating in a collaborative graph pipeline:

```
                  ┌──────────────────────────────┐
                  │ Streamlit / Folium Map UI    │
                  │ (Planning Area Selection)    │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │ LangGraph State Engine│
                     └───────────┬───────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         │                                               │
         ▼                                               ▼
┌────────────────────────────────┐              ┌────────────────────────────────┐
│ Agent A: The Social Sentinel   │              │ Agent B: The Geo-Data Clerk    │
│ (Firecrawl Web Scraper)        │              │ (OneMap, URA & Data.gov APIs)  │
└────────────────┬───────────────┘              └────────────────┬───────────────┘
                 │                                               │
                 └───────────────────────┬───────────────────────┘
                                         │
                                         ▼
                         ┌───────────────────────────────┐
                         │ Agent C: The Evaluator        │
                         │ (Gemini 2.0 Flash Synthesis)  │
                         └───────────────┬───────────────┘
                                         │
                                         ▼
                         ┌───────────────────────────────┐
                         │ Vibe Score & Analytical       │
                         │ Report Output                 │
                         └───────────────────────────────┘
```

---

## Multi-Agent Workflow Breakdown

### 1. Agent A: The Social Sentinel (Firecrawl Integration)
The `Social Sentinel` agent searches social platforms and localized discussion threads for qualitative neighborhood sentiment:

```python
from firecrawl import FirecrawlApp

class SocialSentinelAgent:
    def __init__(self, api_key: str):
        self.app = FirecrawlApp(api_key=api_key)

    def analyze_vibe(self, location_name: str) -> dict:
        query = f"site:reddit.com/r/singapore OR site:hardwarezone.com.sg '{location_name}' vibe noise cafes"
        
        # Perform targeted web crawl
        crawl_result = self.app.search(query, limit=5)
        
        # Extract sentiment signals
        sentiment_data = self.extract_sentiment_keywords(crawl_result)
        return {
            "top_keywords": sentiment_data.keywords,
            "sentiment_score": sentiment_data.score,
            "raw_threads": sentiment_data.snippets
        }
```

### 2. Agent B: The Geo-Data Clerk (Structured GIS APIs)
Simultaneously, the `Geo-Data Clerk` calls Singapore government APIs to retrieve hard quantitative metrics:

```python
class GeoClerkAgent:
    def get_district_stats(self, planning_area: str) -> dict:
        # Query official APIs in parallel
        hdb_prices = self.data_gov.get_recent_hdb_transactions(planning_area)
        amenities = self.onemap.get_amenities_count(planning_area)
        ura_planning = self.ura.get_zoning_data(planning_area)
        
        return {
            "median_hdb_price": hdb_prices.median,
            "park_density": amenities.parks_count,
            "transit_access": amenities.mrt_count,
            "zoning": ura_planning.primary_zone
        }
```

### 3. Agent C: The Evaluator (Gemini 2.0 Flash Synthesis)
The `Evaluator` merges structured metrics with unstructured social signals to compute a weighted **Vibe Score** and **Staycation Appeal Score**:

$$\text{VibeScore} = w_1 \cdot \text{SentimentScore} + w_2 \cdot \text{AmenityDensity} - w_3 \cdot \text{NoiseComplaints}$$

```python
def evaluator_node(state: VibeSquadState):
    prompt = f"""
    Synthesize the quantitative facts and qualitative social sentiment for {state['planning_area']}.
    
    Quantitative Data:
    {state['geo_data']}
    
    Social Sentiment Signals:
    {state['social_data']}
    
    Generate:
    1. Overall Vibe Score (0-100)
    2. Staycation Appeal Index
    3. Balanced Narrative Report highlighting pros, cons, and hidden local gems.
    """
    
    response = gemini_client.generate_content(prompt)
    return {"final_report": response.text}
```

---

## Interactive Spatial Map Frontend

Using `Streamlit` and `Folium`, users can click any planning area polygon (loaded from `sg_planning_areas.geojson`) to trigger the underlying LangGraph workflow:

```python
import streamlit as st
import folium
from streamlit_folium import st_folium

m = folium.Map(location=[1.3521, 103.8198], zoom_start=11, tiles="CartoDB dark_matter")

# Add Singapore Planning Areas GeoJSON
folium.GeoJson(
    "sg_planning_areas.geojson",
    name="Planning Areas",
    style_function=lambda feature: {
        "fillColor": "#00f2fe",
        "color": "#ffffff",
        "weight": 1,
        "fillOpacity": 0.2
    }
).add_to(m)

map_data = st_folium(m, width=800, height=500)

if map_data["last_active_drawing"]:
    selected_area = map_data["last_active_drawing"]["properties"]["name"]
    st.subheader(f"Assessing Vibe for: {selected_area}")
    run_vibe_squad_pipeline(selected_area)
```

---

## Key Developer Takeaways

1. **Combine Web Scraping with Structured APIs:** Unstructured social sentiment provides context that static government databases miss, while structured APIs ground agent reports in reality.
2. **LangGraph Parallel Node Execution:** Running `Social Sentinel` and `Geo-Data Clerk` in parallel cuts overall workflow runtime by ~50%.
3. **Spatial GeoJSON Integration:** Standard GeoJSON layers allow developers to build intuitive map-driven AI interfaces that turn spatial selections directly into LLM graph parameters.

---

