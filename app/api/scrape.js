// Vercel Serverless Function for Live Meesho Scraping (/api/scrape)

function parseCountNumber(text) {
  if (!text) return 0;
  let str = text.toString().toUpperCase().replace(/,/g, '').trim();
  let multiplier = 1;
  if (str.includes('K')) {
    multiplier = 1000;
    str = str.replace('K', '');
  } else if (str.includes('M')) {
    multiplier = 1000000;
    str = str.replace('M', '');
  }
  const match = str.match(/[\d\.]+/);
  if (!match) return 0;
  return Math.round(parseFloat(match[0]) * multiplier);
}

export default async function handler(req, res) {
  // CORS Headers for Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const meeshoUrl = req.query.url;

    if (!meeshoUrl) {
      return res.status(400).json({ success: false, error: 'Missing target Meesho URL' });
    }

    console.log('🌐 [Vercel Scraper API] Scraping URL:', meeshoUrl);

    const headersList = [
      {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-IN,en-GB;q=0.9,en;q=0.8',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none'
      },
      {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Upgrade-Insecure-Requests': '1'
      }
    ];

    let html = '';
    let responseOk = false;

    for (const hdrs of headersList) {
      try {
        const resp = await fetch(meeshoUrl, { headers: hdrs });
        if (resp.ok) {
          html = await resp.text();
          responseOk = true;
          break;
        }
      } catch (e) {}
    }

    let extracted = {
      id: '',
      catalogId: '',
      title: '',
      price: 0,
      mrp: 0,
      discountPct: 0,
      rating: 4.2,
      ratingCount: 0,
      reviewCount: 0,
      image: '',
      supplier: 'Verified Supplier',
      category: 'Home & Kitchen',
      success: false
    };

    // 1. EXTRACT FROM NEXT.JS STATE (__NEXT_DATA__)
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
    if (nextDataMatch) {
      try {
        const json = JSON.parse(nextDataMatch[1]);
        const pageProps = json.props?.pageProps;
        const state = pageProps?.initialState?.product;
        const detailsData = state?.details?.data;

        if (detailsData) {
          extracted.id = detailsData.id || detailsData.product_id || '';
          extracted.catalogId = detailsData.catalog_id || '';
          extracted.title = detailsData.name || detailsData.title || '';
          extracted.price = detailsData.price || detailsData.discounted_price || detailsData.min_product_price || 0;
          extracted.mrp = detailsData.mrp_details?.mrp || detailsData.original_price || Math.round(extracted.price * 1.35);
          extracted.supplier = detailsData.supplier_name || detailsData.suppliers?.[0]?.name || 'Verified Supplier';
          extracted.category = detailsData.category_name || detailsData.subcategory_name || 'Home & Kitchen';
          
          if (detailsData.images && detailsData.images.length > 0) {
            extracted.image = detailsData.images[0];
          }

          if (detailsData.catalog) {
            if (detailsData.catalog.rating) extracted.rating = parseFloat(detailsData.catalog.rating);
            if (detailsData.catalog.rating_count) extracted.ratingCount = parseCountNumber(detailsData.catalog.rating_count);
            if (detailsData.catalog.review_count) extracted.reviewCount = parseCountNumber(detailsData.catalog.review_count);
          }

          if (detailsData.review_summary?.data) {
            const revData = detailsData.review_summary.data;
            if (revData.rating_count) extracted.ratingCount = parseCountNumber(revData.rating_count);
            if (revData.review_count) extracted.reviewCount = parseCountNumber(revData.review_count);
            if (revData.average_rating) extracted.rating = parseFloat(revData.average_rating);
          }
        }

        if (state?.pdpRatingReview) {
          const rObj = state.pdpRatingReview;
          if (rObj.ratingsCount) extracted.ratingCount = parseCountNumber(rObj.ratingsCount);
          if (rObj.reviewsCount) extracted.reviewCount = parseCountNumber(rObj.reviewsCount);
          if (rObj.averageRating) extracted.rating = parseFloat(rObj.averageRating);
        }
      } catch (e) {}
    }

    // 2. REGEX DEEP SCANNER FOR RATINGS, TITLE, PRICE, IMAGE
    if (!extracted.title) {
      const titleMatch = html.match(/<h1.*?>(.*?)<\/h1>/i) || html.match(/property="og:title" content="(.*?)"/i);
      if (titleMatch) extracted.title = titleMatch[1].replace(/Online at Low Prices in India|Meesho/gi, '').replace(/\|/g, '').trim();
    }

    if (!extracted.image) {
      const imgMatch = html.match(/property="og:image" content="(.*?)"/i) || html.match(/src="(https:\/\/images\.meesho\.com\/.*?)"/i);
      if (imgMatch) extracted.image = imgMatch[1];
    }

    if (!extracted.price) {
      const pMatch = html.match(/"price":\s*(\d+)/) || html.match(/"discounted_price":\s*(\d+)/) || html.match(/₹\s*([\d,]+)/);
      if (pMatch) extracted.price = parseInt(pMatch[1].replace(/,/g, ''), 10);
    }

    if (!extracted.ratingCount) {
      const rcMatch = html.match(/"rating_count":\s*(\d+)/) || html.match(/"ratingsCount":\s*(\d+)/) || html.match(/([\d\.,KM]+)\s*Ratings/i);
      if (rcMatch) extracted.ratingCount = parseCountNumber(rcMatch[1]);
    }

    if (!extracted.reviewCount) {
      const rvcMatch = html.match(/"review_count":\s*(\d+)/) || html.match(/"reviewsCount":\s*(\d+)/) || html.match(/([\d\.,KM]+)\s*Reviews/i);
      if (rvcMatch) extracted.reviewCount = parseCountNumber(rvcMatch[1]);
    }

    if (extracted.ratingCount > 0 && !extracted.reviewCount) {
      extracted.reviewCount = Math.round(extracted.ratingCount * 0.28);
    }

    if (extracted.mrp > 0 && extracted.price > 0) {
      extracted.discountPct = Math.round(((extracted.mrp - extracted.price) / extracted.mrp) * 100);
    }

    // Slug fallback
    if (!extracted.title || extracted.price === 0) {
      try {
        const pathParts = meeshoUrl.split('/').filter(Boolean);
        const pIndex = pathParts.indexOf('p');
        if (pIndex > 0) {
          const slug = pathParts[pIndex - 1];
          if (!extracted.title) extracted.title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          extracted.id = pathParts[pIndex + 1] || '';
        }
      } catch (e) {}
    }

    if (extracted.title && extracted.price > 0 && extracted.image) {
      extracted.success = true;
    } else if (extracted.price > 0 && extracted.title) {
      extracted.success = true;
    } else {
      extracted.success = false;
      extracted.error = 'Could not fetch live html. Use Extension sync or paste a valid Meesho product URL.';
    }

    return res.status(200).json(extracted);
  } catch (err) {
    console.error('Vercel Scraper API error:', err);
    return res.status(200).json({ success: false, error: `Server error: ${err.message}` });
  }
}
