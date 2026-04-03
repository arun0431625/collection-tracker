const http = require('https');
const fs = require('fs');
const envLines = fs.readFileSync('.env', 'utf8').split('\n');
const env = {};
envLines.forEach(line => {
  const parts = line.split('=');
  if(parts.length >= 2) env[parts[0].trim()] = parts.slice(1).join('=').trim();
});

const URL = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;

function request(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const headers = { 'apikey': KEY, 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const req = http.request(URL + path, { method: 'POST', headers }, (res) => {
      let bodyText = '';
      res.on('data', c => bodyText += c);
      res.on('end', () => resolve({ status: res.statusCode, body: bodyText }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function debug() {
  console.log("Fetching profiles and security rows...");
  
  // 1. Try hitting without auth
  const anonTest = await request('/rest/v1/rpc/admin_list_branch_security_rows', null, KEY);
  console.log("Anon test status:", anonTest.status, "body:", anonTest.body);
}

debug();
