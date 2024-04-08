#!/bin/sh

echo "This is stdout"
echo "This is stderr" >&2

echo "ESOLANG_WORKER_CODE: $ESOLANG_WORKER_CODE"

echo "=== Testing internet access ==="

aws s3 cp s3://esolang-worker/0123456789/code .

cat code