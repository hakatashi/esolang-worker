#!/bin/sh

set -e

execution_id=$ESOLANG_WORKER_EXECUTION_ID

echo "=== Downloading code and stdin ==="

aws s3 cp s3://esolang-worker/$execution_id/code /tmp/code
aws s3 cp s3://esolang-worker/$execution_id/stdin /tmp/stdin

echo "=== Running script ==="

script /tmp/code < /tmp/stdin > /tmp/stdout 2> /tmp/stderr

echo "=== Finished Running script ==="

aws s3 cp /tmp/stdout s3://esolang-worker/$execution_id/stdout
aws s3 cp /tmp/stderr s3://esolang-worker/$execution_id/stderr
