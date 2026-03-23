const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 8080;

// ─── Middleware ───────────────────────────────────────────────────────────────

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

app.use(compression());
app.use(morgan("combined"));
app.set("trust proxy", 1);

// Static files (CSS, JS, images, SVGs) — short cache for dev, 1 day for prod
app.use(
  "/public",
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

// ─── Page Routes ──────────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/media", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "media.html"));
});

// SPA catch-all fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CloudFront URL: ${CF_URL || "(not set — using local paths)"}`);
});

module.exports = app;
