#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "=== Installing Python Dependencies ==="
pip install --upgrade pip
pip install -r requirements.txt

echo "=== Collecting Static Files ==="
python manage.py collectstatic --noinput

echo "=== Build Completed Successfully ==="
