#!/bin/bash

ARGS="--file $1 --base-branch $2"

if [ "$3" = "true" ]; then
    ARGS="$ARGS --create-pr"
fi

if [ "$4" = "true" ]; then
    ARGS="$ARGS --allow-major"
fi

if [ "$5" = "true" ]; then
    ARGS="$ARGS --no-security"
fi

echo "Running with args: $ARGS"
exec python /app/dep_updater.py $ARGS
