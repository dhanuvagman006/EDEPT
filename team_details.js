const fs = require('node:fs/promises');

const quiet = String(process.env.QUIET || '').toLowerCase() === '1' || String(process.env.QUIET || '').toLowerCase() === 'true';

fetch("https://envisionsit.in/api/v1/admin/teams?limit=1000", {
  "headers": {
    "accept": "*/*",
    "accept-language": "en-US,en;q=0.7",
    "authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NywiZW1haWwiOiJtYW5pc2guYWRtaW5AZW52aXNpb24uZGV2Iiwic2NvcGUiOiJtYWluIiwiZGVwYXJ0bWVudHMiOltdLCJpYXQiOjE3NzYxMDExNDUsImV4cCI6MTc3NjE4NzU0NX0.MXb7zg1_y7R7tqA7iLZVzG2A2r3vvFc9EGFRnPONAyU",
    "cache-control": "no-cache",
    "content-type": "application/json",
    "pragma": "no-cache",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Brave\";v=\"147\", \"Not.A/Brand\";v=\"8\", \"Chromium\";v=\"147\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "sec-gpc": "1",
    "cookie": "__clerk_db_jwt_FheHn7Xw=dvb_3CAfwn6m3OClRUaEoII9FmghlUX; __client_uat_FheHn7Xw=1775833626; __session_FheHn7Xw=eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDExMUFBQSIsImtpZCI6Imluc18zQjd3dDZPbzZwcWtWNVd4U1JpQXhWVWE3d1giLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwczovL2VudmlzaW9uc2l0LmluIiwiZXhwIjoxNzc1ODMzODIwLCJmdmEiOlsyLC0xXSwiaWF0IjoxNzc1ODMzNzYwLCJpc3MiOiJodHRwczovL2dvcmdlb3VzLWtpd2ktOTUuY2xlcmsuYWNjb3VudHMuZGV2IiwibmJmIjoxNzc1ODMzNzUwLCJzaWQiOiJzZXNzXzNDQWc4MjdVRHgwdmlmUVd6R3JSemVCT1lrcCIsInN0cyI6ImFjdGl2ZSIsInN1YiI6InVzZXJfM0NBZzgweGxmZVlXNzYxRnVRV2VMMlZrQ1duIiwidiI6Mn0.otPXIjzke4hpCHEZ_Lj0tyJLVgod3EuFuOJR0phEpDuiqN4iizJOPclrfLLk7nFgcuPzbiSDUB5AE8hX_9h9B9N2kOEDNv4BVsJxqp6a4Rak61h5dZoBwQSm9lu34k_5xtBi-5AjsvaA9idh2Syv-C8NmwTIJR3FFkKDplgW0gFC2jW8AYd8GLA5_2Zj_C9fiMAP8aIrFLvS_wC6kCyUis3h_jcaRn5qYUnM_YSM9YF2e5pbYMAAH_A9SdE7VeSnCLqj8JkOgVrvHW2MyNXkKaH28I8xtalfh8WP-GWk6C1BbhTgLZ2KR32_ljvciL9mmempqMcm-tdoJsw3r5ZwMQ; __client_uat=1776063965; __refresh_SnLWrNRl=pgnwMo8Fv6R9glIpxF41; __client_uat_SnLWrNRl=1776063965; clerk_active_context=sess_3CID0HjdF36PAdSDWYubI1OOAjz:; __session=eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDExMUFBQSIsImtpZCI6Imluc18zQ0F6REQxYlN1TjhXS1N1ekxxM0RyWVVhbHQiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwczovL2VudmlzaW9uc2l0LmluIiwiZXhwIjoxNzc2MTAxMjQ1LCJmdmEiOls2MjAsLTFdLCJpYXQiOjE3NzYxMDExODUsImlzcyI6Imh0dHBzOi8vY2xlcmsuZW52aXNpb25zaXQuaW4iLCJuYmYiOjE3NzYxMDExNzUsInNpZCI6InNlc3NfM0NJRDBIamRGMzZQQWRTRFdZdWJJMU9PQWp6Iiwic3RzIjoiYWN0aXZlIiwic3ViIjoidXNlcl8zQ0I2Sm5hQWN6SVhmOXNMVGN4anZCU1NPRGoiLCJ2IjoyfQ.mq3-djnuA0gKbjZBzQZJj105sgIcquvMlPPIvYZo-L0DgkVjAj41aWmy2n5w3NqZ3WpiDkm0YGqu2g1PoHRFePYGPMLj28qK4AY1C7nnI4s9HMj7v8m1e0HYAhy1uhvjokGXkJXNOR1F9nMtP3C1MZkqYpmPDjAufcrScOvSNJ86wkJb5951ExPKbvxOIoTQexQEgjbQEdl4bATohwenNvsn9HAwaR4FfiZR-1nLgY2SzRPMNMHvBDt_92rRiuwjme9CvqxAe__MUl567uT2_zPX3yBAaOcTzu0WhPVLHk2DT1gCBnUu3RN3_KEPedLaMuR4zbkLwbgc0EmrlHOtQg; __session_SnLWrNRl=eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDExMUFBQSIsImtpZCI6Imluc18zQ0F6REQxYlN1TjhXS1N1ekxxM0RyWVVhbHQiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwczovL2VudmlzaW9uc2l0LmluIiwiZXhwIjoxNzc2MTAxMjQ1LCJmdmEiOls2MjAsLTFdLCJpYXQiOjE3NzYxMDExODUsImlzcyI6Imh0dHBzOi8vY2xlcmsuZW52aXNpb25zaXQuaW4iLCJuYmYiOjE3NzYxMDExNzUsInNpZCI6InNlc3NfM0NJRDBIamRGMzZQQWRTRFdZdWJJMU9PQWp6Iiwic3RzIjoiYWN0aXZlIiwic3ViIjoidXNlcl8zQ0I2Sm5hQWN6SVhmOXNMVGN4anZCU1NPRGoiLCJ2IjoyfQ.mq3-djnuA0gKbjZBzQZJj105sgIcquvMlPPIvYZo-L0DgkVjAj41aWmy2n5w3NqZ3WpiDkm0YGqu2g1PoHRFePYGPMLj28qK4AY1C7nnI4s9HMj7v8m1e0HYAhy1uhvjokGXkJXNOR1F9nMtP3C1MZkqYpmPDjAufcrScOvSNJ86wkJb5951ExPKbvxOIoTQexQEgjbQEdl4bATohwenNvsn9HAwaR4FfiZR-1nLgY2SzRPMNMHvBDt_92rRiuwjme9CvqxAe__MUl567uT2_zPX3yBAaOcTzu0WhPVLHk2DT1gCBnUu3RN3_KEPedLaMuR4zbkLwbgc0EmrlHOtQg",
    "Referer": "https://envisionsit.in/admin/registrations"
  },
  "body": null,
  "method": "GET"
}).then(async (res) => {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  if (!quiet) console.log('Status:', res.status, res.statusText);

  let outputText = text;
  if (contentType.includes('application/json')) {
    try {
      outputText = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      // keep raw
    }
  }

  if (!quiet) console.log(outputText);
  await fs.writeFile('teams.json', outputText, 'utf8');
}).catch((err) => {
  console.error('Fetch failed:', err);
});