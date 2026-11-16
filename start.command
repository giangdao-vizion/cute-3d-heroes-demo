#!/bin/bash
# Bấm đúp file này để mở demo (cần Python 3 có sẵn trên macOS).
cd "$(dirname "$0")"
PORT=8790
open "http://localhost:$PORT/" &
python3 -m http.server $PORT
