# GeoStories

A geo-mapping application where users can place markers on a map and write stories with photos. Built with **Pubky SDK** and **Leaflet/OpenStreetMap** for map visualization.

## Features

- **Interactive Map**: Click anywhere to place story markers
- **Photo Support**: Upload photos with your stories
- **Public Sharing**: View stories from any Pubky user by entering their public key
- **No Backend**: Fully client-side application using Pubky infrastructure

## Architecture

```
/pub/geostories.app/
  └── markers/
      ├── marker-<timestamp>.json      # Marker metadata
      └── marker-<timestamp>/
          └── photo-<timestamp>.jpg    # Photo data
```

Each marker stores:
- GPS coordinates (latitude, longitude)
- Title and description
- Timestamp
- Author's pubky
- Photo references (if any)

## Prerequisites

1. **Node.js** (v20+) - for npm package management
2. **Rust/Cargo** (optional) - to run local testnet

## Setup

### 1. Install Dependencies

```bash
cd geostories-app
npm install
```

### 2. Start Local Testnet (Recommended for Development)

In a separate terminal, start the Pubky testnet:

```bash
cd ../pubky-core
cargo run -p pubky-testnet
```

This starts a local DHT + homeserver + relay for fully offline development.

### 3. Start Development Server

```bash
npm run dev
```

Open your browser to `http://localhost:3000` (or the port shown in the terminal).

## Usage

### Getting Started

#### Authorize with Existing Pubky Account

1. **Connect**: Click "Connect to Pubky" to initialize the SDK
2. **Authorize**: Click "Authorize (QR)" button
3. **Scan QR Code**: Use Pubky Ring (iOS/Android) or your authenticator app to scan the QR code
   - The app will request permission to write to `/pub/geostories.app/`
   - Approve the request on your authenticator
4. **Start Adding Stories**: Once authorized, you can immediately add markers

**Benefits:**
- No need to run your own homeserver
- Uses your existing Pubky identity
- Secure, keyless authentication
- Works with any Pubky-compatible authenticator

### Adding Stories

1. **Select Location**: Click anywhere on the map to set marker location
2. **Fill Form**:
   - Enter story title
   - Write description
   - Optionally upload a photo
3. **Submit**: Click "Add Story to Map"

### Viewing Others' Stories

1. Copy another user's pubky (public key)
2. Paste it in the "View Another User's Markers" field
3. Click "Load Markers"
4. All their stories will appear on the map and in the sidebar

### Map Interaction

- **Click marker**: Opens popup with story details
- **Click sidebar item**: Centers map on that marker
- **Pan/Zoom**: Navigate the map freely

## Technical Details

### Pubky SDK Integration

**Authentication Flow (Pubky Auth):**
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

**Storage API:**
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

**Discovery:**
```javascript
// List all markers for a user
const files = await pubky.publicStorage.list(
  `pubky<public-key>/pub/geostories.app/markers/`
);
```

### Map Integration

Using **Leaflet.js** with **OpenStreetMap** tiles:

```javascript
const map = L.map('map').setView([37.7749, -122.4194], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
```

## File Structure

```
geostories-app/
├── index.html          # UI layout with Leaflet map
├── app.js              # Main application logic with Pubky integration
├── package.json        # Dependencies and scripts
└── README.md           # This file
```

## Deployment

### Production Considerations

1. **Authentication**: Use Pubky Auth flow (QR code) for production - users authenticate with their existing Pubky accounts
2. **Homeserver**: Users authenticate with their own homeserver - no need to run one yourself
3. **Relay**: For production, consider running your own HTTP relay (the auth flow uses relays)
4. **Photo Limits**: Consider implementing file size limits and image compression
5. **Session Persistence**: Optionally save session tokens to avoid re-auth on each visit

### Hosting

The app is fully static and can be hosted on:
- GitHub Pages
- Netlify
- Vercel
- Any static file server

Just ensure users have access to a Pubky homeserver (testnet for dev, mainnet for prod).

## Troubleshooting

### "Failed to connect"
- Make sure the testnet is running: `cargo run -p pubky-testnet`
- Check that port 15411 (DHT) and 15412 (homeserver) are available

### "Failed to load markers"
- Verify the pubky (public key) is correct and in z32 format
- Ensure the user has actually created markers
- Check browser console for detailed errors

### Photo upload fails
- Check file size (keep under 10MB for best performance)
- Verify browser supports FileReader API
- Check browser console for errors

## Development

### Running Tests

```bash
# Start testnet first
cargo run -p pubky-testnet

# In browser console, test operations
await app.connect()
await app.signup()
```

### Debugging

Open browser DevTools console to see logs:
```
[GeoStories] Map initialized with OpenStreetMap
[GeoStories] Connected to Pubky testnet
[GeoStories] Signed up successfully! Your pubky: 8pinxxgqs...
```

## Future Enhancements

- [ ] Photo galleries (multiple photos per marker)
- [ ] Marker categories/tags
- [ ] Search and filter functionality
- [ ] Photo compression before upload
- [ ] Marker clustering for dense areas
- [ ] Comments/replies on markers
- [ ] Follow specific users
- [ ] Export markers as GeoJSON

## License

MIT

## Resources

- [Pubky Core](https://github.com/pubky/pubky-core)
- [Pubky SDK Docs](https://docs.rs/pubky)
- [Leaflet Documentation](https://leafletjs.com/)
- [OpenStreetMap](https://www.openstreetmap.org/)

## Credits

Built with:
- **Pubky SDK** - Decentralized identity and storage
- **Leaflet** - Interactive map library
- **OpenStreetMap** - Map tiles and data
