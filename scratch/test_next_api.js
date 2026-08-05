// Test Meesho Search & Next Data APIs
async function testNextData() {
  const url = 'https://www.meesho.com/spark-plug-gx-35-35-cc-brush-cutter-knapsack/p/8x3p01';
  console.log('Fetching HTML for:', url);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    console.log('HTML Status:', res.status);
    const html = await res.text();
    console.log('HTML length:', html.length);

    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
    if (match) {
      const json = JSON.parse(match[1]);
      const buildId = json.buildId;
      console.log('Found Next.js Build ID:', buildId);

      const dataUrl = `https://www.meesho.com/_next/data/${buildId}/spark-plug-gx-35-35-cc-brush-cutter-knapsack/p/8x3p01.json`;
      console.log('Testing Next Data URL:', dataUrl);

      const res2 = await fetch(dataUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });
      console.log('Data URL Status:', res2.status);
      if (res2.ok) {
        const json2 = await res2.json();
        console.log('Next JSON Product Data:', JSON.stringify(json2).substring(0, 400));
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testNextData();
