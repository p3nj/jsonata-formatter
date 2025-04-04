#!/bin/bash

# Navigate to the public directory
cd public

# Deploy to Surge.sh
surge . jsonataformatter.surge.sh

# Navigate back to the root directory
cd ..