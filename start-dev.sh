#!/usr/bin/env bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# Stop background jobs of this terminal (linux)
if ! [ -x "$(command -v git)" ]; then
    echo 'lsof is not installed, skip killing web server before running.' >&2
    exit 1
else
    lsof -i :5070   | grep node | awk '{ print $2 }'  | xargs kill -s SIGTERM
fi


# Start the server
npm run start:test-ws-bg

# Start the CLI
cd ${SCRIPT_DIR} && npx nodemon