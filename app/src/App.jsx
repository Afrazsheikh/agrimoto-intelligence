import React, { useState, useEffect } from 'react';

export default function App() {
  const [selectedProd, setSelectedProd] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [returnRate, setReturnRate] = useState(16);
  const [multiplier, setMultiplier] = useState(32); // Default 1 rating = 32 orders
  const [sortBy, setSortBy] = useState('monthlyOrders'); // 'monthlyOrders', 'dailyOrders', 'revenue', 'rating'
  const [liveSynced, setLiveSynced] = useState(false);
  const [savedProducts, setSavedProducts] = useState([]);

  // LOAD SAVED PRODUCTS FROM LOCAL STORAGE
  useEffect(() => {
    try {
      const stored = localStorage.getItem('meeinfo_products');
      if (stored) {
        const parsed = JSON.parse(stored);
        setSavedProducts(parsed);
        if (parsed.length > 0) setSelectedProd(parsed[0]);
      }
    } catch(e) {}
  }, []);

  // LISTEN FOR LIVE SYNC FROM CHROME EXTENSION ON MEESHO TAB
  useEffect(() => {
    try {
      const syncChannel = new BroadcastChannel('meeinfo_sync');
      syncChannel.onmessage = (event) => {
        if (event.data && event.data.type === 'MEEINFO_PRODUCT_DATA' && event.data.payload) {
          const p = event.data.payload;
          if (p.price > 0 && p.title) {
            console.log('⚡ Received Real Product Sync:', p);
            setSelectedProd(p);
            setErrorMsg('');
            setLiveSynced(true);
            setTimeout(() => setLiveSynced(false), 4000);

            // Save to localStorage
            setSavedProducts((prev) => {
              const filtered = prev.filter(item => item.id !== p.id);
              const updated = [p, ...filtered];
              localStorage.setItem('meeinfo_products', JSON.stringify(updated));
              return updated;
            });
          }
        }
      };
      return () => syncChannel.close();
    } catch(e) {}
  }, []);

  // FETCH LIVE PRODUCT VIA SCRAPING API
  const fetchLiveProduct = async (url) => {
    if (!url || !url.trim()) return;
    setLoading(true);
    setErrorMsg('');

    const targetUrl = url.trim();

    try {
      const res = await fetch(`/api/scrape?url=${encodeURIComponent(targetUrl)}`);
      const data = await res.json();

      if (data && data.success && data.price > 0 && data.image) {
        setSelectedProd(data);
        setSavedProducts((prev) => {
          const filtered = prev.filter(item => item.id !== data.id);
          const updated = [data, ...filtered];
          localStorage.setItem('meeinfo_products', JSON.stringify(updated));
          return updated;
        });
      } else {
        setErrorMsg(data.error || 'Meesho Akamai anti-bot block (403) prevented direct server scraping.');
      }
    } catch (err) {
      console.error('Scrape error:', err);
      setErrorMsg(`Connection error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    fetchLiveProduct(searchInput);
  };

  const openOnMeesho = () => {
    const url = searchInput.trim() || (selectedProd ? `https://www.meesho.com/p/${selectedProd.id}` : 'https://www.meesho.com');
    window.open(url, '_blank');
  };

  // Calculations
  const price = selectedProd?.price || 0;
  const mrp = selectedProd?.mrp || (price > 0 ? Math.round(price * 1.35) : 0);
  const ratingCount = selectedProd?.ratingCount || 0;
  const reviewCount = selectedProd?.reviewCount || 0;
  const ratingScore = selectedProd?.rating || 4.2;

  const totalOrders = Math.round(ratingCount * multiplier);
  const totalRevenue = totalOrders * price;

  const monthlyOrders = Math.round(totalOrders / 6);
  const monthlyRevenue = monthlyOrders * price;

  const dailyOrders = monthlyOrders > 0 ? Math.max(1, Math.round(monthlyOrders / 30)) : 0;
  const dailyRevenue = dailyOrders * price;

  const monthlyReturns = Math.round(monthlyOrders * (returnRate / 100));
  const totalReturns = Math.round(totalOrders * (returnRate / 100));
  const netMonthlyOrders = Math.max(0, monthlyOrders - monthlyReturns);
  const netMonthlyRevenue = netMonthlyOrders * price;
  const estSupplierPayout = Math.round(price * 0.82);

  // Opportunity Score (0-100)
  let score = 50;
  if (monthlyOrders > 300) score += 25;
  else if (monthlyOrders > 80) score += 15;
  if (ratingScore >= 4.2) score += 15;
  if (price >= 150 && price <= 500) score += 10;
  const opportunityScore = Math.min(99, score);
  const demandBadge = monthlyOrders > 250 ? '🔥 HIGH DEMAND WINNER' : (monthlyOrders > 60 ? '⚡ MODERATE DEMAND' : '🌱 NEW LISTING');

  const ratingDist = selectedProd?.ratingDistribution || { 5: 62, 4: 21, 3: 9, 2: 4, 1: 4 };

  // SORT SAVED PRODUCTS FOR SELLER COMPARISON
  const sortedSavedProducts = [...savedProducts].sort((a, b) => {
    const aTotal = Math.round((a.ratingCount || 0) * multiplier);
    const bTotal = Math.round((b.ratingCount || 0) * multiplier);
    const aMonthly = Math.round(aTotal / 6);
    const bMonthly = Math.round(bTotal / 6);
    const aDaily = Math.max(1, Math.round(aMonthly / 30));
    const bDaily = Math.max(1, Math.round(bMonthly / 30));

    if (sortBy === 'monthlyOrders') return bMonthly - aMonthly;
    if (sortBy === 'dailyOrders') return bDaily - aDaily;
    if (sortBy === 'revenue') return (bMonthly * (b.price || 0)) - (aMonthly * (a.price || 0));
    if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
    return 0;
  });

  return (
    <div className="container">
      {/* HEADER */}
      <header className="navbar">
        <div className="nav-brand">
          <div className="brand-icon">🚀</div>
          <div className="brand-text">
            <h1>Agrimoto Intelligence • Meesho Sales & Product Analyzer</h1>
            <p>Official Agrimoto Company Tool - High Demand Finder, Return Risk & Revenue Intelligence</p>
          </div>
        </div>
        <div className="nav-actions">
          {liveSynced && (
            <div className="badge-tag" style={{ background: 'rgba(16, 185, 129, 0.25)', color: '#4ade80' }}>
              <span>⚡ Live Extension Synced!</span>
            </div>
          )}
        </div>
      </header>

      {/* LIVE URL SEARCH BOX */}
      <section className="search-hero" style={{ padding: '28px', marginBottom: '24px' }}>
        <h2 className="hero-title" style={{ fontSize: '24px', marginBottom: '8px' }}>
          Find High Demand Meesho Products to Sell
        </h2>
        <p className="hero-sub" style={{ fontSize: '13px', marginBottom: '20px' }}>
          Paste any Meesho product link or open on Meesho to analyze daily view sales, monthly view orders, return rates, and seller profit potential!
        </p>

        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-wrapper">
            <span className="search-icon-inside">🌐</span>
            <input
              type="text"
              className="search-input"
              placeholder="Paste Meesho link to analyze (e.g. https://www.meesho.com/.../p/gt6ooa)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '⏳ Analyzing...' : '🚀 Analyze Opportunity'}
          </button>
        </form>

        {/* ERROR / AUTO-SYNC PROMPT BANNER */}
        {errorMsg && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '14px', padding: '18px', marginTop: '20px', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h4 style={{ color: '#f87171', fontSize: '14px', marginBottom: '4px' }}>🔒 Meesho Server Blocked Direct Scraper (HTTP 403)</h4>
                <p style={{ color: '#fca5a5', fontSize: '12px', lineHeight: '1.4' }}>
                  Meesho's Akamai CDN blocked automated server fetch for this link. Open the page in your browser tab for instant 1-click Extension sync!
                </p>
              </div>
              <button
                onClick={openOnMeesho}
                className="btn-primary"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)', fontSize: '13px', padding: '10px 16px' }}
              >
                🛍️ Open Link on Meesho & Auto-Sync
              </button>
            </div>
          </div>
        )}
      </section>

      {/* SELLER HIGH DEMAND WINNING PRODUCTS TABLE & SORTING */}
      {savedProducts.length > 0 && (
        <section className="section-panel" style={{ padding: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '16px', color: '#10b981', margin: 0 }}>🥇 Winning Products Comparison & Ranking</h3>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0 0' }}>Sort your saved product catalog by demand volume and revenue potential</p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Sort Products By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.2)', color: '#38bdf8', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700' }}
              >
                <option value="monthlyOrders">🗓️ Highest Monthly Orders</option>
                <option value="dailyOrders">📅 Highest Daily Orders</option>
                <option value="revenue">💰 Highest Monthly Revenue</option>
                <option value="rating">⭐ Highest Product Rating</option>
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                  <th style={{ padding: '10px 8px' }}>Product</th>
                  <th style={{ padding: '10px 8px' }}>Selling Price</th>
                  <th style={{ padding: '10px 8px' }}>Product Rating</th>
                  <th style={{ padding: '10px 8px' }}>Daily View Orders</th>
                  <th style={{ padding: '10px 8px' }}>Monthly View Orders</th>
                  <th style={{ padding: '10px 8px' }}>Est. Monthly Revenue</th>
                  <th style={{ padding: '10px 8px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedSavedProducts.map((p) => {
                  const pTotal = Math.round((p.ratingCount || 0) * multiplier);
                  const pMonthly = Math.round(pTotal / 6);
                  const pDaily = pMonthly > 0 ? Math.max(1, Math.round(pMonthly / 30)) : 0;
                  const isSelected = selectedProd?.id === p.id;

                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        background: isSelected ? 'rgba(16,185,129,0.15)' : 'transparent',
                        cursor: 'pointer'
                      }}
                      onClick={() => setSelectedProd(p)}
                    >
                      <td style={{ padding: '10px 8px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src={p.image} alt="" referrerPolicy="no-referrer" style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover' }} />
                        <span>{p.title.substring(0, 32)}...</span>
                      </td>
                      <td style={{ padding: '10px 8px', fontWeight: '700', color: '#34d399' }}>₹{p.price}</td>
                      <td style={{ padding: '10px 8px', color: '#f59e0b', fontWeight: '700' }}>{p.rating || 4.2} ★ ({p.ratingCount || 0})</td>
                      <td style={{ padding: '10px 8px', fontWeight: '800', color: '#38bdf8' }}>{pDaily} / day</td>
                      <td style={{ padding: '10px 8px', fontWeight: '800', color: '#f472b6' }}>{pMonthly} / mo</td>
                      <td style={{ padding: '10px 8px', fontWeight: '800', color: '#a78bfa' }}>₹{(pMonthly * p.price).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <button
                          className="btn-primary"
                          onClick={(e) => { e.stopPropagation(); setSelectedProd(p); }}
                          style={{ padding: '4px 10px', fontSize: '11px', background: isSelected ? '#10b981' : 'rgba(255,255,255,0.1)' }}
                        >
                          {isSelected ? 'Active' : 'Analyze'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* INITIAL EMPTY STATE */}
      {!loading && !selectedProd && !errorMsg && (
        <div className="section-panel" style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🛍️</div>
          <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '6px' }}>No Product Analyzed Yet</h3>
          <p style={{ fontSize: '13px', maxWidth: '500px', margin: '0 auto 20px auto' }}>
            Paste any Meesho product URL above, or open any product on <code>meesho.com</code> with the MeeInfo extension active to analyze seller business opportunities!
          </p>
        </div>
      )}

      {/* LOADING STATE */}
      {loading && (
        <div className="section-panel" style={{ textAlign: 'center', padding: '60px 20px', color: '#ec4899' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }} className="brand-icon">🚀</div>
          <h3 style={{ color: '#fff' }}>Analyzing Product Demand & Profit Potential...</h3>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px' }}>Calculating daily view, monthly view orders, and seller profit payout...</p>
        </div>
      )}

      {/* COMPLETE SCRAPED PRODUCT DASHBOARD */}
      {!loading && selectedProd && (
        <div className="dashboard-grid" style={{ gridTemplateColumns: '340px 1fr' }}>
          {/* LEFT COLUMN: PRODUCT IMAGE & SELLER BOOST PANEL */}
          <aside className="product-card">
            <div className="product-img-box" style={{ height: '260px' }}>
              <img
                src={selectedProd.image}
                alt={selectedProd.title}
                referrerPolicy="no-referrer"
                className="product-img"
              />
            </div>

            <h3 className="product-title" style={{ fontSize: '15px' }}>{selectedProd.title}</h3>

            <div className="price-container">
              <span className="curr-price">₹{price.toLocaleString('en-IN')}</span>
              {mrp > price && (
                <>
                  <span className="mrp-price">₹{mrp.toLocaleString('en-IN')}</span>
                  <span className="discount-badge">
                    {Math.round(((mrp - price) / mrp) * 100)}% OFF
                  </span>
                </>
              )}
            </div>

            {/* SELLER OPPORTUNITY SCORE BOX */}
            <div style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(56,189,248,0.2) 100%)', padding: '16px', borderRadius: '12px', border: '1px solid #10b981', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#10b981', letterSpacing: '0.5px' }}>🚀 SELLER OPPORTUNITY SCORE</span>
                <span style={{ background: '#10b981', color: '#0f172a', fontSize: '12px', fontWeight: '800', padding: '2px 10px', borderRadius: '12px' }}>{opportunityScore}/100</span>
              </div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#ffffff', marginTop: '6px' }}>{demandBadge}</div>
              <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '6px' }}>Est. Seller Net Profit: <strong style={{ color: '#34d399' }}>₹{(netMonthlyOrders * estSupplierPayout).toLocaleString('en-IN')}/mo</strong></div>
            </div>

            {/* SELLER RATIO CALCULATOR SELECTOR */}
            <div style={{ background: 'rgba(15,23,42,0.7)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#38bdf8', marginBottom: '6px' }}>⚙️ CUSTOM RATING MULTIPLIER</div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>Adjust orders per rating for your niche:</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[20, 32, 45, 60].map(m => (
                  <button
                    key={m}
                    onClick={() => setMultiplier(m)}
                    style={{ flex: 1, padding: '6px 0', fontSize: '11px', fontWeight: '700', background: multiplier === m ? '#38bdf8' : 'rgba(255,255,255,0.05)', color: multiplier === m ? '#0f172a' : '#cbd5e1', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    1:{m}
                  </button>
                ))}
              </div>
            </div>

            {/* FULL DETAILS SUMMARY CARD */}
            <div style={{ background: 'rgba(15,23,42,0.7)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                <span>Product ID:</span>
                <strong style={{ color: '#38bdf8' }}>{selectedProd.id || 'N/A'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                <span>Supplier:</span>
                <strong style={{ color: '#34d399' }}>{selectedProd.supplier || 'Verified Supplier'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                <span>Total Ratings:</span>
                <strong style={{ color: '#fff' }}>{ratingCount.toLocaleString('en-IN')} Ratings</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                <span>Total Reviews:</span>
                <strong style={{ color: '#38bdf8' }}>{reviewCount.toLocaleString('en-IN')} Reviews</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                <span>Est Supplier Payout:</span>
                <strong style={{ color: '#34d399' }}>₹{estSupplierPayout.toLocaleString('en-IN')}</strong>
              </div>
            </div>
          </aside>

          {/* RIGHT COLUMN: ANALYTICS & METRICS */}
          <main className="analytics-column">
            {/* DAILY & MONTHLY CARDS */}
            <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {/* DAILY VIEW */}
              <div className="stat-card stat-card-featured" style={{ padding: '24px' }}>
                <div className="stat-label" style={{ fontSize: '13px', color: '#38bdf8' }}>📅 DAILY VIEW (DEMAND)</div>
                <div style={{ marginTop: '8px' }}>
                  <span className="stat-val" style={{ fontSize: '32px' }}>{dailyOrders.toLocaleString('en-IN')}</span>
                  <span style={{ fontSize: '14px', color: '#cbd5e1', marginLeft: '6px' }}>Orders / Day</span>
                </div>
                <div className="stat-sub" style={{ fontSize: '14px', color: '#38bdf8', marginTop: '8px' }}>
                  Est. ₹{dailyRevenue.toLocaleString('en-IN')} Revenue / Day
                </div>
              </div>

              {/* MONTHLY VIEW */}
              <div className="stat-card stat-card-featured" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(236,72,153,0.2) 0%, rgba(147,51,234,0.2) 100%)' }}>
                <div className="stat-label" style={{ fontSize: '13px', color: '#f472b6' }}>🗓️ MONTHLY VIEW (DEMAND)</div>
                <div style={{ marginTop: '8px' }}>
                  <span className="stat-val" style={{ fontSize: '32px' }}>{monthlyOrders.toLocaleString('en-IN')}</span>
                  <span style={{ fontSize: '14px', color: '#cbd5e1', marginLeft: '6px' }}>Orders / Month</span>
                </div>
                <div className="stat-sub" style={{ fontSize: '14px', color: '#f472b6', marginTop: '8px' }}>
                  Est. ₹{monthlyRevenue.toLocaleString('en-IN')} Revenue / Month
                </div>
              </div>
            </div>

            {/* TOTAL LIFETIME & RETURNS BREAKDOWN */}
            <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {/* TOTAL LIFETIME */}
              <div className="stat-card">
                <div className="stat-label">📦 TOTAL LIFETIME ORDERS</div>
                <div className="stat-val" style={{ fontSize: '26px' }}>{totalOrders.toLocaleString('en-IN')}</div>
                <div className="stat-sub neutral" style={{ marginTop: '6px' }}>
                  Gross Revenue: ₹{totalRevenue.toLocaleString('en-IN')}
                </div>
              </div>

              {/* RETURNS & NET DELIVERED SALES */}
              <div className="stat-card" style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}>
                <div className="stat-label" style={{ color: '#f87171' }}>🔄 ESTIMATED RETURNS & RTO</div>
                <div className="stat-val" style={{ fontSize: '26px', color: '#f87171' }}>
                  {monthlyReturns.toLocaleString('en-IN')} <span style={{ fontSize: '14px', color: '#cbd5e1' }}>Units / Mo</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Return Rate:</span>
                  <input
                    type="number"
                    value={returnRate}
                    onChange={(e) => setReturnRate(Number(e.target.value))}
                    style={{ width: '50px', background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '2px 6px', borderRadius: '6px', fontSize: '12px' }}
                  />
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>%</span>
                  <span style={{ fontSize: '11px', color: '#34d399', marginLeft: 'auto' }}>
                    Net Delivered: {netMonthlyOrders.toLocaleString('en-IN')}/mo
                  </span>
                </div>
              </div>
            </div>

            {/* RATING DISTRIBUTION & CUSTOMER FEEDBACK BREAKDOWN */}
            <div className="section-panel" style={{ padding: '20px', marginBottom: '20px' }}>
              <h3 className="section-title" style={{ fontSize: '15px', marginBottom: '14px', color: '#f59e0b' }}>⭐ Customer Rating & Feedback Breakdown</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '20px', alignItems: 'center' }}>
                <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(15,23,42,0.6)', borderRadius: '12px', border: '1px solid rgba(245,158,11,0.3)' }}>
                  <div style={{ fontSize: '36px', fontWeight: '800', color: '#f59e0b' }}>{ratingScore} ★</div>
                  <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px' }}>Based on {ratingCount.toLocaleString('en-IN')} ratings</div>
                  <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '2px' }}>{reviewCount.toLocaleString('en-IN')} Text/Photo Reviews</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[5, 4, 3, 2, 1].map(star => (
                    <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', width: '32px', color: '#cbd5e1' }}>{star} ★</span>
                      <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${ratingDist[star]}%`, background: star >= 4 ? '#f59e0b' : star === 3 ? '#38bdf8' : '#ef4444' }}></div>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: '700', width: '40px', textAlign: 'right', color: '#94a3b8' }}>{ratingDist[star]}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* FULL ORDER & REVENUE SUMMARY TABLE */}
            <section className="section-panel" style={{ padding: '20px' }}>
              <h3 className="section-title" style={{ fontSize: '15px', marginBottom: '14px' }}>📊 Scraped Order, Net Sales & Supplier Profit Summary</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                    <th style={{ padding: '8px' }}>Time Period</th>
                    <th style={{ padding: '8px' }}>Est. Orders (1:{multiplier})</th>
                    <th style={{ padding: '8px' }}>Est. Returns ({returnRate}%)</th>
                    <th style={{ padding: '8px' }}>Net Delivered Orders</th>
                    <th style={{ padding: '8px' }}>Gross Revenue</th>
                    <th style={{ padding: '8px' }}>Est. Seller Net Profit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '10px 8px', fontWeight: '700', color: '#38bdf8' }}>Daily View</td>
                    <td style={{ padding: '10px 8px', fontWeight: '700' }}>{dailyOrders.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '10px 8px', color: '#f87171' }}>{Math.round(dailyOrders * (returnRate / 100))}</td>
                    <td style={{ padding: '10px 8px', color: '#34d399' }}>{Math.max(1, dailyOrders - Math.round(dailyOrders * (returnRate / 100)))}</td>
                    <td style={{ padding: '10px 8px', fontWeight: '700', color: '#38bdf8' }}>₹{dailyRevenue.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '10px 8px', fontWeight: '700', color: '#34d399' }}>₹{(Math.max(1, dailyOrders - Math.round(dailyOrders * (returnRate / 100))) * estSupplierPayout).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '10px 8px', fontWeight: '700', color: '#f472b6' }}>Monthly View</td>
                    <td style={{ padding: '10px 8px', fontWeight: '700' }}>{monthlyOrders.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '10px 8px', color: '#f87171' }}>{monthlyReturns.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '10px 8px', color: '#34d399' }}>{netMonthlyOrders.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '10px 8px', fontWeight: '700', color: '#f472b6' }}>₹{monthlyRevenue.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '10px 8px', fontWeight: '700', color: '#34d399' }}>₹{(netMonthlyOrders * estSupplierPayout).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px 8px', fontWeight: '700', color: '#a855f7' }}>Total Lifetime</td>
                    <td style={{ padding: '10px 8px', fontWeight: '700' }}>{totalOrders.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '10px 8px', color: '#f87171' }}>{totalReturns.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '10px 8px', color: '#34d399' }}>{(totalOrders - totalReturns).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '10px 8px', fontWeight: '700', color: '#a855f7' }}>₹{totalRevenue.toLocaleString('en-IN')}</td>
                    <td style={{ padding: '10px 8px', fontWeight: '700', color: '#34d399' }}>₹{((totalOrders - totalReturns) * estSupplierPayout).toLocaleString('en-IN')}</td>
                  </tr>
                </tbody>
              </table>
            </section>
          </main>
        </div>
      )}
    </div>
  );
}
