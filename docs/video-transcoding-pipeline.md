# Video Transcoding Pipeline (Supabase + FFmpeg Worker)

This project now supports a transcode-ready flow for supplier product videos.

## Goal

Guarantee playback in browsers by converting non-browser-native source formats (for example, `mkv`/`avi`) into a browser-safe output (`mp4` H.264/AAC, optional `webm`).

## Implemented App-Side Changes

- Upload and preview MIME handling is centralized in `src/lib/video.ts`.
- `supplier_products` records can store:
  - `video_playback_url`
  - `video_transcoded_url`
  - `video_source_mime`
  - `video_transcode_status`
  - `video_transcode_error`
  - `video_transcode_requested_at`
  - `video_transcoded_at`
- Product write APIs seed transcode state automatically:
  - Browser-native URLs: `not_needed`
  - Non-native direct URLs: `queued`
- Supplier detail page automatically prefers `video_playback_url` (then transcoded URL, then original source URL).
- Worker callback endpoint:
  - `POST /api/videos/transcode/callback`
  - Auth: header `x-transcode-secret` (or `Authorization: Bearer ...`)
  - Secret env: `VIDEO_TRANSCODE_WEBHOOK_SECRET`

## Database Setup

Run `supabase-video-transcoding.sql` in Supabase SQL Editor.

It adds:

- New `supplier_products` columns for transcode lifecycle.
- `video_transcode_jobs` queue table.
- Trigger that enqueues jobs when `video_transcode_status = 'queued'`.

## Worker Contract

Use any worker runtime (Node, Python, container, serverless). The worker should:

1. Poll `video_transcode_jobs` where `status = 'queued'`.
2. Mark row as `processing`, increment `attempts`, set `started_at`.
3. Download source from `source_url`.
4. Transcode with `ffmpeg`:
   - target container: `mp4`
   - video codec: `libx264`
   - audio codec: `aac`
   - optional second output: `webm` for fallback
5. Upload output to your `videos` bucket (e.g. `videos/transcoded/<productId>.mp4`).
6. Call callback endpoint with `status: completed` and `transcodedUrl`.
7. Mark job `completed` with `finished_at`.

On error:

- Call callback endpoint with `status: failed` and error message.
- Mark job `failed` (or requeue if `attempts` below threshold).

## Callback Payloads

### Processing

```json
{
  "productId": "uuid",
  "status": "processing",
  "sourceMime": "video/x-matroska"
}
```

### Completed

```json
{
  "productId": "uuid",
  "status": "completed",
  "transcodedUrl": "https://<supabase-storage-public-url>/videos/transcoded/<id>.mp4",
  "sourceMime": "video/x-matroska"
}
```

### Failed

```json
{
  "productId": "uuid",
  "status": "failed",
  "error": "ffmpeg exited with code 1"
}
```

## Recommended Environment Variables

- App (`.env.local`)
  - `VIDEO_TRANSCODE_WEBHOOK_SECRET=<strong-random-secret>`
- Worker
  - Supabase URL + service key
  - Callback URL
  - Same webhook secret

## FFmpeg Reference Command

```bash
ffmpeg -i input.mkv \
  -c:v libx264 -preset medium -crf 23 \
  -c:a aac -b:a 128k \
  -movflags +faststart \
  output.mp4
```

## Notes

- This setup guarantees playback only after worker conversion finishes.
- Until completion, UI still has source URL fallback for best-effort immediate preview.
