import sys
from pathlib import Path

# Ensure project root is in sys.path when running main.py directly
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from backend.database.db import init_db
from backend.api.routes_geo import router as geo_router
from backend.api.routes_predict import router as predict_router
from backend.api.routes_map import router as map_router
from backend.api.routes_model import router as model_router
from backend.api.routes_alerts import router as alerts_router
from backend.api.routes_system import router as system_router
from backend.api.routes_auth import router as auth_router
from backend.config import RESEARCH_DISCLAIMER

import asyncio

async def periodic_district_refresh_loop():
    # Wait 45 seconds after initial launch so the app is completely ready
    await asyncio.sleep(45)
    while True:
        try:
            from backend.api.routes_predict import _run_batch_district_refresh, _REFRESH_STATE
            if not _REFRESH_STATE["is_running"]:
                print("[Scheduler] Running automatic periodic district telemetry refresh across Nepal...")
                loop = asyncio.get_running_loop()
                await loop.run_in_executor(None, _run_batch_district_refresh)
        except Exception as e:
            print(f"[Scheduler Error] {e}")
        # Run every 6 hours (21600 seconds)
        await asyncio.sleep(21600)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure db schema exists
    init_db()
    task = asyncio.create_task(periodic_district_refresh_loop())
    yield
    task.cancel()


app = FastAPI(
    title="Nepal AI Landslide Prediction & Early Warning System",
    description="Research prototype using real Nepal environmental telemetry and trained ML models.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(geo_router)
app.include_router(predict_router)
app.include_router(map_router)
app.include_router(model_router)
app.include_router(alerts_router)
app.include_router(system_router)
app.include_router(auth_router)

@app.get("/")
def root():
    return {
        "system": "Nepal AI Landslide Prediction and Early Warning System",
        "status": "OPERATIONAL",
        "academic_notice": RESEARCH_DISCLAIMER,
        "docs_url": "/docs"
    }

@app.get("/health")
def health_check():
    return {
        "status": "OPERATIONAL",
        "service": "Nepal AI Landslide Backend"
    }

if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run("backend.main:app", host="127.0.0.1", port=port, reload=True)

