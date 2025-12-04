#!/bin/bash
# Script to create deployment package for Lambda

# Create a temporary directory
mkdir -p package

# Install dependencies
pip install -r requirements.txt -t package/

# Copy application code
cp *.py package/

# Create zip file
cd package
zip -r ../deployment-package.zip .
cd ..

# Clean up
rm -rf package

echo "Deployment package created: deployment-package.zip"
