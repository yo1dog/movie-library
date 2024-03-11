# Containers

Container | Count | C | E | F
----------|-------|---|---|---
mp4       | 19014 | X | X | X
mkv       |  3343 | X | X |  
avi       |    27 |   |   |  


# Audio Codecs

Codec  | Feature       | Count | C | E | F
-------|---------------|-------|---|---|---
aac    | AAC           | 21351 | X | X | X
ac3    | AC-3          |   807 | * | X |  
eac3   | Enhanced AC-3 |    95 | * | X |  
mp3    | MP3           |   169 | X | X | X
opus   | Opus          |    44 | X | X | X
vorbis | vorbis        |    28 | X | X | X


# Video Codecs

Codec      | Feature    | Count | C | E | F
-----------|------------|-------|---|---|---
h264       | AVC/H.264  | 19243 | X | X | X
hevc       | HEVC/H.265 |  3063 | X | X |  
mpeg2video | MPEG-2     |    26 |   |   |  
av1        | AV1        |    12 | X | X | X
mpeg4      | ?          |    40 |   |   |  

NOTE: For some reason, edge sometimes re-colors videos. May have something to do with color profiles.

\* Custom Chromimum build supports these and others. You can download one bellow or to build one yourself see ./chromiumCustomBuild.md
https://github.com/StaZhu/enable-chromium-hevc-hardware-decoding/releases
