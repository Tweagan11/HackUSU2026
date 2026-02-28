#!/bin/bash

set -euo pipefail

SERVER_FILE="./code-sergeant/server/main.py"

if [ ! -f "$SERVER_FILE" ]; then
    echo "Server file not found: $SERVER_FILE"
    exit 1
fi

cd ./code-sergeant/server
uvicorn main:app --reload --host 127.0.0.1 --port 8000
