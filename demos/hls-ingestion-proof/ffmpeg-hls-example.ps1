# RelayStream HLS Ingestion Proof Example
# This script demonstrates the type of FFmpeg workflow used by RelayStream
# to convert source media into HLS-compatible segmented output.

# Input:
#   Source media file
#
# Output:
#   index.m3u8 manifest
#   segmented .ts media chunks

ffmpeg -y `
  -fflags +genpts `
  -i "C:\RelayStream\input\source-media.mp4" `
  -map 0:v:0 `
  -map 0:a:0 `
  -c:v libx264 `
  -preset veryfast `
  -crf 23 `
  -g 48 `
  -sc_threshold 0 `
  -c:a aac `
  -ar 48000 `
  -b:a 160k `
  -ac 2 `
  -hls_time 10 `
  -hls_list_size 0 `
  -hls_playlist_type vod `
  -hls_segment_filename "C:\RelayStream\output\chunks\index%06d.ts" `
  "C:\RelayStream\output\index.m3u8"

# Expected output structure:
#
# C:\RelayStream\output\
# ├── index.m3u8
# └── chunks\
#     ├── index000000.ts
#     ├── index000001.ts
#     ├── index000002.ts
#     └── ...
