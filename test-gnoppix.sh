#!/bin/bash
curl https://us.gnoppix.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${GNOPPIX_API_KEY}" \
  -d '{
    "model": "google/gemma-4-31b-it:free",
    "messages": [
      {
        "role": "user",
        "content": "hello world"
      }
    ],
    "temperature": 0.7
  }'
