const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 8080;

// ─── Middleware ───────────────────────────────────────────────────────────────

//temporarily comment out helmet
/*
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        mediaSrc: ["'self'", "https:", "blob:"],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
*/


app.use(compression());
app.use(morgan("combined"));
app.set("trust proxy", 1);

// Static files (CSS, JS, images, SVGs) — short cache for dev, 1 day for prod
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: process.env.NODE_ENV === "production" ? "1d" : 0,
    etag: true,
    lastModified: true,
  })
);

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    region: process.env.AWS_REGION || "unknown",
    version: process.env.APP_VERSION || "1.0.0",
  });
});

// ─── API: Request Metadata ────────────────────────────────────────────────────

app.get("/api/info", (req, res) => {
  res.json({
    clientIp: req.ip,
    headers: {
      "x-forwarded-for": req.headers["x-forwarded-for"],
      "cloudfront-viewer-country": req.headers["cloudfront-viewer-country"],
      "cloudfront-viewer-city": req.headers["cloudfront-viewer-city"],
      "x-amz-cf-id": req.headers["x-amz-cf-id"],
      "user-agent": req.headers["user-agent"],
    },
    environment: process.env.NODE_ENV || "development",
  });
});

// ─── API: Media Catalog ───────────────────────────────────────────────────────
// Returns the list of photos and videos the gallery should display.
// In production, srcUrl / thumbnailUrl point to CloudFront URLs (env var override).
// Locally they fall back to the bundled /public/images/* assets.

const CF_URL = process.env.CLOUDFRONT_URL
  ? process.env.CLOUDFRONT_URL.replace(/\/$/, "")
  : "";

function mediaUrl(localPath) {
  return CF_URL ? `${CF_URL}${localPath}` : localPath;
}

app.get("/api/media", (req, res) => {
  const { type } = req.query; // optional filter: "photo" | "video"

  const catalog = [
    // ── Photos ───────────────────────────────────────────────────────────────
    {
      id: "photo-1",
      type: "photo",
      title: "Mountain Peaks",
      description: "Snow-capped mountains at golden hour",
      category: "Nature",
      src: mediaUrl("/public/images/sample-1.svg"),
      width: 1200,
      height: 800,
    },
    {
      id: "photo-2",
      type: "photo",
      title: "City Skyline",
      description: "Downtown skyline reflected in the river at dusk",
      category: "Urban",
      src: mediaUrl("/public/images/sample-2.svg"),
      width: 1200,
      height: 800,
    },
    {
      id: "photo-3",
      type: "photo",
      title: "Forest Path",
      description: "A quiet trail winding through ancient pines",
      category: "Nature",
      src: mediaUrl("/public/images/sample-3.svg"),
      width: 1200,
      height: 800,
    },
    {
      id: "photo-4",
      type: "photo",
      title: "Ocean Sunset",
      description: "Warm hues over the Pacific horizon",
      category: "Nature",
      src: mediaUrl("/public/images/sample-4.svg"),
      width: 1200,
      height: 800,
    },
    {
      id: "photo-5",
      type: "photo",
      title: "Abstract Geometry",
      description: "Bold shapes and contrasting gradients",
      category: "Abstract",
      src: mediaUrl("/public/images/sample-5.svg"),
      width: 1200,
      height: 800,
    },
    {
      id: "photo-6",
      type: "photo",
      title: "Night Sky",
      description: "The Milky Way above a desert landscape",
      category: "Nature",
      src: mediaUrl("/public/images/sample-6.svg"),
      width: 1200,
      height: 800,
    },
    // ── Videos ───────────────────────────────────────────────────────────────
    {
      id: "video-1",
      type: "video",
      title: "Big Buck Bunny",
      description: "Classic open-source animated short film (360p sample)",
      category: "Animation",
      duration: "9:56",
      src: mediaUrl("/media/big-buck-bunny.mp4"),
      // Fallback to a well-known public sample if local file not present
      fallbackSrc: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      thumbnail: mediaUrl("/public/images/thumb-1.svg"),
      width: 640,
      height: 360,
    },
    {
      id: "video-2",
      type: "video",
      title: "Elephant Dream",
      description: "The first Blender open movie project",
      category: "Animation",
      duration: "10:54",
      src: mediaUrl("/media/elephant-dream.mp4"),
      fallbackSrc: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
      thumbnail: mediaUrl("/public/images/thumb-2.svg"),
      width: 640,
      height: 360,
    },
    {
      id: "video-3",
      type: "video",
      title: "For Bigger Joyrides",
      description: "A quick demo reel showcasing dynamic motion",
      category: "Demo",
      duration: "0:15",
      src: mediaUrl("/media/for-bigger-joyrides.mp4"),
      fallbackSrc: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
      thumbnail: mediaUrl("/public/images/thumb-3.svg"),
      width: 640,
      height: 360,
    },
  ];

  const filtered = type
    ? catalog.filter((item) => item.type === type)
    : catalog;

  res.json({ items: filtered, total: filtered.length });
});

// ─── Video Streaming (HTTP Range Requests / 206 Partial Content) ──────────────
// Handles local /media/*.mp4 files with proper byte-range streaming so browsers
// can seek without downloading the entire file first.

app.get("/media/:filename", (req, res) => {
  const filename = path.basename(req.params.filename); // prevent path traversal
  const mediaDir = path.join(__dirname, "media");
  const filePath = path.join(mediaDir, filename);

  // Only serve files that actually exist locally
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Media file not found locally. Use fallbackSrc from /api/media." });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const ext = path.extname(filename).toLowerCase();

  const mimeTypes = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".ogg": "video/ogg",
    ".mov": "video/quicktime",
  };
  const contentType = mimeTypes[ext] || "application/octet-stream";

  const rangeHeader = req.headers.range;

  if (rangeHeader) {
    // ── Partial content (seekable streaming) ──
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    });

    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    // ── Full file ──
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=86400",
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// ─── API: Cruise Catalog ──────────────────────────────────────────────────────

const CRUISE_CATALOG = [
  {
    id: "cruise-1",
    name: "Caribbean Paradise",
    ship: "Azure Horizon",
    duration: 7,
    departure: "Miami, FL",
    departureDate: "2026-06-14",
    category: "Caribbean",
    price: 899,
    originalPrice: 1099,
    rating: 4.9,
    reviewCount: 512,
    destinations: ["Nassau, Bahamas", "St. Thomas, USVI", "St. Maarten", "CocoCay"],
    highlights: [
      "Private beach day at CocoCay",
      "Snorkelling in crystal-clear bays",
      "Live Caribbean entertainment nightly",
    ],
    cabinTypes: ["Interior", "Ocean View", "Balcony", "Suite"],
    description:
      "Escape to paradise on this 7-night Caribbean voyage. Soak up sun on white-sand beaches, snorkel in turquoise waters, and discover the vibrant culture of the islands.",
  },
  {
    id: "cruise-2",
    name: "Mediterranean Discovery",
    ship: "Azure Serenity",
    duration: 10,
    departure: "Barcelona, Spain",
    departureDate: "2026-07-05",
    category: "Mediterranean",
    price: 1299,
    originalPrice: 1599,
    rating: 4.8,
    reviewCount: 342,
    destinations: ["Marseille, France", "Rome, Italy", "Naples, Italy", "Athens, Greece", "Santorini, Greece"],
    highlights: [
      "Exclusive guided tour of the Colosseum",
      "Sunrise view of Santorini caldera",
      "Private wine tasting in Provence",
    ],
    cabinTypes: ["Interior", "Ocean View", "Balcony", "Suite"],
    description:
      "Journey through history on this 10-night Mediterranean odyssey. From the ancient ruins of Rome to the iconic white-washed cliffs of Santorini, every port tells a story.",
  },
  {
    id: "cruise-3",
    name: "Alaskan Frontier",
    ship: "Azure Explorer",
    duration: 8,
    departure: "Seattle, WA",
    departureDate: "2026-08-02",
    category: "Alaska",
    price: 1099,
    originalPrice: 1349,
    rating: 4.7,
    reviewCount: 289,
    destinations: ["Juneau, AK", "Skagway, AK", "Glacier Bay", "Ketchikan, AK"],
    highlights: [
      "Glacier Bay National Park scenic cruising",
      "Whale watching in Frederick Sound",
      "Gold Rush history tour in Skagway",
    ],
    cabinTypes: ["Interior", "Ocean View", "Balcony", "Suite"],
    description:
      "Venture into the breathtaking wilderness of Alaska. Witness calving glaciers, soaring bald eagles, and humpback whales breaching in the pristine waters of the Last Frontier.",
  },
  {
    id: "cruise-4",
    name: "Hawaiian Island Hopper",
    ship: "Azure Pacific",
    duration: 9,
    departure: "Honolulu, HI",
    departureDate: "2026-09-13",
    category: "Hawaii",
    price: 1449,
    originalPrice: 1749,
    rating: 4.8,
    reviewCount: 198,
    destinations: ["Maui", "Big Island", "Kauai", "Molokai"],
    highlights: [
      "Volcano National Park lava tour",
      "Na Pali Coast sea cliffs excursion",
      "Luau on the beach at sunset",
    ],
    cabinTypes: ["Interior", "Ocean View", "Balcony", "Suite"],
    description:
      "Discover the magic of every Hawaiian island on this 9-night inter-island adventure. Each island offers its own unique landscapes, from volcanic craters to lush rainforests.",
  },
  {
    id: "cruise-5",
    name: "Bahamas Escape",
    ship: "Azure Breeze",
    duration: 4,
    departure: "Fort Lauderdale, FL",
    departureDate: "2026-05-22",
    category: "Bahamas",
    price: 499,
    originalPrice: 599,
    rating: 4.6,
    reviewCount: 445,
    destinations: ["Nassau, Bahamas", "Blue Lagoon Island", "Bimini"],
    highlights: [
      "Swim with dolphins at Blue Lagoon",
      "World-famous Atlantis beach club access",
      "Duty-free shopping in Nassau",
    ],
    cabinTypes: ["Interior", "Ocean View", "Balcony"],
    description:
      "The perfect quick getaway. This 4-night Bahamas escape whisks you away to crystal-clear waters and powdery white beaches — the ideal long weekend at sea.",
  },
  {
    id: "cruise-6",
    name: "Northern Europe Explorer",
    ship: "Azure Nordic",
    duration: 14,
    departure: "Southampton, UK",
    departureDate: "2026-07-18",
    category: "Europe",
    price: 1899,
    originalPrice: 2299,
    rating: 4.9,
    reviewCount: 156,
    destinations: ["Amsterdam, Netherlands", "Copenhagen, Denmark", "Oslo, Norway", "Bergen, Norway", "Reykjavik, Iceland"],
    highlights: [
      "Norwegian Fjords scenic cruising",
      "Northern lights viewing in Iceland",
      "Anne Frank House visit in Amsterdam",
    ],
    cabinTypes: ["Interior", "Ocean View", "Balcony", "Suite"],
    description:
      "An epic 14-night voyage through the magnificent fjords of Norway, the fairy-tale canals of Amsterdam, and the volcanic landscapes of Iceland. A bucket-list adventure.",
  },
];

app.get("/api/cruises", (req, res) => {
  const { category, destination, duration } = req.query;

  let cruises = [...CRUISE_CATALOG];

  // Filter by category or destination (both map to cruise.category)
  const destFilter = category || destination;
  if (destFilter) {
    const lower = destFilter.toLowerCase();
    cruises = cruises.filter(
      (c) =>
        c.category.toLowerCase() === lower ||
        c.name.toLowerCase().includes(lower)
    );
  }

  // Filter by duration band
  if (duration) {
    cruises = cruises.filter((c) => {
      const d = c.duration;
      if (duration === "3-5")  return d >= 3 && d <= 5;
      if (duration === "6-8")  return d >= 6 && d <= 8;
      if (duration === "9-12") return d >= 9 && d <= 12;
      if (duration === "13+")  return d >= 13;
      return true;
    });
  }

  res.json({ cruises, total: cruises.length });
});

// ─── API: Destinations Catalog ────────────────────────────────────────────────

const DESTINATIONS_CATALOG = [
  {
    id: "dest-1",
    name: "Caribbean",
    tagline: "Sun-Drenched Paradise",
    description:
      "Turquoise waters, powder-white beaches and vibrant island cultures await on a Caribbean voyage. From the buzzing Nassau harbour to the secluded cays of St. Maarten, every island offers its own slice of paradise.",
    color: "#0077b6",
    climate: "Tropical",
    bestTime: "Nov – Apr",
    cruiseCount: 12,
    image: "/images/caribbean.jpg",
  },
  {
    id: "dest-2",
    name: "Mediterranean",
    tagline: "Ancient History & Timeless Beauty",
    description:
      "Sail between iconic ancient ruins, sun-baked hilltop villages and Michelin-starred restaurants. The Mediterranean is where history, culture and cuisine converge in one unforgettable journey.",
    color: "#1a3a6b",
    climate: "Mediterranean",
    bestTime: "May – Oct",
    cruiseCount: 9,
    image: "/images/naples.webp",
  },
  {
    id: "dest-3",
    name: "Alaska",
    tagline: "Wild & Untamed Wilderness",
    description:
      "Witness the raw power of nature as you cruise past towering glaciers, ancient rainforests and snow-capped peaks. Alaska is the ultimate destination for travellers seeking adventure and wonder.",
    color: "#1a4a3a",
    climate: "Subarctic",
    bestTime: "May – Sep",
    cruiseCount: 6,
    image: "/images/alaska.jpg",
  },
  {
    id: "dest-4",
    name: "Hawaii",
    tagline: "Aloha Spirit & Island Magic",
    description:
      "Each Hawaiian island has its own personality — from the volcanic drama of the Big Island to the emerald sea cliffs of Kauai. A Hawaii cruise lets you experience them all without unpacking more than once.",
    color: "#c0392b",
    climate: "Tropical",
    bestTime: "Apr – Oct",
    cruiseCount: 5,
    image: "/images/hawaii.jpg",
  },
  {
    id: "dest-5",
    name: "Bahamas",
    tagline: "The Ultimate Quick Escape",
    description:
      "Just a short sail from Florida, the Bahamas offer some of the most brilliant blue water in the world. Whether you want to lounge on the beach or swim with dolphins, this is the perfect tropical getaway.",
    color: "#00cec9",
    climate: "Tropical",
    bestTime: "Dec – Apr",
    cruiseCount: 8,
    image: "/images/bahamas.jpg",
  },
  {
    id: "dest-6",
    name: "Northern Europe",
    tagline: "Fjords, Castles & Arctic Light",
    description:
      "From the flower-lined canals of Amsterdam to the dramatic fjords of Norway and the volcanic plains of Iceland, Northern Europe delivers extraordinary scenery and culture at every port of call.",
    color: "#2c1654",
    climate: "Temperate",
    bestTime: "Jun – Aug",
    cruiseCount: 4,
    image: "/images/copenhagen.avif",
  },
];

app.get("/api/destinations", (req, res) => {
  res.json({ destinations: DESTINATIONS_CATALOG, total: DESTINATIONS_CATALOG.length });
});

// ─── Page Routes ──────────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/cruises", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "cruises.html"));
});

app.get("/destinations", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "destinations.html"));
});

app.get("/media", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "media.html"));
});

// Catch-all: serve index for any unmatched GET (excludes /api/* and /media/* handled above)
app.get("*", (req, res) => {
  // Don't intercept API or media streaming routes
  if (req.path.startsWith("/api/") || req.path.startsWith("/media/")) {
    return res.status(404).json({ error: "Not found" });
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CloudFront URL: ${CF_URL || "(not set — using local paths)"}`);
});

module.exports = app;
