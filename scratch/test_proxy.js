// Test Public Proxy Mirrors for Meesho Scraping
async function testProxies() {
  const targetUrl = 'https://www.meesho.com/spark-plug-gx-35-35-cc-brush-cutter-knapsack/p/8x3p01';
  console.log('Testing Proxy Mirrors for Target:', targetUrl);

  const proxies = [
    `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
    `https://thingproxy.freeboard.io/fetch/${targetUrl}`,
    `https://api.codetabs.com/v1/proxy?quest=${targetUrl}`
  ];

  for (const p of proxies) {
    try {
      console.log('Trying Proxy:', p.substring(0, 50));
      const res = await fetch(p);
      console.log(`Status: ${res.status}`);
      if (res.ok) {
        const text = await res.text();
        console.log(`Response length: ${text.length}`);
        if (text.includes('__NEXT_DATA__')) {
          console.log('SUCCESS! Found __NEXT_DATA__ in proxy response!');
        }
      }
    } catch (e) {
      console.error('Error:', e.message);
    }
  }
}

testProxies();
