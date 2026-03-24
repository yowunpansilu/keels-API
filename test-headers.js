const axios = require('axios');

const BASE_URL = 'https://zebraliveback.keellssuper.com';

const testHeaders = async () => {
  const headers = {
    'authority': 'zebraliveback.keellssuper.com',
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'en-US,en;q=0.9',
    'origin': 'https://www.keellssuper.com',
    'referer': 'https://www.keellssuper.com/',
    'sec-ch-ua': '"Google Chrome";v="122", "Chromium";v="122", "Not(A:Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  };

  try {
    console.log('Testing GuestLogin with enhanced headers...');
    const res = await axios.get(`${BASE_URL}/1.0/Login/GuestLogin`, { headers });
    console.log('SUCCESS! Status:', res.status);
    console.log('Data:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('FAILED. Status:', err.response ? err.response.status : err.message);
    if (err.response) console.log('Body:', err.response.data);
  }
};

testHeaders();
