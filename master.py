
import os
import time
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Dict, List, Optional
from dotenv import load_dotenv
from supabase import create_client
import uvicorn
import asyncio
from datetime import datetime, timedelta

# ================= CONFIGURATION =================
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("⚠️  WARNING: Supabase credentials missing. Analytics will fail.")
    sb = None
else:
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="Metro Master Controller")

# ================= GATE REGISTRY (In-Memory) =================
# Stores { "G-01": { "status": "ONLINE", "last_heartbeat": 1234567890, ... } }
GATE_REGISTRY = {
    "G-01": {"mode": "ENTRY", "station": "Andheri", "status": "OFFLINE", "last_heartbeat": 0, "ip": "192.168.1.10"},
    "G-02": {"mode": "EXIT", "station": "Ghatkopar", "status": "OFFLINE", "last_heartbeat": 0, "ip": "192.168.1.11"}
}

class GateHeartbeat(BaseModel):
    gate_id: str
    mode: str
    station: str
    ip: Optional[str] = None
    passengers_processed: int = 0

# ================= API ENDPOINTS =================

@app.post("/gate/heartbeat")
async def receive_heartbeat(beat: GateHeartbeat):
    """
    Gates call this every 10s to say 'I am alive'.
    """
    GATE_REGISTRY[beat.gate_id] = {
        "mode": beat.mode,
        "station": beat.station,
        "status": "ONLINE",
        "last_heartbeat": time.time(),
        "ip": beat.ip,
        "processed": beat.passengers_processed
    }
    return {"status": "ack"}

@app.get("/api/gates")
async def get_gates():
    """Return status of all gates."""
    # Check for timeouts (30s)
    now = time.time()
    for gid, data in GATE_REGISTRY.items():
        if now - data.get("last_heartbeat", 0) > 30:
            data["status"] = "OFFLINE"
    return GATE_REGISTRY

@app.get("/api/stats/realtime")
async def get_realtime_stats():
    """
    Get:
    1. Active trips (IN_TRANSIT)
    2. Today's revenue
    3. Today's passenger count
    """
    if not sb: return {"error": "No DB"}

    try:
        # Active Trips
        active_res = sb.table("trips").select("count", count="exact").eq("status", "IN_TRANSIT").execute()
        active_count = active_res.count if active_res.count is not None else 0

        # Completed Trips Today
        # Supabase filtering by date is tricky with plain strings, usually needs raw SQL or precise formatting
        # For prototype, we'll fetch ID/fare of recent trips and filter in python (not efficient but easy)
        today_iso = datetime.utcnow().date().isoformat()
        
        # This is a simplification. Ideally use .gte("entry_time", today_iso)
        daily_res = sb.table("trips").select("fare_charged").gte("entry_time", today_iso).execute()
        
        total_revenue = sum(t.get("fare_charged", 0) for t in daily_res.data)
        total_passengers = len(daily_res.data)

        return {
            "active_trips": active_count,
            "revenue": total_revenue,
            "passengers": total_passengers
        }
    except Exception as e:
        print(f"Stats error: {e}")
        return {"error": str(e)}

@app.get("/api/stats/revenue")
async def get_revenue_chart():
    """
    Return last 7 days revenue for charting.
    """
    if not sb: return []
    # Mocking real aggregation because Supabase-js free tier doesn't support complex GROUP BY easily without RPC.
    # We will return dummy data or simple aggregation IF we had RPC.
    # For now, let's return a simulated trend based on active trips to show the UI working.
    
    dates = []
    revenues = []
    base = datetime.utcnow().date()
    for i in range(6, -1, -1):
        d = base - timedelta(days=i)
        dates.append(d.strftime("%Y-%m-%d"))
        revenues.append(1000 + (i * 100)) # Fake upward trend

    return {"labels": dates, "data": revenues}

# ================= DASHBOARD UI =================
@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard_ui():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Metro Master Controller</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <meta http-equiv="refresh" content="30">
    </head>
    <body class="bg-slate-900 text-white font-sans">
        <div class="container mx-auto p-6">
            <header class="flex justify-between items-center mb-8">
                <div>
                    <h1 class="text-3xl font-bold text-blue-400">Metro Master Controller</h1>
                    <p class="text-slate-400">Central Command • Ghatkopar Line</p>
                </div>
                <div class="text-right">
                    <div id="clock" class="text-xl font-mono">00:00:00</div>
                    <div class="text-green-500 text-sm">● SYSTEM ONLINE</div>
                </div>
            </header>

            <!-- STATS CARDS -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div class="bg-slate-800 p-6 rounded-lg border-l-4 border-blue-500">
                    <h3 class="text-slate-400 text-sm uppercase">Active Trips</h3>
                    <div class="text-4xl font-bold mt-2" id="stat-active">--</div>
                </div>
                <div class="bg-slate-800 p-6 rounded-lg border-l-4 border-green-500">
                    <h3 class="text-slate-400 text-sm uppercase">Revenue (Today)</h3>
                    <div class="text-4xl font-bold mt-2" id="stat-revenue">₹--</div>
                </div>
                <div class="bg-slate-800 p-6 rounded-lg border-l-4 border-purple-500">
                    <h3 class="text-slate-400 text-sm uppercase">Passengers (Today)</h3>
                    <div class="text-4xl font-bold mt-2" id="stat-passengers">--</div>
                </div>
                <div class="bg-slate-800 p-6 rounded-lg border-l-4 border-red-500">
                    <h3 class="text-slate-400 text-sm uppercase">Alerts</h3>
                    <div class="text-4xl font-bold mt-2">0</div>
                </div>
            </div>

            <!-- MAIN CONTENT -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                <!-- GATES LIST -->
                <div class="bg-slate-800 p-6 rounded-lg lg:col-span-1">
                    <h2 class="text-xl font-bold mb-4 border-b border-slate-700 pb-2">Gate Status</h2>
                    <div id="gate-list" class="space-y-3">
                        <div class="animate-pulse bg-slate-700 h-10 rounded"></div>
                    </div>
                </div>

                <!-- CHARTS -->
                <div class="bg-slate-800 p-6 rounded-lg lg:col-span-2">
                    <h2 class="text-xl font-bold mb-4 border-b border-slate-700 pb-2">Revenue Trend (7 Days)</h2>
                    <canvas id="revenueChart"></canvas>
                </div>
            </div>
        </div>

        <script>
            // Clock
            setInterval(() => {
                document.getElementById('clock').innerText = new Date().toLocaleTimeString();
            }, 1000);

            async function fetchStats() {
                try {
                    const res = await fetch('/api/stats/realtime');
                    const data = await res.json();
                    document.getElementById('stat-active').innerText = data.active_trips || 0;
                    document.getElementById('stat-revenue').innerText = "₹" + (data.revenue || 0);
                    document.getElementById('stat-passengers').innerText = data.passengers || 0;
                } catch (e) { console.error(e); }
            }

            async function fetchGates() {
                try {
                    const res = await fetch('/api/gates');
                    const gates = await res.json();
                    const list = document.getElementById('gate-list');
                    list.innerHTML = '';
                    
                    for (const [id, g] of Object.entries(gates)) {
                        const statusColor = g.status === 'ONLINE' ? 'bg-green-500' : 'bg-red-500';
                        const html = `
                            <div class="flex items-center justify-between bg-slate-700 p-3 rounded">
                                <div class="flex items-center space-x-3">
                                    <div class="w-3 h-3 rounded-full ${statusColor}"></div>
                                    <div>
                                        <div class="font-bold">${id} • ${g.station}</div>
                                        <div class="text-xs text-slate-400">${g.mode} MODE</div>
                                    </div>
                                </div>
                                <div class="text-xs font-mono text-slate-400">
                                    ${g.status}<br>${g.ip || 'Unknown IP'}
                                </div>
                            </div>
                        `;
                        list.innerHTML += html;
                    }
                } catch (e) { console.error(e); }
            }

            async function initChart() {
                const ctx = document.getElementById('revenueChart').getContext('2d');
                const res = await fetch('/api/stats/revenue');
                const data = await res.json();

                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: data.labels,
                        datasets: [{
                            label: 'Revenue (₹)',
                            data: data.data,
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { grid: { color: '#334155' } },
                            x: { grid: { color: '#334155' } }
                        }
                    }
                });
            }

            // Init
            fetchStats();
            fetchGates();
            initChart();

            // Poll
            setInterval(fetchStats, 5000);
            setInterval(fetchGates, 5000);
        </script>
    </body>
    </html>
    """

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
