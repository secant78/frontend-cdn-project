# app/media/ — Local Video Files

Place short MP4 video files here for local development.

## Expected filenames (matching server.js catalog)
- `big-buck-bunny.mp4`
- `elephant-dream.mp4`
- `for-bigger-joyrides.mp4`

## Download sample videos
```bash
# Big Buck Bunny (360p, ~65 MB)
curl -o big-buck-bunny.mp4 \
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"

# Elephant Dream (360p, ~55 MB)
curl -o elephant-dream.mp4 \
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"

# For Bigger Joyrides (short, ~2 MB)
curl -o for-bigger-joyrides.mp4 \
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4"
```

## Production
In production these files should live in S3 and be served via CloudFront.
Run `python infrastructure/upload_media.py` to upload them.
The server will serve a 404 for missing local files, and the browser
will automatically fall back to the `fallbackSrc` public URL defined
in `/api/media`.
