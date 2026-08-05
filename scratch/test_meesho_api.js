// Test Meesho Public API Endpoints
async function testMeeshoApi() {
  const pid = '8x3p01';
  console.log('Testing Meesho API for PID:', pid);

  const urls = [
    `https://www.meesho.com/api/v1/products/${pid}`,
    `https://www.meesho.com/api/v1/product/catalog/${pid}`,
    `https://supplier.meesho.com/api/v1/products/${pid}`
  ];

  for (const url of urls) {
    try {
      console.log('Fetching:', url);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Origin': 'https://www.meesho.com',
          'Referer': 'https://www.meesho.com/'
        }
      });
      console.log(`Status: ${res.status}`);
      if (res.ok) {
        const text = await res.text();
        console.log('Response sample:', text.substring(0, 300));
      }
    } catch (err) {
      console.error('Fetch error:', err.message);
    }
  }
}

testMeeshoApi();
