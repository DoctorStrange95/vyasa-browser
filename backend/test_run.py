#!/usr/bin/env python
"""Minimal test to start the backend without database."""

import os
import sys

# Add backend to path
sys.path.insert(0, '/Users/doctor_strange/Desktop/research browser')

# Set test database URL (use SQLite for testing)
os.environ['DATABASE_URL'] = 'sqlite+aiosqlite:///:memory:'

# Try to start the app
from backend.app.main import app
from fastapi import FastAPI
import uvicorn

if __name__ == "__main__":
    print("Starting backend server...")
    uvicorn.run(app, host="127.0.0.1", port=8000)
