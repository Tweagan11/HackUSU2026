#!/bin/bash

if [ ! -f "./code-sergeant/main.py" ]; then
    echo "main.py not found!"
    exit 1
fi

uvicorn main:app --reload --host 0.0.0.0 --port 8000