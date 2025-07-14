#!/bin/bash

# Exit on error
set -e

# Clone the feetech-servo-sdk repo if it doesn't exist
if [ ! -d "feetech-servo-sdk" ]; then
  git clone https://github.com/TengHu/feetech-servo-sdk.git
fi

cd feetech-servo-sdk

# Install requirements (editable mode)
pip install -e .
