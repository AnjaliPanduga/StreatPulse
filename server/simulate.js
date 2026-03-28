const http = require('http');
const crypto = require('crypto');

function makeRequest(payload, headers) {
  return new Promise((resolve, reject) => {
    const dataString = JSON.stringify(payload);
    
    const options = {
      hostname: '127.0.0.1',
      port: 3001,
      path: '/api/danger-tap',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString),
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(responseBody);
        } else {
          reject(new Error(`API Error ${res.statusCode}: ${responseBody}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(dataString);
    req.end();
  });
}

async function simulateDangerTaps(location, numUsers, locationName) {
  console.log(`\n📍 Simulating ${numUsers} users tapping 'Unsafe' at ${locationName}...`);
  
  for (let i = 0; i < numUsers; i++) {
    const sessionId = crypto.randomUUID();
    const headers = {
      'X-Forwarded-For': `${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.1.1`
    };
    
    const payload = {
      sessionId,
      lat: location.lat,
      lng: location.lng,
      timestamp: Date.now()
    };

    try {
      await makeRequest(payload, headers);
      console.log(`  ✅ User ${i+1}/${numUsers} reported successfully`);
    } catch (e) {
      console.log(`  ❌ Failed to connect to API on User ${i+1}:`, e.message);
    }
    
    // Slight delay between taps
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}

async function run() {
  console.log('🚀 Starting StreetPulse Collective Intelligence Simulation...');
  
  // Location A: Near Banjara Hills, Hyderabad
  const LOCATION_A = { lat: 17.4156, lng: 78.4347 };
  // Location B: Near Hussain Sagar, Hyderabad
  const LOCATION_B = { lat: 17.4239, lng: 78.4738 };
  
  // Simulate 6 people tapping Unsafe at Location A (High Risk)
  await simulateDangerTaps(LOCATION_A, 6, "Location A (Banjara Hills)");

  // Simulate 2 people tapping Unsafe at Location B (Caution)
  await simulateDangerTaps(LOCATION_B, 2, "Location B (Hussain Sagar)");

  console.log('\n🎉 Simulation complete! Check the frontend map.');
}

run();
