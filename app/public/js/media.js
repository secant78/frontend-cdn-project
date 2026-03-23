/**
 * media.js
 * Gallery page — fetches media catalog from /api/media, renders cards,
 * handles filter tabs, photo lightbox, and video modal.
 */

(function () {
  "use strict";

  // ─── State ─────────────────────────────────────────────────────────────────
  let allItems = [];
  let photoItems = [];
  let currentFilter = "all";
  let lightboxIndex = 0;   // index within photoItems

  // ─── DOM refs ──────────────────────────────────────────────────────────────
  const grid       = document.getElementById("gallery-grid");
  const countEl    = document.getElementById("gallery-count");
  const emptyEl    = document.getElementById("gallery-empty");
  const filterTabs = document.querySelectorAll(".filter-tab");

  // Lightbox
  const lightbox  = document.getElementById("lightbox");
  const lbImg     = document.getElementById("lb-img");
  const lbCaption = document.getElementById("lb-caption");
  const lbClose   = document.getElementById("lb-close");
  const lbPrev    = document.getElementById("lb-prev");
  const lbNext    = document.getElementById("lb-next");

  // Video modal
  const videoModal = document.getElementById("video-modal");
  const vmBackdrop = document.getElementById("vm-backdrop");
  const vmClose    = document.getElementById("vm-close");
  const vmPlayer   = document.getElementById("vm-player");
  const vmSource   = document.getElementById("vm-source");
  const vmTitle    = document.getElementById("vm-title");
  const vmCategory = document.getElementById("vm-category");
  const vmDesc     = document.getElementById("vm-desc");

  // ─── Utilities ─────────────────────────────────────────────────────────────
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function visibleItems() {
    if (currentFilter === "all") return allItems;
    return allItems.filter((item) => item.type === currentFilter);
  }

  // ─── Fetch media catalog ───────────────────────────────────────────────────
  async function fetchCatalog() {
    try {
      const res = await fetch("/api/media");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      allItems = data.items || [];
      photoItems = allItems.filter((i) => i.type === "photo");
      renderGallery();
    } catch (err) {
      grid.innerHTML = `<div style="color:var(--text-muted);grid-column:1/-1;padding:40px 0;text-align:center">
        Failed to load media: ${escapeHtml(err.message)}
      </div>`;
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  function renderGallery() {
    const items = visibleItems();

    // Update count
    const label = currentFilter === "all" ? "items" : currentFilter + "s";
    countEl.textContent = `${items.length} ${label}`;

    if (items.length === 0) {
      grid.innerHTML = "";
      emptyEl.classList.remove("hidden");
      return;
    }
    emptyEl.classList.add("hidden");

    grid.innerHTML = items.map((item, idx) =>
      item.type === "photo" ? photoCard(item, idx) : videoCard(item, idx)
    ).join("");

    // Attach event listeners
    grid.querySelectorAll(".media-card[data-type='photo']").forEach((card) => {
      card.addEventListener("click", () => openLightbox(card.dataset.id));
    });
    grid.querySelectorAll(".media-card[data-type='video']").forEach((card) => {
      card.addEventListener("click", () => openVideo(card.dataset.id));
    });

    // Intersection Observer for lazy-loaded images
    const imgs = grid.querySelectorAll("img[data-src]");
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const img = e.target;
            img.src = img.dataset.src;
            img.removeAttribute("data-src");
            io.unobserve(img);
          }
        });
      }, { rootMargin: "200px" });
      imgs.forEach((img) => io.observe(img));
    } else {
      imgs.forEach((img) => { img.src = img.dataset.src; });
    }
  }

  function photoCard(item) {
    return `
    <article class="media-card" data-type="photo" data-id="${escapeHtml(item.id)}"
             role="button" tabindex="0" aria-label="View photo: ${escapeHtml(item.title)}">
      <div class="card-thumb">
        <img
          data-src="${escapeHtml(item.src)}"
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E"
          alt="${escapeHtml(item.title)}"
          loading="lazy"
          width="${item.width}" height="${item.height}"
        />
        <span class="card-category">${escapeHtml(item.category)}</span>
        <div class="card-photo-overlay">
          <div class="card-expand-icon">&#8599;</div>
        </div>
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(item.title)}</div>
        <div class="card-desc">${escapeHtml(item.description)}</div>
        <div class="card-meta">
          <span class="card-type-badge photo">Photo</span>
        </div>
      </div>
    </article>`;
  }

  function videoCard(item) {
    return `
    <article class="media-card" data-type="video" data-id="${escapeHtml(item.id)}"
             role="button" tabindex="0" aria-label="Play video: ${escapeHtml(item.title)}">
      <div class="card-thumb">
        <img
          data-src="${escapeHtml(item.thumbnail)}"
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E"
          alt="${escapeHtml(item.title)} thumbnail"
          loading="lazy"
          width="${item.width}" height="${item.height}"
        />
        <span class="card-category">${escapeHtml(item.category)}</span>
        <div class="card-play-btn" aria-hidden="true"></div>
        <span class="card-duration">${escapeHtml(item.duration)}</span>
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(item.title)}</div>
        <div class="card-desc">${escapeHtml(item.description)}</div>
        <div class="card-meta">
          <span class="card-type-badge video">Video</span>
        </div>
      </div>
    </article>`;
  }

  // ─── Filter tabs ───────────────────────────────────────────────────────────
  filterTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      filterTabs.forEach((t) => { t.classList.remove("active"); t.setAttribute("aria-selected", "false"); });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      currentFilter = tab.dataset.filter;
      renderGallery();
    });
  });

  // ─── Photo Lightbox ─────────────────────────────────────────────────────────
  function openLightbox(id) {
    const idx = photoItems.findIndex((i) => i.id === id);
    if (idx === -1) return;
    lightboxIndex = idx;
    showLightboxSlide();
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
    lbClose.focus();
  }

  function showLightboxSlide() {
    const item = photoItems[lightboxIndex];
    lbImg.src = item.src;
    lbImg.alt = item.title;
    lbCaption.textContent = `${item.title} — ${item.description}`;
    lbPrev.style.visibility = lightboxIndex > 0 ? "visible" : "hidden";
    lbNext.style.visibility = lightboxIndex < photoItems.length - 1 ? "visible" : "hidden";
  }

  function closeLightbox() {
    lightbox.hidden = true;
    document.body.style.overflow = "";
  }

  lbClose.addEventListener("click", closeLightbox);
  lbPrev.addEventListener("click", () => { if (lightboxIndex > 0) { lightboxIndex--; showLightboxSlide(); } });
  lbNext.addEventListener("click", () => { if (lightboxIndex < photoItems.length - 1) { lightboxIndex++; showLightboxSlide(); } });

  // Close on backdrop click
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });

  // ─── Video Modal ────────────────────────────────────────────────────────────
  function openVideo(id) {
    const item = allItems.find((i) => i.id === id);
    if (!item) return;

    vmTitle.textContent    = item.title;
    vmCategory.textContent = item.category;
    vmDesc.textContent     = item.description;

    // Try the primary src first; if the server 404s, swap to fallbackSrc
    vmSource.src = item.src;
    vmPlayer.load();
    vmPlayer.addEventListener("error", function onErr() {
      if (item.fallbackSrc && vmSource.src !== item.fallbackSrc) {
        vmSource.src = item.fallbackSrc;
        vmPlayer.load();
      }
      vmPlayer.removeEventListener("error", onErr);
    }, { once: true });

    videoModal.hidden = false;
    document.body.style.overflow = "hidden";
    vmClose.focus();
  }

  function closeVideo() {
    videoModal.hidden = true;
    vmPlayer.pause();
    vmSource.src = "";
    vmPlayer.load();
    document.body.style.overflow = "";
  }

  vmClose.addEventListener("click", closeVideo);
  vmBackdrop.addEventListener("click", closeVideo);

  // ─── Keyboard navigation ────────────────────────────────────────────────────
  document.addEventListener("keydown", (e) => {
    if (!lightbox.hidden) {
      if (e.key === "Escape")     closeLightbox();
      if (e.key === "ArrowLeft")  lbPrev.click();
      if (e.key === "ArrowRight") lbNext.click();
    }
    if (!videoModal.hidden && e.key === "Escape") closeVideo();
  });

  // Keyboard activation for cards (Enter / Space)
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("media-card")) {
      e.preventDefault();
      e.target.click();
    }
  });

  // ─── Boot ───────────────────────────────────────────────────────────────────
  fetchCatalog();
})();
