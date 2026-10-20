#!/usr/bin/env python3
"""
Download the latest trained parking detection model from GitHub Releases.
AI was used to generate the progress bar, handle model fallback in case of 404 error, 
handle github rate limiting, and fix up formatting issues
"""


import os
import sys
import json
import urllib.request
from pathlib import Path

REPO_OWNER = "EthanT-young"
REPO_NAME = "CS-472-better-parking"
MODEL_FILENAME = "parking_detector.pt"
OUTPUT_PATH = Path("models/parking_detector.pt")

def get_auth_headers():
    """Return headers, including a GitHub token if available in the environment."""
    headers = {"User-Agent": "ParkingModelDownloader/2.0"}
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers

def get_latest_release_url():
    """Get download URL for the latest release asset (including pre-releases)."""
    # First try the standard /latest endpoint
    url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/releases/latest"
    req = urllib.request.Request(url, headers=get_auth_headers())
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            # Fallback: /latest ignores pre-releases. Let's fetch all releases and take the newest.
            print("Latest stable release not found. Checking for pre-releases...")
            all_url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/releases"
            req_all = urllib.request.Request(all_url, headers=get_auth_headers())
            try:
                with urllib.request.urlopen(req_all, timeout=30) as response:
                    all_data = json.loads(response.read().decode())
                    if not all_data:
                        raise FileNotFoundError(f"No releases found in {REPO_OWNER}/{REPO_NAME}")
                    data = all_data[0] # Grab the most recent release
            except urllib.error.HTTPError as e2:
                if e2.code == 404:
                    raise FileNotFoundError(f"Repo {REPO_OWNER}/{REPO_NAME} not found.")
                raise
        elif e.code == 403:
            raise RuntimeError("GitHub API rate limit exceeded. Set the GITHUB_TOKEN environment variable.")
        else:
            raise

    # Find our model file in the release assets
    for asset in data.get("assets", []):
        if asset["name"] == MODEL_FILENAME:
            return asset["browser_download_url"], data.get("tag_name", "unknown")
            
    raise FileNotFoundError(
        f"Model '{MODEL_FILENAME}' not found in release {data.get('tag_name')}. "
        f"Available assets: {[a['name'] for a in data.get('assets', [])]}"
    )

def download_progress(block_num, block_size, total_size):
    """Callback function to print a simple progress bar."""
    if total_size == -1:
        return
    
    downloaded = block_num * block_size
    percent = min(100, int((downloaded / total_size) * 100))
    mb_downloaded = downloaded / (1024 * 1024)
    mb_total = total_size / (1024 * 1024)
    
    # Carriage return '\r' overwrites the current line
    sys.stdout.write(f"\rDownloading... {percent}%  ({mb_downloaded:.1f} MB / {mb_total:.1f} MB)")
    sys.stdout.flush()

def download_model():
    """Download and save the trained model."""
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    print(f"Fetching release info from {REPO_OWNER}/{REPO_NAME}...")
    url, tag = get_latest_release_url()
    
    print(f"Found model in release: {tag}")
    
    try:
        # Pass the custom reporthook to show the progress bar
        urllib.request.urlretrieve(url, str(OUTPUT_PATH), reporthook=download_progress)
        print() # Move to the next line after the progress bar completes
        
        size_mb = OUTPUT_PATH.stat().st_size / (1024 * 1024)
        print(f"✓ Model successfully saved to {OUTPUT_PATH}")
        
    except Exception as e:
        if OUTPUT_PATH.exists():
            OUTPUT_PATH.unlink()
        print() # Ensure the error prints on a new line
        raise RuntimeError(f"Failed to download model: {e}")

if __name__ == "__main__":
    try:
        download_model()
    except Exception as e:
        print(f"\n✗ Error: {e}")
        sys.exit(1)

