#!/bin/bash

# Exit on error
set -e

# Clone the feetech-servo-sdk repo if it doesn't exist
if [ ! -d "backend/custom_nodes/feetech-servo-sdk" ]; then
  git clone https://github.com/TengHu/feetech-servo-sdk.git backend/custom_nodes/feetech-servo-sdk
fi

cd backend/custom_nodes/feetech-servo-sdk

# Install requirements (editable mode)
pip install -e .
