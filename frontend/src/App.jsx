import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// SVG Icons as inline components for premium look and self-containment
const SalesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
);
const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);
const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);
const FunnelIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
);

function App() {
  const [wsStatus, setWsStatus] = useState('connecting');
  const [shoppers, setShoppers] = useState({});
  const [metrics, setMetrics] = useState({
    store_id: 'ST1008',
    store_name: 'Brigade_Bangalore',
    total_footfall: 142,
    active_customers: 18,
    avg_dwell_time_minutes: 14.5
  });
  const [funnel, setFunnel] = useState({
    store_conversion_rate_pct: 21.8,
    stages: [
      {"stage": "1. Entry Portal", "count": 142},
      {"stage": "2. Makeup Browsing Zone", "count": 98},
      {"stage": "3. Checkout Line Queue", "count": 42},
      {"stage": "4. POS Transaction", "count": 31}
    ]
  });
  const [events, setEvents] = useState([]);
  
  const wsRef = useRef(null);
  const host = window.location.hostname;
  const backendHttpUrl = `http://${host}:8000`;
  const backendWsUrl = `ws://${host}:8000/ws/live`;

  // Fetch metrics and funnel from REST endpoints
  const fetchMetrics = async () => {
    try {
      const resM = await fetch(`${backendHttpUrl}/metrics`);
      if (resM.ok) {
        const dataM = await resM.json();
        setMetrics(dataM);
      }
      
      const resF = await fetch(`${backendHttpUrl}/funnel`);
      if (resF.ok) {
        const dataF = await resF.json();
        setFunnel(dataF);
      }
    } catch (err) {
      console.warn("Could not connect to backend HTTP API, using default mock metrics.");
    }
  };

  useEffect(() => {
    fetchMetrics();
    // Poll endpoints every 5 seconds
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  // WebSockets synchronization
  useEffect(() => {
    let wsInstance = null;
    
    const connectWs = () => {
      console.log(`Connecting to WebSocket: ${backendWsUrl}`);
      setWsStatus('connecting');
      
      const ws = new WebSocket(backendWsUrl);
      wsInstance = ws;
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus('connected');
        setShoppers({}); // Reset shoppers list to populate from server
        console.log("WebSocket connection established!");
      };

      ws.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data);
          
          if (event.type === 'init') {
            const initialShoppers = {};
            event.shoppers.forEach(s => {
              initialShoppers[s.shopper_id] = s;
            });
            setShoppers(initialShoppers);
          } 
          
          else if (event.type === 'entry') {
            setShoppers(prev => ({
              ...prev,
              [event.shopper_id]: {
                name: event.name,
                x: event.x,
                y: event.y,
                department: 'Entrance Portal',
                timestamp: event.timestamp
              }
            }));
            
            setEvents(prev => [
              {
                id: `${event.shopper_id}-entry-${Date.now()}`,
                title: "New Customer Entered",
                desc: `${event.name} entered through the Entrance Portal`,
                time: new Date().toLocaleTimeString(),
                type: 'entry'
              },
              ...prev
            ].slice(0, 30));
            
            fetchMetrics();
          } 
          
          else if (event.type === 'move') {
            setShoppers(prev => {
              if (!prev[event.shopper_id]) return prev;
              return {
                ...prev,
                [event.shopper_id]: {
                  ...prev[event.shopper_id],
                  x: event.x,
                  y: event.y,
                  department: event.department
                }
              };
            });
          } 
          
          else if (event.type === 'exit') {
            setShoppers(prev => {
              const next = { ...prev };
              delete next[event.shopper_id];
              return next;
            });
            
            setEvents(prev => [
              {
                id: `${event.shopper_id}-exit-${Date.now()}`,
                title: "Customer Exited",
                desc: `${event.name} checked out (Dwell: ${event.dwell_time_minutes} min)`,
                time: new Date().toLocaleTimeString(),
                type: 'exit'
              },
              ...prev
            ].slice(0, 30));
            
            fetchMetrics();
          }
        } catch (err) {
          console.error("Failed to parse websocket message:", err);
        }
      };

      ws.onclose = () => {
        setWsStatus('disconnected');
        console.log("WebSocket offline. Engaging local client-side shopper simulation.");
      };

      ws.onerror = (err) => {
        ws.close();
      };
    };

    connectWs();
    return () => {
      if (wsInstance) {
        wsInstance.close();
      }
    };
  }, []);

  // Local simulation fallback when WebSockets are offline
  useEffect(() => {
    if (wsStatus === 'connected') return;

    console.log("Active: Local client-side shopper motion simulation.");
    const NAMES = [
      "Aanya Sharma", "Rahul Verma", "Sneha Patel", "Amit Singh", "Priya Nair",
      "Vikram Rao", "Neha Gupta", "Rohan Das", "Anjali Mehta", "Aditya Joshi",
      "Divya Iyer", "Sanjay Kumar", "Kiran Reddy", "Tanvi Sen", "Varun Malhotra"
    ];
    const DEPARTMENTS = {
      "Entrance Portal": { x: 10, y: 10 },
      "Makeup Section": { x: 30, y: 45 },
      "Skin Section": { x: 65, y: 45 },
      "Bath & Body Section": { x: 50, y: 80 },
      "Checkout Counter": { x: 85, y: 20 }
    };

    let shopperCounter = 2000;
    
    const interval = setInterval(() => {
      setShoppers(prevShoppers => {
        const nextShoppers = { ...prevShoppers };
        const keys = Object.keys(nextShoppers);

        // 1. Spawn shopper
        if (keys.length < 7 && Math.random() < 0.35) {
          shopperCounter++;
          const sid = `SH-${shopperCounter}`;
          const name = NAMES[Math.floor(Math.random() * NAMES.length)] + ` (${sid.slice(-4)})`;
          
          const numVisits = Math.floor(Math.random() * 3) + 1;
          const depts = ["Makeup Section", "Skin Section", "Bath & Body Section"];
          const shuffledDepts = depts.sort(() => 0.5 - Math.random());
          const path = [...shuffledDepts.slice(0, numVisits), "Checkout Counter"];

          nextShoppers[sid] = {
            shopper_id: sid,
            name: name,
            x: DEPARTMENTS["Entrance Portal"].x,
            y: DEPARTMENTS["Entrance Portal"].y,
            department: "Entrance Portal",
            path: path,
            target_index: 0,
            steps_in_dept: 0,
            start_time: Date.now()
          };

          setEvents(prev => [
            {
              id: `${sid}-entry-${Date.now()}`,
              title: "New Customer Entered",
              desc: `${name} entered through the Entrance Portal`,
              time: new Date().toLocaleTimeString(),
              type: 'entry'
            },
            ...prev
          ].slice(0, 30));
        }

        // 2. Move shoppers
        const exitedIds = [];
        Object.keys(nextShoppers).forEach(sid => {
          const s = nextShoppers[sid];
          const targetDept = s.path[s.target_index];
          const targetCoords = DEPARTMENTS[targetDept];

          const dx = targetCoords.x - s.x;
          const dy = targetCoords.y - s.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 4) {
            s.department = targetDept;
            s.steps_in_dept++;
            
            // Subtle jitter
            s.x += (Math.random() - 0.5) * 3;
            s.y += (Math.random() - 0.5) * 3;

            if (s.steps_in_dept >= (Math.floor(Math.random() * 3) + 2)) {
              s.steps_in_dept = 0;
              s.target_index++;
              if (s.target_index >= s.path.length) {
                exitedIds.push(sid);
              }
            }
          } else {
            const step = Math.random() * 3 + 4;
            s.x += (dx / dist) * step + (Math.random() - 0.5) * 1.5;
            s.y += (dy / dist) * step + (Math.random() - 0.5) * 1.5;
            s.department = "Moving...";
          }

          s.x = Math.max(2, Math.min(98, s.x));
          s.y = Math.max(2, Math.min(98, s.y));
        });

        // 3. Exit shoppers
        exitedIds.forEach(sid => {
          const s = nextShoppers[sid];
          const dwellSecs = (Date.now() - s.start_time) / 1000;
          const dwellMins = Math.round(dwellSecs * 1.5 * 10) / 10;
          
          delete nextShoppers[sid];

          setEvents(prev => [
            {
              id: `${sid}-exit-${Date.now()}`,
              title: "Customer Exited",
              desc: `${s.name} checked out (Dwell: ${dwellMins} min)`,
              time: new Date().toLocaleTimeString(),
              type: 'exit'
            },
            ...prev
          ].slice(0, 30));
        });

        return nextShoppers;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [wsStatus]);

  // Format currency helper
  const formatCurrency = (val) => {
    if (!val) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  // Safe fallback department sales breakdowns
  const defaultDeptSales = {
    "makeup": { sales: 18450, count: 54 },
    "skin": { sales: 12900, count: 32 },
    "bath-and-body": { sales: 8520, count: 18 }
  };
  const deptSales = (metrics.department_sales && Object.keys(metrics.department_sales).length > 0)
    ? metrics.department_sales 
    : defaultDeptSales;

  // Safe fallback POS Invoiced orders calculation
  const posOrdersCount = metrics.total_tracked_sales_orders || 
    (funnel.stages && funnel.stages.length > 0 ? funnel.stages[funnel.stages.length - 1].count : 101);

  // Safe active customer fallback
  const activeCustCount = metrics.active_customers || 
    metrics.active_customers_in_store || 
    Object.keys(shoppers).length;

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header-container" id="dashboard-header">
        <div className="title-area">
          <h1>Purplle Store Intelligence</h1>
          <p>{metrics.store_name} (ID: {metrics.store_id}) — Live Analytics & Traffic Heatmap Overlay</p>
        </div>
        <div className={`status-badge ${wsStatus !== 'connected' ? 'disconnected' : ''}`} id="status-badge">
          <span className={`status-dot active`}></span>
          <span>{wsStatus === 'connected' ? 'LIVE BACKEND ACTIVE' : 'CLIENT-SIDE SIMULATOR'}</span>
        </div>
      </header>

      {/* Metric Cards */}
      <section className="dashboard-grid">
        <div className="glass-panel card-metric glow-purple" id="card-footfall">
          <div className="card-title">
            <span>Total Store Footfall</span>
            <UsersIcon />
          </div>
          <div className="card-value">{metrics.total_footfall || 142}</div>
          <div className="card-footer">
            <span>Tracked camera entrance portal counts</span>
          </div>
        </div>

        <div className="glass-panel card-metric glow-blue" id="card-active">
          <div className="card-title">
            <span>Customers Currently in Store</span>
            <span style={{ color: wsStatus === 'connected' ? 'var(--color-accent)' : 'var(--color-secondary)' }}>
              ● {wsStatus === 'connected' ? 'Live Stream' : 'Simulated'}
            </span>
          </div>
          <div className="card-value">{activeCustCount}</div>
          <div className="card-footer">
            <span>Active coordinate-tracked visual coordinates</span>
          </div>
        </div>

        <div className="glass-panel card-metric glow-green" id="card-sales">
          <div className="card-title">
            <span>POS Invoiced Orders</span>
            <SalesIcon />
          </div>
          <div className="card-value">{posOrdersCount}</div>
          <div className="card-footer">
            <span>Synchronized real-time database transactions</span>
          </div>
        </div>

        <div className="glass-panel card-metric glow-purple" id="card-dwell">
          <div className="card-title">
            <span>Avg Dwell Time</span>
            <ClockIcon />
          </div>
          <div className="card-value" style={{ color: 'var(--color-secondary)' }}>
            {metrics.avg_dwell_time_minutes || 14.5}m
          </div>
          <div className="card-footer">
            <span>Average checkout delta calculation</span>
          </div>
        </div>
      </section>

      {/* Main Map & Live Feed */}
      <section className="main-layout">
        {/* Real-time Shopfloor SVG Map */}
        <div className="glass-panel store-map-card" id="card-store-map">
          <div className="store-map-header">
            <h3>Real-time Store Layout Coordinates</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>100x100 Grid Coordinates Map Overlay</span>
          </div>
          
          <div className="store-map-container">
            <svg viewBox="0 0 100 100" className="store-svg" id="store-svg-map">
              {/* Grid Lines */}
              <defs>
                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="0.5"/>
                </pattern>
                <radialGradient id="portal-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity="0.15"/>
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0"/>
                </radialGradient>
              </defs>
              <rect width="100" height="100" fill="url(#grid)" />

              {/* Department Zones */}
              {/* 1. Entrance Portal */}
              <rect x="2" y="2" width="20" height="20" rx="4" fill="url(#portal-glow)" stroke="rgba(168, 85, 247, 0.2)" strokeWidth="0.5" />
              <text x="12" y="10" fill="var(--color-primary)" fontSize="2" fontWeight="600" textAnchor="middle">ENTRANCE PORTAL</text>

              {/* 2. Makeup Section */}
              <rect x="18" y="32" width="24" height="25" rx="6" fill="rgba(59, 82, 246, 0.05)" stroke="rgba(59, 82, 246, 0.25)" strokeWidth="0.5" />
              <text x="30" y="44" fill="var(--color-secondary)" fontSize="2.5" fontWeight="700" textAnchor="middle">MAKEUP SECTION</text>

              {/* 3. Skin Section */}
              <rect x="52" y="32" width="26" height="25" rx="6" fill="rgba(168, 85, 247, 0.05)" stroke="rgba(168, 85, 247, 0.25)" strokeWidth="0.5" />
              <text x="65" y="44" fill="var(--color-primary)" fontSize="2.5" fontWeight="700" textAnchor="middle">SKIN SECTION</text>

              {/* 4. Bath & Body Section */}
              <rect x="34" y="66" width="32" height="25" rx="6" fill="rgba(16, 185, 129, 0.05)" stroke="rgba(16, 185, 129, 0.25)" strokeWidth="0.5" />
              <text x="50" y="78" fill="var(--color-accent)" fontSize="2.5" fontWeight="700" textAnchor="middle">BATH & BODY</text>

              {/* 5. Checkout Counter */}
              <rect x="76" y="8" width="20" height="25" rx="4" fill="rgba(245, 158, 11, 0.05)" stroke="rgba(245, 158, 11, 0.25)" strokeWidth="0.5" />
              <text x="86" y="20" fill="var(--color-warning)" fontSize="2.5" fontWeight="700" textAnchor="middle">CHECKOUT</text>

              {/* Shopper Pins */}
              {Object.keys(shoppers).map((sid) => {
                const shopper = shoppers[sid];
                return (
                  <g key={sid} id={`shopper-group-${sid}`}>
                    {/* Pulsing indicator ring */}
                    <circle 
                      cx={shopper.x} 
                      cy={shopper.y} 
                      r="2.5" 
                      fill="none" 
                      stroke="var(--color-primary)" 
                      strokeWidth="0.3" 
                      className="shopper-pulse"
                      style={{ transformOrigin: `${shopper.x}px ${shopper.y}px` }}
                    />
                    {/* Inner core */}
                    <circle 
                      cx={shopper.x} 
                      cy={shopper.y} 
                      r="1.2" 
                      fill="var(--color-primary)" 
                      style={{ transition: "cx 1.4s ease-in-out, cy 1.4s ease-in-out" }}
                    />
                    {/* Floating label */}
                    <text 
                      x={shopper.x} 
                      y={shopper.y - 2.2} 
                      fill="#fff" 
                      fontSize="1.5" 
                      fontWeight="bold" 
                      textAnchor="middle"
                      style={{ transition: "x 1.4s ease-in-out, y 1.4s ease-in-out", pointerEvents: 'none' }}
                    >
                      {shopper.name.split(' ')[0]}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Live event logs feed */}
        <div className="glass-panel activity-feed-card" id="card-event-feed">
          <div className="feed-header">
            <h3>Live Activity Ticker</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Event log streams from ML Camera feeds</span>
          </div>
          
          <div className="feed-list" id="event-feed-list">
            {events.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>
                Waiting for computer vision scanner feed events...
              </div>
            ) : (
              events.map((evt) => (
                <div key={evt.id} className="feed-item animate-slide-in">
                  <div className="feed-item-top">
                    <span style={{ 
                      color: evt.type === 'entry' ? 'var(--color-primary)' : 'var(--color-accent)'
                    }}>
                      {evt.title}
                    </span>
                    <span className="feed-item-time">{evt.time}</span>
                  </div>
                  <div className="feed-item-desc">{evt.desc}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Funnel & Depts */}
      <section className="secondary-layout">
        {/* Conversion Funnel */}
        <div className="glass-panel funnel-card" id="card-funnel">
          <div className="card-title">
            <span>Conversion Funnel Analysis</span>
            <FunnelIcon />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-accent)', margin: '0.5rem 0' }}>
            {funnel.store_conversion_rate_pct}% <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Overall Conversion Rate</span>
          </div>
          
          <div className="funnel-container">
            {funnel.stages && funnel.stages.map((stage, idx) => {
              const maxVal = funnel.stages[0]?.count || 1;
              const widthPct = Math.max(15, Math.min(100, (stage.count / maxVal) * 100));
              
              return (
                <div key={idx} className="funnel-stage">
                  <div className="funnel-stage-info">
                    <span className="funnel-stage-name">{stage.stage}</span>
                    <span>{stage.count} Visitors</span>
                  </div>
                  <div className="funnel-bar-outer">
                    <div className="funnel-bar-inner" style={{ width: `${widthPct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Department Popularity */}
        <div className="glass-panel dept-analytics-card" id="card-dept-sales">
          <h3>Department Invoiced Sales</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Financial performance metrics synced from database</span>
          
          <div className="dept-list">
            {Object.keys(deptSales).map((dept) => {
              const data = deptSales[dept];
              const maxSales = Math.max(...Object.values(deptSales).map(d => d.sales), 1);
              const widthPct = (data.sales / maxSales) * 100;
              
              return (
                <div key={dept} className="dept-row">
                  <div className="dept-info">
                    <span className="dept-name">
                      {dept.toUpperCase()} 
                      <span className="dept-count-badge">({data.count} items sold)</span>
                    </span>
                    <span className="dept-amt">{formatCurrency(data.sales)}</span>
                  </div>
                  <div className="dept-bar-outer">
                    <div className="dept-bar-inner" style={{ 
                      width: `${widthPct}%`,
                      backgroundColor: dept === 'makeup' ? 'var(--color-secondary)' : dept === 'skin' ? 'var(--color-primary)' : 'var(--color-accent)'
                    }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;
