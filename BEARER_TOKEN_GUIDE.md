# 🚛 Larry Route Planner - Bearer Token Setup Guide

## Problem: CORS Error & Authentication

You're seeing a CORS error because the Trans.eu API doesn't allow direct requests from localhost. The `efax.com` redirect is unrelated to our app - it's likely a browser popup or unrelated redirect.

## Solution: Extract Bearer Token from platform.trans.eu

### Step 1: Get Your Bearer Token

1. **Open platform.trans.eu** in your browser
2. **Login** to your Trans.eu account
3. **Open Developer Tools** (Press F12)
4. **Go to Network tab** in Dev Tools
5. **Make a search** on the platform (search for any freight offers)
6. **Find API request** in Network tab that goes to `api-platform.trans.eu`
7. **Click on the request** to see details
8. **Copy the Authorization header** - it looks like:
   ```
   Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
9. **Copy only the token part** (everything after "Bearer ")

### Step 2: Use the Token in Larry App

1. **Paste the token** into the "Bearer Token" field in the Larry app
2. **Make sure API URL** is set to: `https://api-platform.trans.eu/app/exchange/api/rest/v2/freight-offers`
3. **Click "Fetch & Optimize Routes"**

## Alternative: Use Chrome Extension (Recommended)

The Chrome extension avoids CORS issues by running directly on platform.trans.eu:

1. **Load the extension** in Chrome (from `larry-route-planner/extension/` folder)
2. **Go to platform.trans.eu** 
3. **Click the 🚛 button** that appears on the page
4. **Use Larry app** directly on the Trans.eu site (no CORS issues!)

## Troubleshooting

### "efax.com" Redirect
- This is **NOT related to our app**
- It's likely a browser popup or unrelated redirect
- Close any popups and focus on the main platform.trans.eu tab

### CORS Error Persists
- Make sure you're using the **full HTTPS URL** for the API
- Consider using the **Chrome extension** instead of localhost
- The bearer token must be **valid and not expired**

### Token Not Working
- Make sure you copied the **complete token** (they're very long)
- Don't include "Bearer " - just the token itself
- The token may **expire** - get a fresh one if needed

## Token Security

⚠️ **Important**: Bearer tokens are sensitive credentials. Don't share them publicly or commit them to version control.