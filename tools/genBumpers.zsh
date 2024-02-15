#!/bin/zsh
set -eu -o pipefail

_vdur=10

# for i in {1..10}; do
#   rand() {node -e "console.log(Math.floor(Math.random()*($1))+(${2:-0}))";}
#   vidfilepaths=("/mnt/m/TV/Ambient Swim/Season "*/*)
#   _infilepath=$vidfilepaths[$(rand ${#vidfilepaths} 1)]
#   totaldurf=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$_infilepath")
#   _vstart=$(rand "$totaldurf-$_vdur")
#   _outfilepath="/mnt/c/Users/Mike/downloads/thing${i}.mp4"

i=0;
for _infilepath in "/mnt/m/TV/Ambient Swim/Season "*/*; do
  totaldurf=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$_infilepath")
  totaldur=${totaldurf%.*}
  
  for ((_vstart = 0; _vstart < totaldur - _vdur; _vstart += _vdur)); do
    _outfilepath="/mnt/m/TV/Ambient Swim/bumps/bump${i}.mp4"
    i=$((i+1))
    
    [ -f "$_outfilepath" ] && continue;
    
    echo "$((i-1)) $_infilepath $_vstart/$totaldur"
    
    infilepath=$_infilepath
    outfilepath=$_outfilepath
    fw=1280 fh=720 # final size
    wh=20 wx=80 wy=50 wa=0.75 # watermark height, offset, and transparency
    lh=30 # endcard logo height
    cdur=0.5 # endcard duration
    vstart=$_vstart vdur=$_vdur # video cut
    cstart=$((vdur-cdur))
    
    ffmpeg \
    -v error \
    -ss ${vstart}s \
    -t ${vdur}s \
    -i "$infilepath" \
    -i '/mnt/c/Users/Mike/Downloads/as-white.png' \
    -filter_complex "
      [0:v]scale=w=${fw}:h=${fh}:force_original_aspect_ratio=decrease,setsar=1:1,pad=w=${fw}:h=${fh}:x=(ow/2)-(iw/2):y=(oh/2)-(ih/2):color=black[vid];
      [1:v]split=2[logo1][logo2];
      [logo1]scale=h=${wh}:w=-1,setsar=1,colorchannelmixer=aa=${wa}[watermark];
      [logo2]scale=h=${lh}:w=-1,setsar=1[card_logo];
      [vid][watermark]overlay=x=main_w-overlay_w-${wx}:y=main_h-overlay_h-${wy}[vid_watermark];
      [vid_watermark]drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill:enable='gte(t,$cstart)'[vid_watermark_cardbg];
      [vid_watermark_cardbg][card_logo]overlay=x=(main_w/2)-(overlay_w/2):y=(main_h/2)-(overlay_h/2):enable='gte(t,$cstart)'[vid_watermark_cardbg_logo];
      [0:a]afade=t=in:ss=0:d=1[audio_fadein]
    " \
    -map '[vid_watermark_cardbg_logo]' \
    -map '[audio_fadein]' \
    -c:v libx264 \
    -pix_fmt yuv420p \
    -profile:v main \
    -level 3.0 \
    -crf 10 \
    -preset slow \
    -movflags +faststart \
    -c:a aac \
    -b:a 128k \
    -f mp4 \
    "$outfilepath"
  ;
  done
done