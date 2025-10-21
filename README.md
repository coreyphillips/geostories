<div align="center">

# 🗺️ GeoStories

**Decentralized story mapping powered by Pubky**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Pubky](https://img.shields.io/badge/Built%20with-Pubky-blue)](https://pubky.org)
[![Leaflet](https://img.shields.io/badge/Maps-Leaflet-green)](https://leafletjs.com/)

*Share your stories, pin your memories, explore the world through others' eyes*

[🌐 **Visit geostories.app**](https://geostories.app)

[Features](#-features) • [Quick Start](#-quick-start) • [Usage](#-usage) • [Architecture](#-architecture) • [Contributing](#-future-enhancements)

</div>

---

A fully decentralized geo-mapping application where users can place markers on a map and write stories with photos. Built with **Pubky SDK** for decentralized storage and **Leaflet/OpenStreetMap** for beautiful map visualization.

## ✨ Features

<table>
<tr>
<td width="50%">

### 🎯 Core Features
- 📍 **Interactive Map** - Click anywhere to place story markers
- 📸 **Photo Support** - Upload photos with your stories
- 🔓 **Public Sharing** - View stories from any Pubky user
- 🚫 **No Backend** - Fully client-side decentralized app

</td>
<td width="50%">

### 🔐 Powered by Pubky
- 🆔 **Decentralized Identity** - Own your data
- 🔒 **Secure Auth** - QR code authentication
- 🌐 **Peer-to-Peer** - No central server needed
- ♾️ **Censorship Resistant** - Your stories, forever

</td>
</tr>
</table>

## 🏗️ Architecture

<details>
<summary><b>Data Structure</b> (click to expand)</summary>

```
/pub/geostories.app/
  └── markers/
      ├── marker-<timestamp>.json      # Marker metadata
      └── marker-<timestamp>/
          └── photo-<timestamp>.jpg    # Photo data
```

**Each marker stores:**
- 🌍 GPS coordinates (latitude, longitude)
- 📝 Title and description
- ⏱️ Timestamp
- 👤 Author's pubky
- 🖼️ Photo references (if any)

</details>

## 🚀 Quick Start

### Prerequisites

| Requirement | Version | Purpose |
|------------|---------|---------|
| Node.js | v20+ | Package management |
| Rust/Cargo | Latest | Local testnet (optional) |

### Installation

```bash
# 1️⃣ Install dependencies
cd geostories-app
npm install

# 2️⃣ Start local testnet (optional, for development)
# In a separate terminal:
cd ../pubky-core
cargo run -p pubky-testnet

# 3️⃣ Start the app
npm run dev
```

🎉 Open your browser to `http://localhost:3000` and start exploring!

## 📖 Usage

### 🔐 Getting Started

<table>
<tr>
<td width="60">1️⃣</td>
<td><b>Connect</b><br/>Click "Connect to Pubky" to initialize the SDK</td>
</tr>
<tr>
<td>2️⃣</td>
<td><b>Authorize</b><br/>Click "Authorize (QR)" button and scan with Pubky Ring app</td>
</tr>
<tr>
<td>3️⃣</td>
<td><b>Start Creating</b><br/>Click on the map to place markers and share your stories!</td>
</tr>
</table>

> **Why Pubky Auth?**
> - ✅ No need to run your own homeserver
> - ✅ Uses your existing Pubky identity
> - ✅ Secure, keyless authentication
> - ✅ Works with any Pubky-compatible authenticator

---

### 📝 Adding Stories

1. **📍 Select Location** - Click anywhere on the map to set marker location
2. **✍️ Fill Form** - Enter title, description, and optionally upload a photo
3. **🚀 Submit** - Click "Add Story to Map"

### 👥 Viewing Others' Stories

1. Copy another user's pubky (public key)
2. Paste it in the "View Another User's Markers" field
3. Click "Load Markers"
4. Explore their stories on the map!

### 🗺️ Map Interaction

| Action | Result |
|--------|--------|
| Click marker | Opens popup with story details |
| Click sidebar item | Centers map on that marker |
| Pan/Zoom | Navigate the map freely |

## 🔧 Technical Details

<details>
<summary><b>Pubky SDK Integration</b></summary>

### Authentication Flow

```javascript
// Request write permissions for geostories path
const caps = Capabilities.builder()
    .readWrite('/pub/geostories.app/')
    .finish();

// Start auth flow (generates QR code URL)
const authFlow = pubky.startAuthFlow(caps);
const authUrl = authFlow.authorizationUrl();

// Wait for user approval from their authenticator app
const session = await authFlow.awaitApproval();
```

### Storage API

```javascript
// Write marker metadata (JSON)
await session.storage.putJson(
  '/pub/geostories.app/markers/marker-123.json',
  markerData
);

// Write photo (binary)
await session.storage.putBytes(
  '/pub/geostories.app/markers/marker-123/photo.jpg',
  photoBytes
);

// Read public data from any user
const marker = await pubky.publicStorage.getJson(
  `pubky<public-key>/pub/geostories.app/markers/marker-123.json`
);
```

### Discovery

```javascript
// List all markers for a user
const files = await pubky.publicStorage.list(
  `pubky<public-key>/pub/geostories.app/markers/`
);
```

</details>

<details>
<summary><b>Map Integration</b></summary>

Using **Leaflet.js** with **OpenStreetMap** tiles:

```javascript
const map = L.map('map').setView([37.7749, -122.4194], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
```

</details>

## 📁 File Structure

```
geostories-app/
├── 📄 index.html          # UI layout with Leaflet map
├── 📜 app.js              # Main application logic with Pubky integration
├── 📦 package.json        # Dependencies and scripts
└── 📖 README.md           # This file
```

## 🚢 Deployment

### Production Considerations

| Aspect | Recommendation |
|--------|---------------|
| 🔐 **Authentication** | Use Pubky Auth flow (QR code) - users authenticate with their existing accounts |
| 🏠 **Homeserver** | Users authenticate with their own homeserver - no need to run one yourself |
| 🔄 **Relay** | Consider running your own HTTP relay for the auth flow |
| 📸 **Photo Limits** | Implement file size limits and image compression |
| 💾 **Session Persistence** | Optionally save session tokens to avoid re-auth on each visit |

### Hosting Options

The app is **fully static** and can be hosted on:

<table>
<tr>
<td align="center">🐙<br/><b>GitHub Pages</b></td>
<td align="center">⚡<br/><b>Netlify</b></td>
<td align="center">▲<br/><b>Vercel</b></td>
<td align="center">🌐<br/><b>Any static host</b></td>
</tr>
</table>

> Just ensure users have access to a Pubky homeserver (testnet for dev, mainnet for prod)

## 🔍 Troubleshooting

<details>
<summary><b>"Failed to connect"</b></summary>

- ✅ Make sure the testnet is running: `cargo run -p pubky-testnet`
- ✅ Check that port 15411 (DHT) and 15412 (homeserver) are available
- ✅ Try restarting the development server

</details>

<details>
<summary><b>"Failed to load markers"</b></summary>

- ✅ Verify the pubky (public key) is correct and in z32 format
- ✅ Ensure the user has actually created markers
- ✅ Check browser console for detailed errors
- ✅ Try refreshing the page

</details>

<details>
<summary><b>Photo upload fails</b></summary>

- ✅ Check file size (keep under 10MB for best performance)
- ✅ Verify browser supports FileReader API
- ✅ Check browser console for errors
- ✅ Try a different image format (JPEG, PNG)

</details>

## 🛠️ Development

<details>
<summary><b>Running Tests</b></summary>

```bash
# Start testnet first
cargo run -p pubky-testnet

# In browser console, test operations
await app.connect()
await app.signup()
```

</details>

<details>
<summary><b>Debugging</b></summary>

Open browser DevTools console to see logs:

```
[GeoStories] Map initialized with OpenStreetMap
[GeoStories] Connected to Pubky testnet
[GeoStories] Signed up successfully! Your pubky: 8pinxxgqs...
```

</details>

## 🚀 Future Enhancements

<table>
<tr>
<td width="50%">

### 🎨 Features
- [ ] 🖼️ Photo galleries (multiple photos per marker)
- [ ] 🏷️ Marker categories/tags
- [ ] 🔍 Search and filter functionality
- [ ] 💬 Comments/replies on markers

</td>
<td width="50%">

### ⚡ Performance
- [ ] 📦 Photo compression before upload
- [ ] 🗂️ Marker clustering for dense areas
- [ ] 👥 Follow specific users
- [ ] 📥 Export markers as GeoJSON

</td>
</tr>
</table>

---

## 📚 Resources

<table>
<tr>
<td align="center">
<b>🔗 Pubky Core</b><br/>
<a href="https://github.com/pubky/pubky-core">GitHub Repository</a>
</td>
<td align="center">
<b>📖 Pubky SDK Docs</b><br/>
<a href="https://docs.rs/pubky">Documentation</a>
</td>
<td align="center">
<b>🗺️ Leaflet</b><br/>
<a href="https://leafletjs.com/">Documentation</a>
</td>
<td align="center">
<b>🌍 OpenStreetMap</b><br/>
<a href="https://www.openstreetmap.org/">Website</a>
</td>
</tr>
</table>

## 🙏 Credits

Built with love using:

| Technology | Purpose |
|-----------|---------|
| **Pubky SDK** | Decentralized identity and storage |
| **Leaflet** | Interactive map library |
| **OpenStreetMap** | Map tiles and data |

---

<div align="center">

## 📜 License

**MIT License**

Made with ❤️ by the GeoStories team

[⬆ Back to Top](#-geostories)

</div>
