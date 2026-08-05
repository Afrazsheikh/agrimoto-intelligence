/**
 * Agrimoto Intelligence - Meesho Product, Views & Sales Intelligence Extractor
 * Official Agrimoto Company Chrome Extension
 */

(function () {
  'use strict';

  if (window.agrimotoInjected) return;
  window.agrimotoInjected = true;

  console.log('🚀 [Agrimoto Intelligence] Activated on Meesho.');

  let currentProductData = null;
  let activeTab = 'sales';
  let customMultiplier = 32;
  let convRatePct = 3.3;
  const syncChannel = new BroadcastChannel('meeinfo_sync');

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

  function extractAllRatingsAndReviews() {
    let productRating = 0;
    let productRatingCount = 0;
    let productReviewCount = 0;

    let shopName = 'Verified Meesho Supplier';
    let shopRating = 0;
    let shopRatingCount = 0;
    let shopReviewCount = 0;

    const nextDataScript = document.getElementById('__NEXT_DATA__');
    if (nextDataScript) {
      try {
        const json = JSON.parse(nextDataScript.textContent);
        const pageProps = json?.props?.pageProps;
        const state = pageProps?.initialState?.product;
        const detailsData = state?.details?.data;

        if (detailsData?.catalog) {
          if (detailsData.catalog.rating) productRating = parseFloat(detailsData.catalog.rating);
          if (detailsData.catalog.rating_count) productRatingCount = parseCountNumber(detailsData.catalog.rating_count);
          if (detailsData.catalog.review_count) productReviewCount = parseCountNumber(detailsData.catalog.review_count);
        }

        if (detailsData?.review_summary?.data) {
          const revData = detailsData.review_summary.data;
          if (revData.rating_count) productRatingCount = parseCountNumber(revData.rating_count);
          if (revData.review_count) productReviewCount = parseCountNumber(revData.review_count);
          if (revData.average_rating) productRating = parseFloat(revData.average_rating);
        }

        if (state?.pdpRatingReview) {
          const rObj = state.pdpRatingReview;
          if (rObj.ratingsCount) productRatingCount = parseCountNumber(rObj.ratingsCount);
          if (rObj.reviewsCount) productReviewCount = parseCountNumber(rObj.reviewsCount);
          if (rObj.averageRating) productRating = parseFloat(rObj.averageRating);
        }

        if (detailsData?.supplier_name) shopName = detailsData.supplier_name;
        if (detailsData?.suppliers && detailsData.suppliers.length > 0) {
          const supp = detailsData.suppliers[0];
          if (supp.name) shopName = supp.name;
          if (supp.average_rating) shopRating = parseFloat(supp.average_rating);
          if (supp.rating_count) shopRatingCount = parseCountNumber(supp.rating_count);
          if (supp.review_count) shopReviewCount = parseCountNumber(supp.review_count);
        }
      } catch (e) {}
    }

    const elements = document.querySelectorAll('span, div, p, b, strong, h4, h5');
    for (const el of elements) {
      if (el.closest && el.closest('#meeinfo-drawer')) continue;
      const txt = (el.innerText || el.textContent || '').trim();
      if (!txt) continue;

      const mProd = txt.match(/([\d\.]+)\s*★\s*([\d\.,KM]+)\s*Ratings?[,\s&and]+([\d\.,KM]+)\s*Reviews?/i);
      if (mProd && productRatingCount === 0) {
        productRating = parseFloat(mProd[1]);
        productRatingCount = parseCountNumber(mProd[2]);
        productReviewCount = parseCountNumber(mProd[3]);
      }
    }

    if (productRatingCount === 0) {
      const bodyText = document.body.innerText;
      const mBodyFull = bodyText.match(/([\d\.]+)\s*★\s*([\d\.,KM]+)\s*Ratings?[,\s&and]+([\d\.,KM]+)\s*Reviews?/i);
      if (mBodyFull) {
        productRating = productRating || parseFloat(mBodyFull[1]);
        productRatingCount = parseCountNumber(mBodyFull[2]);
        productReviewCount = productReviewCount || parseCountNumber(mBodyFull[3]);
      }
    }

    return {
      productRating,
      productRatingCount,
      productReviewCount,
      shopName,
      shopRating: shopRating || 4.1,
      shopRatingCount: shopRatingCount || Math.round(productRatingCount * 4.5),
      shopReviewCount: shopReviewCount || Math.round(productReviewCount * 4.5)
    };
  }

  function extractProductData() {
    let data = {
      id: '',
      catalogId: '',
      title: '',
      url: window.location.href,
      category: 'Home & Kitchen',
      price: 0,
      mrp: 0,
      discount: 0,
      rating: 0,
      ratingCount: 0,
      reviewCount: 0,
      shopName: '',
      shopRating: 0,
      shopRatingCount: 0,
      shopReviewCount: 0,
      returnRatePct: 16,
      image: '',
      multiplier: customMultiplier,
      cvrPct: convRatePct
    };

    const nextDataScript = document.getElementById('__NEXT_DATA__');
    if (nextDataScript) {
      try {
        const json = JSON.parse(nextDataScript.textContent);
        const detailsData = json?.props?.pageProps?.initialState?.product?.details?.data;

        if (detailsData) {
          data.id = detailsData.id || detailsData.product_id || '';
          data.catalogId = detailsData.catalog_id || '';
          data.title = detailsData.name || detailsData.title || '';
          data.price = detailsData.price || detailsData.discounted_price || detailsData.min_product_price || 0;
          data.mrp = detailsData.mrp_details?.mrp || detailsData.original_price || Math.round(data.price * 1.35);
          data.category = detailsData.category_name || detailsData.subcategory_name || data.category;
          if (detailsData.images && detailsData.images.length > 0) {
            data.image = detailsData.images[0];
          }
        }
      } catch (e) {}
    }

    try {
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      const pIndex = pathParts.indexOf('p');
      if (pIndex > 0) {
        const slug = pathParts[pIndex - 1];
        if (!data.title) {
          data.title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }
        if (pathParts[pIndex + 1]) data.id = pathParts[pIndex + 1];
      }
    } catch (e) {}

    const titleEl = document.querySelector('h1') || document.querySelector('[class*="ProductTitle"]');
    if (titleEl && titleEl.innerText.trim()) data.title = titleEl.innerText.trim();

    const priceEl = document.querySelector('h4') || document.querySelector('[class*="Price"]');
    if (priceEl) {
      const pText = priceEl.innerText.replace(/[^0-9]/g, '');
      if (pText) data.price = parseInt(pText, 10);
    }

    if (!data.image) {
      const mainImg = document.querySelector('img[src*="images.meesho.com"]');
      if (mainImg) data.image = mainImg.src;
    }

    const ratingsData = extractAllRatingsAndReviews();
    data.rating = ratingsData.productRating;
    data.ratingCount = ratingsData.productRatingCount;
    data.reviewCount = ratingsData.productReviewCount;

    data.shopName = ratingsData.shopName;
    data.shopRating = ratingsData.shopRating;
    data.shopRatingCount = ratingsData.shopRatingCount;

    if (data.mrp <= data.price && data.price > 0) data.mrp = Math.round(data.price * 1.35);
    if (data.mrp > 0) data.discount = Math.round(((data.mrp - data.price) / data.mrp) * 100);

    data.totalOrders = Math.round(data.ratingCount * customMultiplier);
    data.totalRevenue = data.totalOrders * data.price;

    data.monthlyOrders = Math.round(data.totalOrders / 6);
    data.monthlyRevenue = data.monthlyOrders * data.price;

    data.dailyOrders = data.monthlyOrders > 0 ? Math.max(1, Math.round(data.monthlyOrders / 30)) : 0;
    data.dailyRevenue = data.dailyOrders * data.price;

    const viewsPerOrder = Math.round(100 / convRatePct);
    data.dailyViews = data.dailyOrders * viewsPerOrder;
    data.monthlyViews = data.monthlyOrders * viewsPerOrder;
    data.totalViews = data.totalOrders * viewsPerOrder;

    data.monthlyReturns = Math.round(data.monthlyOrders * (data.returnRatePct / 100));
    data.netMonthlyOrders = Math.max(0, data.monthlyOrders - data.monthlyReturns);
    data.netMonthlyRevenue = data.netMonthlyOrders * data.price;
    data.estSupplierPayout = Math.round(data.price * 0.82);

    return data;
  }

  function createFloatingBadge() {
    if (document.getElementById('meeinfo-root')) return;

    const root = document.createElement('div');
    root.id = 'meeinfo-root';

    const btn = document.createElement('button');
    btn.className = 'meeinfo-badge-btn';
    btn.innerHTML = `
      <span class="meeinfo-icon">⚡</span>
      <span>Agrimoto Sales</span>
    `;

    btn.onclick = toggleDrawer;
    root.appendChild(btn);
    document.body.appendChild(root);
  }

  function createDrawerUI() {
    if (document.getElementById('meeinfo-drawer')) return;

    const drawer = document.createElement('div');
    drawer.id = 'meeinfo-drawer';
    drawer.className = 'meeinfo-drawer';

    drawer.innerHTML = `
      <div class="meeinfo-header">
        <div class="meeinfo-title-group">
          <div class="meeinfo-logo">A</div>
          <div class="meeinfo-title-text">
            <h3>Agrimoto Intelligence</h3>
            <p>Official Agrimoto Product Analytics</p>
          </div>
        </div>
        <button class="meeinfo-close-btn" id="meeinfo-close">✕</button>
      </div>

      <div class="meeinfo-prod-banner" style="margin: 12px; margin-bottom: 8px;">
        <img class="meeinfo-prod-img" id="mee-banner-img" src="" alt="Product">
        <div class="meeinfo-prod-details">
          <h4 id="mee-banner-title">Loading product data...</h4>
          <div class="meeinfo-prod-price-row">
            <span class="meeinfo-curr-price" id="mee-banner-price">₹0</span>
            <span class="meeinfo-mrp-price" id="mee-banner-mrp">₹0</span>
            <span class="meeinfo-discount-badge" id="mee-banner-discount">0% OFF</span>
          </div>
        </div>
      </div>

      <div style="display: flex; border-bottom: 1px solid rgba(255,255,255,0.1); padding: 0 8px; margin-bottom: 12px; gap: 4px; background: rgba(15,23,42,0.6);">
        <button class="mee-tab-btn active" id="tab-btn-sales" style="flex: 1; padding: 8px 2px; font-size: 11px; font-weight: 700; background: none; border: none; color: #38bdf8; border-bottom: 2px solid #38bdf8; cursor: pointer;">
          📊 Views & Orders
        </button>
        <button class="mee-tab-btn" id="tab-btn-seller" style="flex: 1; padding: 8px 2px; font-size: 11px; font-weight: 700; background: none; border: none; color: #94a3b8; cursor: pointer;">
          🚀 Seller Boost
        </button>
        <button class="mee-tab-btn" id="tab-btn-ratings" style="flex: 1; padding: 8px 2px; font-size: 11px; font-weight: 700; background: none; border: none; color: #94a3b8; cursor: pointer;">
          ⭐ Product
        </button>
      </div>

      <div class="meeinfo-body" id="mee-tab-content">
      </div>

      <div style="padding: 0 16px 12px 16px; display: flex; flex-direction: column; gap: 8px;">
        <button class="meeinfo-btn" id="btn-sync-dashboard" style="background: linear-gradient(135deg, #10b981, #059669);">
          ⚡ Sync Data to Agrimoto Dashboard
        </button>
        <button class="meeinfo-btn meeinfo-btn-secondary" id="btn-export-csv">
          📄 Download Agrimoto CSV Report
        </button>
      </div>

      <div class="meeinfo-footer">
        <span>Agrimoto Intelligence Engine</span>
        <a href="javascript:void(0)" id="meeinfo-refresh">🔄 Refresh</a>
      </div>
    `;

    document.body.appendChild(drawer);

    document.getElementById('meeinfo-close').onclick = toggleDrawer;
    document.getElementById('meeinfo-refresh').onclick = extractAndRenderData;
    document.getElementById('btn-export-csv').onclick = exportCSV;
    document.getElementById('btn-sync-dashboard').onclick = syncToDashboard;

    document.getElementById('tab-btn-sales').onclick = () => switchTab('sales');
    document.getElementById('tab-btn-seller').onclick = () => switchTab('seller');
    document.getElementById('tab-btn-ratings').onclick = () => switchTab('ratings');
  }

  function switchTab(tabName) {
    activeTab = tabName;
    ['sales', 'seller', 'ratings'].forEach(t => {
      const btn = document.getElementById(`tab-btn-${t}`);
      if (btn) {
        if (t === tabName) {
          btn.style.color = '#38bdf8';
          btn.style.borderBottom = '2px solid #38bdf8';
        } else {
          btn.style.color = '#94a3b8';
          btn.style.borderBottom = 'none';
        }
      }
    });
    renderTabContent();
  }

  function renderTabContent() {
    const container = document.getElementById('mee-tab-content');
    if (!container || !currentProductData) return;
    const d = currentProductData;

    if (activeTab === 'sales') {
      container.innerHTML = `
        <div class="meeinfo-card meeinfo-card-accent" style="margin-bottom: 12px; border-color: #38bdf8;">
          <div class="meeinfo-card-label" style="color: #38bdf8;">📅 DAILY PERFORMANCE</div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 4px;">
            <div>
              <div style="font-size: 20px; font-weight: 800; color: #ffffff;">${d.dailyOrders.toLocaleString('en-IN')} Orders / Day</div>
              <div style="font-size: 11px; color: #38bdf8; font-weight: 700;">Est. ₹${d.dailyRevenue.toLocaleString('en-IN')} Revenue / Day</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 16px; font-weight: 800; color: #a78bfa;">~${d.dailyViews.toLocaleString('en-IN')}</div>
              <div style="font-size: 10px; color: #cbd5e1;">Est. Page Views / Day</div>
            </div>
          </div>
        </div>

        <div class="meeinfo-card meeinfo-card-accent" style="margin-bottom: 12px; border-color: #f472b6;">
          <div class="meeinfo-card-label" style="color: #f472b6;">🗓️ MONTHLY PERFORMANCE</div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 4px;">
            <div>
              <div style="font-size: 20px; font-weight: 800; color: #ffffff;">${d.monthlyOrders.toLocaleString('en-IN')} Orders / Month</div>
              <div style="font-size: 11px; color: #f472b6; font-weight: 700;">Est. ₹${d.monthlyRevenue.toLocaleString('en-IN')} Revenue / Month</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 16px; font-weight: 800; color: #a78bfa;">~${d.monthlyViews.toLocaleString('en-IN')}</div>
              <div style="font-size: 10px; color: #cbd5e1;">Est. Page Views / Month</div>
            </div>
          </div>
        </div>
      `;
    } else if (activeTab === 'seller') {
      container.innerHTML = `
        <div class="meeinfo-card" style="background: linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(56,189,248,0.2) 100%); border: 1px solid #10b981; margin-bottom: 12px;">
          <div class="meeinfo-card-label" style="color: #10b981;">🚀 AGRIMOTO SELLER ANALYSIS</div>
          <div style="font-size: 16px; font-weight: 800; color: #ffffff; margin-top: 4px;">Net Monthly Profit: ₹${(d.netMonthlyOrders * d.estSupplierPayout).toLocaleString('en-IN')}</div>
          <div style="font-size: 11px; color: #cbd5e1; margin-top: 4px;">Delivered Orders: <strong>${d.netMonthlyOrders} / mo</strong> (after ${d.monthlyReturns} returns)</div>
        </div>
      `;
    } else if (activeTab === 'ratings') {
      container.innerHTML = `
        <div class="meeinfo-card" style="margin-bottom: 12px; background: rgba(30,41,59,0.9); border: 1px solid rgba(245,158,11,0.5);">
          <div class="meeinfo-card-label" style="color: #f59e0b;">⭐ PRODUCT RATING & REVIEWS</div>
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 8px;">
            <span class="meeinfo-card-value" style="color: #f59e0b; font-size: 24px;">${d.rating > 0 ? d.rating : 'N/A'} ★</span>
            <span style="font-size: 13px; font-weight: 700; color: #f8fafc;">${d.ratingCount.toLocaleString('en-IN')} Ratings</span>
            <span style="font-size: 13px; font-weight: 700; color: #38bdf8;">${d.reviewCount.toLocaleString('en-IN')} Reviews</span>
          </div>
        </div>
      `;
    }
  }

  function toggleDrawer() {
    const drawer = document.getElementById('meeinfo-drawer');
    if (drawer) drawer.classList.toggle('meeinfo-open');
  }

  function extractAndRenderData() {
    currentProductData = extractProductData();
    const d = currentProductData;
    if (!d || d.price === 0) return;

    const imgEl = document.getElementById('mee-banner-img');
    if (imgEl && d.image) imgEl.src = d.image;
    
    const titleEl = document.getElementById('mee-banner-title');
    if (titleEl) titleEl.innerText = d.title || 'Meesho Product';

    const priceEl = document.getElementById('mee-banner-price');
    if (priceEl) priceEl.innerText = `₹${d.price.toLocaleString('en-IN')}`;

    const mrpEl = document.getElementById('mee-banner-mrp');
    if (mrpEl) mrpEl.innerText = `₹${d.mrp.toLocaleString('en-IN')}`;

    const discEl = document.getElementById('mee-banner-discount');
    if (discEl) discEl.innerText = `${d.discount}% OFF`;

    renderTabContent();

    try {
      syncChannel.postMessage({ type: 'MEEINFO_PRODUCT_DATA', payload: d });
    } catch (e) {}
  }

  function syncToDashboard() {
    currentProductData = extractProductData();
    const d = currentProductData;

    if (d && d.price > 0) {
      syncChannel.postMessage({ type: 'MEEINFO_PRODUCT_DATA', payload: d });
      alert(`✅ Synced to Agrimoto Dashboard:\n\n📌 Title: ${d.title.substring(0, 30)}...\n👀 Est Daily Views: ~${d.dailyViews.toLocaleString('en-IN')} Views/Day\n📦 Daily Orders: ${d.dailyOrders} Orders/Day\n🗓️ Monthly Orders: ${d.monthlyOrders} Orders/Month\n\nCheck Agrimoto Web Dashboard`);
    } else {
      alert('⚠️ Product data loading... Please wait 1 second and click again.');
    }
  }

  function exportCSV() {
    if (!currentProductData) return;
    const d = currentProductData;
    const headers = [
      'Product Title',
      'Price (INR)',
      'Product Rating',
      'Product Ratings Count',
      'Daily View Page Impressions',
      'Daily View Completed Orders',
      'Daily Revenue (INR)',
      'Monthly View Page Impressions',
      'Monthly View Completed Orders',
      'Monthly Revenue (INR)',
      'Total Lifetime Orders'
    ];
    const row = [
      `"${d.title.replace(/"/g, '""')}"`,
      d.price,
      d.rating,
      d.ratingCount,
      d.dailyViews,
      d.dailyOrders,
      d.dailyRevenue,
      d.monthlyViews,
      d.monthlyOrders,
      d.monthlyRevenue,
      d.totalOrders
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), row.join(',')].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `agrimoto_sales_report_${Date.now()}.csv`;
    link.click();
  }

  function initMeeInfo() {
    createFloatingBadge();
    createDrawerUI();

    setTimeout(extractAndRenderData, 400);
    setTimeout(extractAndRenderData, 1500);
    setTimeout(extractAndRenderData, 3000);

    let lastUrl = location.href;
    setInterval(() => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        console.log('🔄 New Product Page Detected! Extracting Agrimoto Intelligence...');
        setTimeout(extractAndRenderData, 500);
        setTimeout(extractAndRenderData, 1500);
        setTimeout(extractAndRenderData, 3000);
      }
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMeeInfo);
  } else {
    initMeeInfo();
  }
})();
