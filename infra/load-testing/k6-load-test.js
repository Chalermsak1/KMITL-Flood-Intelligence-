import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom Metrics
const errorRate = new Rate('kmitl_error_rate');
const mapLatency = new Trend('kmitl_map_latency');
const reportLatency = new Trend('kmitl_report_latency');
const routeLatency = new Trend('kmitl_route_latency');

// Multi-stage test configuration: Ramps to 1,000 -> 5,000 -> 10,000 VUs
export const options = {
  stages: [
    { duration: '30s', target: 50 },     // Warmup
    { duration: '1m', target: 1000 },    // Ramp to 1,000 concurrent users
    { duration: '2m', target: 1000 },    // Sustained 1,000 users
    { duration: '1m', target: 5000 },    // Spike to 5,000 users (monsoon downpour scenario)
    { duration: '2m', target: 5000 },    // Sustained 5,000 users
    { duration: '1m', target: 10000 },   // Crisis burst 10,000 users
    { duration: '2m', target: 10000 },   // Sustained peak load
    { duration: '1m', target: 0 },       // Ramp-down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<400', 'p(99)<800'], // 95% of requests under 400ms
    'kmitl_error_rate': ['rate<0.01'],               // Less than 1% errors
    'kmitl_map_latency': ['p(95)<300'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:8000';

// Lat Krabang Bounding Box for Viewport Queries
const VIEWPORTS = [
  '100.7500,13.7100,100.8000,13.7500', // KMITL Core Campus
  '100.7600,13.7200,100.7900,13.7400', // Chalong Krung / Train Station
  '100.7200,13.7000,100.8200,13.7700', // Greater Lat Krabang District
];

export default function () {
  const rand = Math.random();
  const vp = VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)];

  // Scenario 1: Map Browsing & Viewport Queries (70% of traffic)
  if (rand < 0.70) {
    group('Map Browsing', function () {
      const start = Date.now();
      const res = http.get(`${BASE_URL}/api/v1/incidents?bbox=${vp}`);
      mapLatency.add(Date.now() - start);

      const passed = check(res, {
        'status is 200': (r) => r.status === 200,
        'has meta envelope': (r) => r.json('meta') !== undefined,
      });
      errorRate.add(!passed);

      // Fetch accompanying water and rain observations
      http.get(`${BASE_URL}/api/v1/water-stations`);
      http.get(`${BASE_URL}/api/v1/rain/current`);
      http.get(`${BASE_URL}/api/v1/situation/summary`);
    });
  }
  // Scenario 2: Route Evaluation (15% of traffic)
  else if (rand < 0.85) {
    group('Route Evaluation', function () {
      const payload = JSON.stringify({
        origin: { lat: 13.7298, lng: 100.7782 },
        destination: { lat: 13.7180, lng: 100.7850 },
        mode: 'CAR'
      });
      const params = { headers: { 'Content-Type': 'application/json' } };
      const start = Date.now();
      const res = http.post(`${BASE_URL}/api/v1/routes/evaluate`, payload, params);
      routeLatency.add(Date.now() - start);

      const passed = check(res, {
        'route status is 200': (r) => r.status === 200,
        'has candidate routes': (r) => r.json('data.routes') !== undefined,
      });
      errorRate.add(!passed);
    });
  }
  // Scenario 3: Citizen Flood Report Submission (10% of traffic)
  else if (rand < 0.95) {
    group('Submit Flood Report', function () {
      const payload = JSON.stringify({
        latitude: 13.7250 + (Math.random() - 0.5) * 0.02,
        longitude: 100.7750 + (Math.random() - 0.5) * 0.02,
        water_depth_band: '10_TO_20CM',
        vehicle_passability: 'PASSABLE_CAUTION',
        transport_type: 'CAR',
        description: 'Load test synthetic citizen water report'
      });
      const params = { headers: { 'Content-Type': 'application/json' } };
      const start = Date.now();
      const res = http.post(`${BASE_URL}/api/v1/reports`, payload, params);
      reportLatency.add(Date.now() - start);

      const passed = check(res, {
        'report created 200/201': (r) => r.status === 200 || r.status === 201,
      });
      errorRate.add(!passed);
    });
  }
  // Scenario 4: Admin / EOC Monitoring Dashboard (5% of traffic)
  else {
    group('Admin Operations Dashboard', function () {
      const res1 = http.get(`${BASE_URL}/api/v1/data-status`);
      const res2 = http.get(`${BASE_URL}/api/v1/help`);
      const passed = check(res1, { 'data status is 200': (r) => r.status === 200 }) &&
                     check(res2, { 'help status is 200': (r) => r.status === 200 });
      errorRate.add(!passed);
    });
  }

  sleep(Math.random() * 2 + 1); // User think time: 1-3 seconds
}
