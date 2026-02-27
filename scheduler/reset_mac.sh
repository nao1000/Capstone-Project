#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "Deleting database..."
# -f ignores errors if the file doesn't exist
rm -f db.sqlite3

echo "Deleting migration files..."
# Deletes all .py files starting with 0 in the specific directory
# We exclude __init__.py automatically by targeting 0*.py
find scheduler/core/migrations -name "0*.py" -delete

echo "Running makemigrations..."
python3 manage.py makemigrations core

echo "Running migrate..."
python3 manage.py migrate

echo "Creating superuser..."
python3 manage.py createsuperuser

echo "Creating test users..."
python3 create_test_users.py

echo "Done!"