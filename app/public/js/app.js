/* =============================================================
   Azure Voyages — Main Frontend Application
   Handles: nav, hero search, featured cruises, cruises page,
            destinations page, newsletter, smooth scroll, toasts
   ============================================================= */

'use strict';

/* ─────────────────────────────────────────────────────────────
   Utility helpers
───────────────────────────────────────────────────────────── */
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPrice(n) {
  return '$' + Number(n).toLocaleString('en-US');
}

function renderStars(rating) {
  const full  = Math.floor(rating);
  const half  = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

function getCategoryGradient(category) {
  const map = {
    'Caribbean':    'linear-gradient(135deg,#0077b6,#00b4d8,#48cae4)',
    'Mediterranean':'linear-gradient(135deg,#1a3a6b,#1a5276,#2471a3)',
    'Alaska':       'linear-gradient(135deg,#1a4a3a,#1abc9c,#0d7a5f)',
    'Hawaii':       'linear-gradient(135deg,#c0392b,#e67e22,#f39c12)',
    'Bahamas':      'linear-gradient(135deg,#00cec9,#00b4d8,#48cae4)',
    'Europe':       'linear-gradient(135deg,#2c1654,#6c5ce7,#a29bfe)',
  };
  return map[category] || map['Caribbean'];
}

function getCategoryImage(category) {
  const map = {
    'Caribbean':    '/images/caribbean.jpg',
    'Mediterranean':'/images/naples.webp',
    'Alaska':       '/images/alaska.jpg',
    'Hawaii':       '/images/hawaii.jpg',
    'Bahamas':      '/images/bahamas.jpg',
    'Europe':       '/images/copenhagen.avif',
  };
  return map[category] || map['Caribbean'];
}

function getCategoryEmoji(category) {
  const map = {
    'Caribbean': '🏝️', 'Mediterranean': '🏛️', 'Alaska': '🧊',
    'Hawaii': '🌺', 'Bahamas': '🌊', 'Europe': '🏔️'
  };
  return map[category] || '🚢';
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name) || '';
}

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${escapeHtml(message)}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 350);
  }, 3800);
}

/* ─────────────────────────────────────────────────────────────
   Mobile Navigation
───────────────────────────────────────────────────────────── */
function initMobileNav() {
  const hamburger = document.getElementById('nav-hamburger');
  const drawer    = document.getElementById('nav-mobile-drawer');
  if (!hamburger || !drawer) return;

  hamburger.addEventListener('click', () => {
    const isOpen = drawer.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', String(isOpen));
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!hamburger.contains(e.target) && !drawer.contains(e.target)) {
      drawer.classList.remove('open');
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    }
  });

  // Close on nav link click
  drawer.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      drawer.classList.remove('open');
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ─────────────────────────────────────────────────────────────
   Smooth Scroll (anchor links)
───────────────────────────────────────────────────────────── */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        const navH = parseInt(getComputedStyle(document.documentElement)
          .getPropertyValue('--nav-height'), 10) || 72;
        const y = target.getBoundingClientRect().top + window.scrollY - navH - 12;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    });
  });
}

/* ─────────────────────────────────────────────────────────────
   Newsletter Form
───────────────────────────────────────────────────────────── */
function initNewsletter() {
  const form  = document.getElementById('newsletter-form');
  const input = document.getElementById('newsletter-email');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = (input ? input.value : '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }
    // Simulate subscription
    if (input) input.value = '';
    showToast('🎉 You\'re subscribed! Watch your inbox for exclusive deals.');
  });
}

/* ─────────────────────────────────────────────────────────────
   Build a cruise card HTML string (homepage featured)
───────────────────────────────────────────────────────────── */
function buildCruiseCard(cruise) {
  const savings = cruise.originalPrice > cruise.price
    ? Math.round((1 - cruise.price / cruise.originalPrice) * 100)
    : 0;

  const ports = (cruise.destinations || []).slice(0, 4).join(' · ');

  return `
    <article class="cruise-card">
      <div class="cruise-card-image">
        <img
          src="${getCategoryImage(cruise.category)}"
          alt="${escapeHtml(cruise.category)} cruise"
          loading="lazy"
          style="width:100%;height:100%;object-fit:cover;"
          onerror="this.style.cssText='display:none';this.nextElementSibling.style.display='flex';"
        />
        <div style="
          display:none;
          width:100%;
          height:100%;
          background:${getCategoryGradient(cruise.category)};
          align-items:center;
          justify-content:center;
          font-size:3.5rem;
          position:absolute;
          inset:0;
        ">${getCategoryEmoji(cruise.category)}</div>
        <span class="cruise-badge">${escapeHtml(cruise.category)}</span>
        ${savings > 0 ? `<span class="cruise-badge-sale">Save ${savings}%</span>` : ''}
      </div>
      <div class="cruise-card-body">
        <div class="cruise-card-ship">🚢 ${escapeHtml(cruise.ship)}</div>
        <h3 class="cruise-card-name">${escapeHtml(cruise.name)}</h3>
        <div class="cruise-card-meta">
          <span class="cruise-meta-item"><span class="icon">📅</span>${escapeHtml(String(cruise.duration))} nights</span>
          <span class="cruise-meta-item"><span class="icon">📍</span>${escapeHtml(cruise.departure)}</span>
        </div>
        <div class="cruise-card-ports">
          <span style="font-weight:600;color:var(--navy);">Ports:</span> ${escapeHtml(ports)}${cruise.destinations.length > 4 ? ' &amp; more' : ''}
        </div>
        <div class="cruise-card-footer">
          <div class="cruise-price">
            <span class="cruise-price-from">From per person</span>
            <span class="cruise-price-amount">${formatPrice(cruise.price)}</span>
            ${cruise.originalPrice > cruise.price
              ? `<span class="cruise-price-original">${formatPrice(cruise.originalPrice)}</span>`
              : ''}
          </div>
          <div class="cruise-rating">
            <span class="stars">${renderStars(cruise.rating)}</span>
            <span>${cruise.rating}</span>
            <span class="count">(${cruise.reviewCount})</span>
          </div>
        </div>
        <div class="cruise-card-actions">
          <a href="/cruises" class="btn btn-outline btn-sm">View Details</a>
          <a href="/cruises" class="btn btn-gold btn-sm">Book Now</a>
        </div>
      </div>
    </article>
  `;
}

/* ─────────────────────────────────────────────────────────────
   Homepage: Featured Cruises
───────────────────────────────────────────────────────────── */
async function initFeaturedCruises() {
  const grid = document.getElementById('featured-cruises-grid');
  if (!grid) return;

  try {
    const res  = await fetch('/api/cruises');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const cruises = (data.cruises || data).slice(0, 3);

    grid.innerHTML = cruises.map(buildCruiseCard).join('');
  } catch (err) {
    console.error('Failed to load featured cruises:', err);
    // Fallback static cards
    const fallback = [
      { id:'c1', name:'Caribbean Paradise', ship:'Azure Horizon', duration:7, departure:'Miami, FL',
        destinations:['Nassau','St. Thomas','St. Maarten','CocoCay'], price:899, originalPrice:1099,
        rating:4.9, reviewCount:512, category:'Caribbean' },
      { id:'c2', name:'Mediterranean Discovery', ship:'Azure Serenity', duration:10, departure:'Barcelona, Spain',
        destinations:['Marseille','Rome','Naples','Athens','Santorini'], price:1299, originalPrice:1599,
        rating:4.8, reviewCount:342, category:'Mediterranean' },
      { id:'c3', name:'Alaskan Frontier', ship:'Azure Explorer', duration:8, departure:'Seattle, WA',
        destinations:['Juneau','Skagway','Glacier Bay','Ketchikan'], price:1099, originalPrice:1349,
        rating:4.7, reviewCount:289, category:'Alaska' },
    ];
    grid.innerHTML = fallback.map(buildCruiseCard).join('');
  }
}

/* ─────────────────────────────────────────────────────────────
   Homepage: Hero Search Form
───────────────────────────────────────────────────────────── */
function initHeroSearch() {
  const form = document.getElementById('hero-search-form');
  if (!form) return;

  // Pre-fill departure date min to today
  const departureDateInput = form.querySelector('#depart-date');
  if (departureDateInput) {
    const today = new Date().toISOString().split('T')[0];
    departureDateInput.min = today;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const params = new URLSearchParams();

    const destination = fd.get('destination');
    const guests      = fd.get('guests');
    const departDate  = fd.get('departureDate');
    const returnDate  = fd.get('returnDate');

    if (destination) params.set('destination', destination);
    if (guests && guests !== '2') params.set('guests', guests);
    if (departDate) params.set('departureDate', departDate);
    if (returnDate)  params.set('returnDate', returnDate);

    const qs = params.toString();
    window.location.href = '/cruises' + (qs ? '?' + qs : '');
  });
}

/* ─────────────────────────────────────────────────────────────
   Build full cruise card HTML for Cruises page
───────────────────────────────────────────────────────────── */
function buildCruiseCardFull(cruise) {
  const savings = cruise.originalPrice > cruise.price
    ? Math.round((1 - cruise.price / cruise.originalPrice) * 100)
    : 0;

  const ports = (cruise.destinations || []).join(' · ');
  const cabins = (cruise.cabinTypes || []).map(c =>
    `<span class="cabin-tag">${escapeHtml(c)}</span>`
  ).join('');

  const depDate = cruise.departureDate
    ? new Date(cruise.departureDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  const highlights = (cruise.highlights || []).slice(0, 3).map(h =>
    `<li class="tier-perk" style="color:var(--text-muted);font-size:0.82rem;">${escapeHtml(h)}</li>`
  ).join('');

  return `
    <article class="cruise-card-full">
      <div class="cruise-card-image">
        <img
          src="${getCategoryImage(cruise.category)}"
          alt="${escapeHtml(cruise.category)} cruise"
          loading="lazy"
          style="width:100%;height:100%;object-fit:cover;"
          onerror="this.style.cssText='display:none';this.nextElementSibling.style.display='flex';"
        />
        <div class="cruise-dest-gradient" style="display:none;background:${getCategoryGradient(cruise.category)};align-items:center;justify-content:center;font-size:4rem;position:absolute;inset:0;">${getCategoryEmoji(cruise.category)}</div>
        <span class="cruise-badge">${escapeHtml(cruise.category)}</span>
        ${savings > 0 ? `<span class="cruise-badge-sale">Save ${savings}%</span>` : ''}
      </div>
      <div class="cruise-card-body">
        <div class="cruise-card-ship">🚢 ${escapeHtml(cruise.ship)}</div>
        <h3 class="cruise-card-name">${escapeHtml(cruise.name)}</h3>
        <div class="cruise-card-meta">
          <span class="cruise-meta-item"><span class="icon">📅</span>${escapeHtml(String(cruise.duration))} nights</span>
          <span class="cruise-meta-item"><span class="icon">📍</span>${escapeHtml(cruise.departure)}</span>
        </div>
        ${depDate ? `<div class="cruise-departure-date">🗓️ Next departure: ${escapeHtml(depDate)}</div>` : ''}
        <div class="cruise-card-ports" style="margin-bottom:8px;">
          <span style="font-weight:600;color:var(--navy);font-size:0.82rem;">Ports:</span>
          <span style="font-size:0.82rem;color:var(--text-muted);"> ${escapeHtml(ports)}</span>
        </div>
        ${highlights ? `<ul style="list-style:none;margin-bottom:10px;">${highlights}</ul>` : ''}
        <div class="cabin-types">${cabins}</div>
        <div class="cruise-card-footer">
          <div class="cruise-price">
            <span class="cruise-price-from">From per person</span>
            <span class="cruise-price-amount">${formatPrice(cruise.price)}
              ${savings > 0 ? `<span class="price-savings">-${savings}%</span>` : ''}
            </span>
            ${cruise.originalPrice > cruise.price
              ? `<span class="cruise-price-original">Was ${formatPrice(cruise.originalPrice)}</span>`
              : ''}
          </div>
          <div class="cruise-rating">
            <span class="stars" style="color:#f4c430;">★</span>
            <span>${cruise.rating}</span>
            <span class="count">(${cruise.reviewCount} reviews)</span>
          </div>
        </div>
        <div class="cruise-card-actions">
          <a href="#" class="btn btn-outline btn-sm">View Details</a>
          <a href="#" class="btn btn-gold btn-sm">Book Now</a>
        </div>
      </div>
    </article>
  `;
}

/* ─────────────────────────────────────────────────────────────
   Cruises Page: Filter & Render
───────────────────────────────────────────────────────────── */
let allCruises = [];

function applyFilters() {
  const checkedDestinations = Array.from(
    document.querySelectorAll('input[name="destination"]:checked')
  ).map(cb => cb.value);

  const selectedDuration = document.querySelector('input[name="duration"]:checked');
  const durationVal = selectedDuration ? selectedDuration.value : '';

  const maxPrice = parseInt(document.getElementById('price-max-slider')?.value || 9999, 10);
  const sortVal  = document.getElementById('sort-select')?.value || 'recommended';

  let filtered = allCruises.filter(c => {
    // Destination filter
    if (checkedDestinations.length > 0 && !checkedDestinations.includes(c.category)) return false;

    // Duration filter
    if (durationVal) {
      const d = c.duration;
      if (durationVal === '3-5'  && !(d >= 3 && d <= 5))  return false;
      if (durationVal === '6-8'  && !(d >= 6 && d <= 8))  return false;
      if (durationVal === '9-12' && !(d >= 9 && d <= 12)) return false;
      if (durationVal === '13+'  && d < 13)                return false;
    }

    // Price filter
    if (c.price > maxPrice) return false;

    return true;
  });

  // Sort
  switch (sortVal) {
    case 'price-asc':      filtered.sort((a, b) => a.price - b.price); break;
    case 'price-desc':     filtered.sort((a, b) => b.price - a.price); break;
    case 'duration-asc':   filtered.sort((a, b) => a.duration - b.duration); break;
    case 'duration-desc':  filtered.sort((a, b) => b.duration - a.duration); break;
    case 'rating':         filtered.sort((a, b) => b.rating - a.rating); break;
    default:               break; // recommended = original order
  }

  renderCruiseGrid(filtered);
  renderActiveFilters(checkedDestinations, durationVal, maxPrice);
}

function renderCruiseGrid(cruises) {
  const grid    = document.getElementById('cruises-grid');
  const loading = document.getElementById('cruises-loading');
  const empty   = document.getElementById('cruises-empty');
  const count   = document.getElementById('results-count');

  if (!grid) return;

  if (loading) loading.classList.add('hidden');

  if (count) count.textContent = String(cruises.length);

  if (cruises.length === 0) {
    grid.classList.add('hidden');
    if (empty) empty.classList.remove('hidden');
    return;
  }

  if (empty) empty.classList.add('hidden');
  grid.classList.remove('hidden');
  grid.innerHTML = cruises.map(buildCruiseCardFull).join('');
}

function renderActiveFilters(destinations, duration, maxPrice) {
  const strip = document.getElementById('active-filters');
  if (!strip) return;
  strip.innerHTML = '';

  destinations.forEach(d => {
    const tag = createFilterTag(d, () => {
      const cb = document.getElementById('f-' + d.toLowerCase());
      if (cb) { cb.checked = false; applyFilters(); }
    });
    strip.appendChild(tag);
  });

  if (duration) {
    const labels = { '3-5':'3–5 Nights','6-8':'6–8 Nights','9-12':'9–12 Nights','13+':'13+ Nights' };
    const tag = createFilterTag(labels[duration] || duration, () => {
      const radio = document.getElementById('dur-all');
      if (radio) { radio.checked = true; applyFilters(); }
    });
    strip.appendChild(tag);
  }

  if (maxPrice < 3000) {
    const tag = createFilterTag('Max ' + formatPrice(maxPrice), () => {
      const slider = document.getElementById('price-max-slider');
      if (slider) { slider.value = '3000'; updatePriceDisplay(3000); applyFilters(); }
    });
    strip.appendChild(tag);
  }
}

function createFilterTag(label, onRemove) {
  const tag = document.createElement('div');
  tag.className = 'active-filter-tag';
  tag.innerHTML = `
    <span>${escapeHtml(label)}</span>
    <button class="active-filter-remove" aria-label="Remove filter">&times;</button>
  `;
  tag.querySelector('button').addEventListener('click', onRemove);
  return tag;
}

function updatePriceDisplay(val) {
  const minEl = document.getElementById('price-min-display');
  const maxEl = document.getElementById('price-max-display');
  if (minEl) minEl.textContent = '$0';
  if (maxEl) maxEl.textContent = val >= 3000 ? 'Any' : formatPrice(val);

  // Update slider gradient
  const slider = document.getElementById('price-max-slider');
  if (slider) {
    const pct = (val / 3000) * 100;
    slider.style.background = `linear-gradient(to right, var(--ocean) 0%, var(--ocean) ${pct}%, var(--border) ${pct}%, var(--border) 100%)`;
  }
}

async function initCruisesPage() {
  const grid = document.getElementById('cruises-grid');
  if (!grid) return;

  // Pre-check destination from query param
  const destParam = getQueryParam('destination');

  try {
    let url = '/api/cruises';
    const params = new URLSearchParams();
    if (destParam) params.set('destination', destParam);
    if (params.toString()) url += '?' + params.toString();

    const res  = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allCruises = data.cruises || data;

    // Pre-tick destination checkbox from URL
    if (destParam) {
      const cb = document.querySelector(`input[name="destination"][value="${CSS.escape(destParam)}"]`);
      if (cb) cb.checked = true;
    }

    // Wire up filter controls
    document.querySelectorAll('input[name="destination"]').forEach(cb => {
      cb.addEventListener('change', applyFilters);
    });
    document.querySelectorAll('input[name="duration"]').forEach(r => {
      r.addEventListener('change', applyFilters);
    });

    const priceSlider = document.getElementById('price-max-slider');
    if (priceSlider) {
      priceSlider.addEventListener('input', () => {
        updatePriceDisplay(parseInt(priceSlider.value, 10));
        applyFilters();
      });
    }

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', applyFilters);
    }

    const clearBtn = document.getElementById('clear-filters');
    if (clearBtn) {
      clearBtn.addEventListener('click', clearAllFilters);
    }
    const emptyClearBtn = document.getElementById('empty-clear-filters');
    if (emptyClearBtn) {
      emptyClearBtn.addEventListener('click', clearAllFilters);
    }

    updatePriceDisplay(3000);
    applyFilters();

  } catch (err) {
    console.error('Failed to load cruises:', err);
    const loading = document.getElementById('cruises-loading');
    if (loading) {
      loading.innerHTML = '<span style="color:var(--text-muted);">⚠️ Could not load cruises. Please refresh the page.</span>';
    }
  }
}

function clearAllFilters() {
  document.querySelectorAll('input[name="destination"]').forEach(cb => cb.checked = false);
  const allDur = document.getElementById('dur-all');
  if (allDur) allDur.checked = true;
  const slider = document.getElementById('price-max-slider');
  if (slider) { slider.value = '3000'; updatePriceDisplay(3000); }
  const sort = document.getElementById('sort-select');
  if (sort) sort.value = 'recommended';
  applyFilters();
}

/* ─────────────────────────────────────────────────────────────
   Destinations Page
───────────────────────────────────────────────────────────── */
function buildDestinationCardFull(dest) {
  return `
    <article class="destination-card-full">
      <div class="dest-image">
        <img
          src="${escapeHtml(dest.image)}"
          alt="${escapeHtml(dest.name)} destination"
          loading="lazy"
          style="width:100%;height:100%;object-fit:cover;"
          onerror="this.style.cssText='display:none';this.parentElement.style.background='linear-gradient(135deg,'+${JSON.stringify(dest.color)}+','+${JSON.stringify(dest.color)}+'99)';"
        />
      </div>
      <div class="destination-card-content">
        <h3>${escapeHtml(dest.name)}</h3>
        <div class="destination-tagline">${escapeHtml(dest.tagline)}</div>
        <p class="destination-description">${escapeHtml(dest.description)}</p>
        <div class="destination-meta">
          <div class="destination-meta-item">
            <span class="dest-meta-label">☀️ Climate</span>
            <span class="dest-meta-value">${escapeHtml(dest.climate)}</span>
          </div>
          <div class="destination-meta-item">
            <span class="dest-meta-label">📅 Best Time</span>
            <span class="dest-meta-value">${escapeHtml(dest.bestTime)}</span>
          </div>
        </div>
        <div class="destination-cruise-count">🚢 ${escapeHtml(String(dest.cruiseCount))} cruises available</div>
        <a href="/cruises?destination=${encodeURIComponent(dest.name)}" class="btn btn-primary" style="width:100%;justify-content:center;">
          Explore ${escapeHtml(dest.name)} Cruises &rarr;
        </a>
      </div>
    </article>
  `;
}

async function initDestinationsPage() {
  const grid    = document.getElementById('destinations-grid');
  const loading = document.getElementById('destinations-loading');
  const empty   = document.getElementById('destinations-empty');

  if (!grid) return;

  try {
    const res  = await fetch('/api/destinations');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const destinations = data.destinations || data;

    if (loading) loading.classList.add('hidden');

    if (!destinations || destinations.length === 0) {
      if (empty) empty.classList.remove('hidden');
      return;
    }

    grid.innerHTML = destinations.map(buildDestinationCardFull).join('');
    grid.classList.remove('hidden');

  } catch (err) {
    console.error('Failed to load destinations:', err);
    if (loading) loading.classList.add('hidden');
    if (empty)   empty.classList.remove('hidden');
  }
}

/* ─────────────────────────────────────────────────────────────
   Page detection & init
───────────────────────────────────────────────────────────── */
function detectPage() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/'   || path === '/index.html') return 'home';
  if (path === '/cruises')                       return 'cruises';
  if (path === '/destinations')                  return 'destinations';
  if (path === '/media')                         return 'media';
  return 'other';
}

document.addEventListener('DOMContentLoaded', () => {
  // Always init
  initMobileNav();
  initSmoothScroll();
  initNewsletter();

  const page = detectPage();

  switch (page) {
    case 'home':
      initFeaturedCruises();
      initHeroSearch();
      break;
    case 'cruises':
      initCruisesPage();
      break;
    case 'destinations':
      initDestinationsPage();
      break;
    default:
      break;
  }
});
