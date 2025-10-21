import { Pubky, Keypair, PublicKey, setLogLevel } from '@synonymdev/pubky';

class GeoStoriesApp {
    constructor() {
        this.pubky = null;
        this.session = null;
        this.signer = null;
        this.authFlow = null;
        this.map = null;
        this.markers = new Map(); // Store markers by ID
        this.markerLayers = new Map(); // Store Leaflet marker layers
        this.currentMarkerLocation = null;
        this.currentPubky = null; // Currently viewing pubky
        this.authMode = 'qr'; // 'qr' for Pubky Auth, 'local' for testnet signup
        this.editingMarkerId = null; // Track which marker is being edited
        this.friendsWithMarkers = []; // Cache of friends with GeoStory markers
        this.friendColorMap = new Map(); // Map friend pubkeys to colors

        // Color palette for friends (vibrant, distinguishable colors)
        this.friendColors = [
            '#A29BFE', // Lavender
            '#4ECDC4', // Teal
            '#45B7D1', // Blue
            '#FFA07A', // Light Salmon
            '#98D8C8', // Mint
            '#F7B731', // Yellow
            '#5F27CD', // Purple
            '#00D2D3', // Cyan
            '#FF9FF3', // Pink
            '#54A0FF', // Light Blue
            '#48DBFB', // Sky Blue
            '#1DD1A1', // Green
            '#F368E0', // Magenta
            '#FF9F43', // Orange
            '#00B894', // Emerald
            '#6C5CE7', // Indigo
            '#FD79A8', // Rose
            '#FDCB6E', // Mustard
            '#74B9FF', // Periwinkle
            '#FF6B6B', // Red
        ];

        this.initMap();
        this.initResizableSidebar();
        this.connect(); // Auto-connect on page load
    }

    // Get color for a friend
    getFriendColor(pubkey) {
        if (!this.friendColorMap.has(pubkey)) {
            const colorIndex = this.friendColorMap.size % this.friendColors.length;
            this.friendColorMap.set(pubkey, this.friendColors[colorIndex]);
        }
        return this.friendColorMap.get(pubkey);
    }

    // Initialize resizable sidebar
    initResizableSidebar() {
        const sidebar = document.getElementById('sidebar');
        const resizeHandle = document.getElementById('resizeHandle');
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = sidebar.offsetWidth;
            resizeHandle.classList.add('dragging');
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const width = startWidth + (e.clientX - startX);
            const minWidth = parseInt(getComputedStyle(sidebar).minWidth);
            const maxWidth = parseInt(getComputedStyle(sidebar).maxWidth);

            if (width >= minWidth && width <= maxWidth) {
                sidebar.style.width = width + 'px';
                // Trigger map resize
                setTimeout(() => this.map.invalidateSize(), 0);
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                resizeHandle.classList.remove('dragging');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }

    // Load markers from header search
    loadUserMarkersFromHeader() {
        const pubky = document.getElementById('pubkyInputHeader').value.trim();
        if (pubky) {
            this.loadUserMarkers(pubky);
        } else {
            this.showError('Please enter a pubky');
        }
    }

    // Initialize Leaflet map
    initMap() {
        // Create map centered on New Orleans, LA
        this.map = L.map('map').setView([29.9511, -90.0715], 13);

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(this.map);

        // Add geocoder control with collapsible UI
        const self = this;
        const geocoder = L.Control.geocoder({
            defaultMarkGeocode: false,
            placeholder: 'Search location...',
            errorMessage: 'Location not found',
            position: 'topright',
            collapsed: true,  // Start collapsed with just the icon
            expand: 'touch'   // Expand on click
        })
        .on('markgeocode', function(e) {
            const latlng = e.geocode.center;
            self.map.setView(latlng, 16);
            // Set marker location when searching
            self.setMarkerLocation(latlng.lat, latlng.lng);
            self.log(`Location found: ${e.geocode.name}`);
        })
        .addTo(this.map);

        // Store geocoder reference
        this.geocoder = geocoder;

        // Click handler to place marker
        this.map.on('click', (e) => {
            this.setMarkerLocation(e.latlng.lat, e.latlng.lng);
        });

        this.log('Map initialized with OpenStreetMap and geocoder');
    }

    // Set marker location from map click
    setMarkerLocation(lat, lng) {
        document.getElementById('latitude').value = lat.toFixed(6);
        document.getElementById('longitude').value = lng.toFixed(6);

        // Remove temporary marker if exists
        if (this.tempMarker) {
            this.map.removeLayer(this.tempMarker);
        }

        // Add temporary marker
        this.tempMarker = L.marker([lat, lng], {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })
        }).addTo(this.map);

        this.currentMarkerLocation = { lat, lng };
        this.log(`Location selected: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }

    // Connect to Pubky
    async connect() {
        try {
            this.updateStatus('Connecting to Pubky...', 'connected');

            // Initialize Pubky in mainnet mode (for production)
            // For testnet, use: this.pubky = Pubky.testnet();
            this.pubky = new Pubky();

            // Enable debug logging
            try {
                setLogLevel('debug');
                this.log('Debug logging enabled');
            } catch (err) {
                console.warn('Could not enable debug logging:', err);
            }

            this.updateStatus('Connected - Click "Authorize with QR Code" to sign in', 'testnet');
            this.log('Connected to Pubky');

            // Show auth button, keep connect button hidden
            document.getElementById('authBtnContainer').classList.remove('hidden');
        } catch (error) {
            this.showError('Failed to connect: ' + error.message);
            console.error(error);
        }
    }

    // Start Pubky Auth flow (QR/deeplink for existing users)
    async startAuthFlow() {
        try {
            this.updateStatus('Starting authentication flow...', 'testnet');

            // Request write permissions for geostories path
            // Capabilities are passed as a string in the format: "/path/:permissions"
            // :rw = read/write, :r = read only
            const caps = '/pub/geostories.app/:rw';

            this.log('Requesting capabilities: ' + caps);
            this.log('Capabilities string length: ' + caps.length);

            // Note: We're using mainnet mode
            this.log('Using mainnet mode - connecting to production Pubky network');

            // Start auth flow (mainnet uses default relay)
            this.authFlow = this.pubky.startAuthFlow(caps);

            const authUrl = this.authFlow.authorizationUrl;
            this.log(`Authorization URL: ${authUrl}`);

            // Show QR code and deeplink
            this.showAuthUI(authUrl);

            this.updateStatus('Waiting for approval...', 'testnet');

            // Wait for user to approve (on their authenticator app like Pubky Ring)
            try {
                this.session = await this.authFlow.awaitApproval();

                // Get session info (it's a property, not a method)
                this.currentPubky = this.session.info.publicKey.z32();

                this.updateStatus(`Authenticated as: ${this.currentPubky.substring(0, 16)}...`, 'connected');
                this.log(`Authentication approved! Your pubky: ${this.currentPubky}`);
                this.log(`Session has storage access: ${this.session.storage ? 'yes' : 'no'}`);
                this.log(`Session info object: ${JSON.stringify(this.session.info, null, 2)}`);
                this.log(`Session capabilities: ${this.session.info.capabilities ? this.session.info.capabilities.join(', ') : 'UNDEFINED'}`);
                this.log(`Session capabilities type: ${typeof this.session.info.capabilities}`);
                this.log(`Session capabilities is array: ${Array.isArray(this.session.info.capabilities)}`);

                // Check if session has the required capabilities
                // Note: Even if capabilities array is empty, if we have session.storage, we should be able to write
                if (!this.session.storage) {
                    this.hideAuthUI();
                    this.showError('Authentication succeeded but the session has no storage access. This may be a limitation of the current homeserver or your authenticator app. Please try again or contact support.');
                    return;
                }

                if (!this.session.info.capabilities || this.session.info.capabilities.length === 0) {
                    this.log('WARNING: Session capabilities array is empty or undefined, but storage object exists. Proceeding with authentication...');
                }

                this.hideAuthUI();
                this.onAuthenticated();
            } catch (error) {
                this.hideAuthUI();

                // Check if it's a missing homeserver error
                if (error.message && error.message.includes('No HTTPS endpoints found')) {
                    this.showError('Your Pubky account doesn\'t have a homeserver configured yet. Please configure your homeserver in Pubky Ring or your authenticator app before trying to authorize.');
                } else {
                    throw error;
                }
            }
        } catch (error) {
            this.showError('Authentication failed: ' + error.message);
            console.error(error);
        }
    }


    // Called after successful authentication
    onAuthenticated() {
        // Hide auth button, enable submit button
        document.getElementById('authBtnContainer').classList.add('hidden');
        document.getElementById('submitBtn').disabled = false;
        document.getElementById('pubkyInputHeader').value = this.currentPubky;

        // Show friends button and load friends
        document.getElementById('friendsBtn').classList.remove('hidden');
        this.loadFriendsWithMarkers();

        // Automatically load user's markers
        this.loadUserMarkers(this.currentPubky);
    }

    // Fetch followed users from Pubky
    async getFollowedUsers() {
        if (!this.currentPubky) {
            return [];
        }

        try {
            const followsPath = `pubky://${this.currentPubky}/pub/pubky.app/follows/`;
            this.log(`Fetching follows from: ${followsPath}`);

            // List all follow files
            const followFiles = await this.pubky.publicStorage.list(followsPath);
            this.log(`Found ${followFiles.length} follow files`);

            const followedUsers = [];

            for (const followFile of followFiles) {
                try {
                    // Extract pubky from follow file URL
                    // Follow files are typically at: pubky://{user}/pub/pubky.app/follows/{followed_pubky}
                    const parts = followFile.split('/');
                    const followedPubky = parts[parts.length - 1];

                    if (followedPubky && followedPubky.length > 0) {
                        followedUsers.push(followedPubky);
                        this.log(`Found followed user: ${followedPubky}`);
                    }
                } catch (err) {
                    this.log(`Failed to parse follow file: ${followFile}`);
                }
            }

            return followedUsers;
        } catch (error) {
            this.log(`Error fetching followed users: ${error.message}`);
            return [];
        }
    }

    // Get user profile information
    async getProfileInfo(pubky) {
        try {
            const profileUrl = `pubky://${pubky}/pub/pubky.app/profile.json`;
            const profileData = await this.pubky.publicStorage.getJson(profileUrl);

            return {
                name: profileData.name || null,
                bio: profileData.bio || null,
                image: profileData.image || null,
                links: profileData.links || []
            };
        } catch (error) {
            this.log(`Could not fetch profile for ${pubky}: ${error.message}`);
            return {
                name: null,
                bio: null,
                image: null,
                links: []
            };
        }
    }

    // Check if a user has GeoStory markers
    async checkUserHasMarkers(pubky) {
        try {
            const markersPath = `pubky://${pubky}/pub/geostories.app/markers/`;
            const files = await this.pubky.publicStorage.list(markersPath);
            const markerFiles = files.filter(f => f.endsWith('.json'));
            return markerFiles.length;
        } catch (error) {
            return 0;
        }
    }

    // Load friends who have GeoStory markers
    async loadFriendsWithMarkers() {
        try {
            this.log('Loading friends with GeoStory markers...');

            const followedUsers = await this.getFollowedUsers();
            this.log(`Checking ${followedUsers.length} followed users for markers...`);

            const friendsWithMarkers = [];

            // Check each followed user for markers and fetch their profile
            for (const pubky of followedUsers) {
                const markerCount = await this.checkUserHasMarkers(pubky);
                if (markerCount > 0) {
                    // Fetch profile information
                    const profile = await this.getProfileInfo(pubky);

                    friendsWithMarkers.push({
                        pubky: pubky,
                        markerCount: markerCount,
                        name: profile.name || pubky.substring(0, 16) + '...', // Use profile name or shortened pubky
                        bio: profile.bio,
                        image: profile.image
                    });
                    this.log(`Friend ${profile.name || pubky} has ${markerCount} markers`);
                }
            }

            this.friendsWithMarkers = friendsWithMarkers;

            // Update button text
            document.getElementById('friendsBtn').textContent = `View Friends (${friendsWithMarkers.length})`;

            this.log(`Found ${friendsWithMarkers.length} friends with GeoStory markers`);
        } catch (error) {
            this.log(`Error loading friends: ${error.message}`);
            console.error(error);
        }
    }

    // Show friends modal
    showFriendsModal() {
        const modal = document.getElementById('friendsModal');
        const container = document.getElementById('friendsListContainer');

        if (this.friendsWithMarkers.length === 0) {
            container.innerHTML = '<div class="no-friends">No friends with GeoStories found. Follow users on Pubky to see their stories here!</div>';
        } else {
            // Assign colors to friends
            this.friendsWithMarkers.forEach(friend => {
                this.getFriendColor(friend.pubky);
            });

            container.innerHTML = `
                <button class="show-all-btn" onclick="app.showAllFriendsMarkers()">
                    Show All Friends on Map (${this.friendsWithMarkers.length})
                </button>
                <ul class="friends-list">
                    ${this.friendsWithMarkers.map(friend => {
                        const color = this.getFriendColor(friend.pubky);
                        const avatarHtml = friend.image
                            ? `<img src="${friend.image}" alt="${friend.name}" class="friend-avatar" onerror="this.style.display='none'">`
                            : '';
                        const bioHtml = friend.bio
                            ? `<div class="friend-bio">${friend.bio}</div>`
                            : '';

                        return `
                            <li class="friend-item" onclick="app.loadFriendMarkers('${friend.pubky}')">
                                <span class="friend-legend" style="background-color: ${color};"></span>
                                ${avatarHtml}
                                <div class="friend-info">
                                    <div class="friend-name">${friend.name}</div>
                                    ${bioHtml}
                                    <div class="friend-pubkey">${friend.pubky}</div>
                                </div>
                                <div class="friend-markers">${friend.markerCount} marker${friend.markerCount !== 1 ? 's' : ''}</div>
                            </li>
                        `;
                    }).join('')}
                </ul>
            `;
        }

        modal.classList.add('active');
    }

    // Close friends modal
    closeFriendsModal() {
        const modal = document.getElementById('friendsModal');
        modal.classList.remove('active');
    }

    // Load markers for a specific friend
    loadFriendMarkers(pubky) {
        this.closeFriendsModal();
        document.getElementById('pubkyInputHeader').value = pubky;
        this.loadUserMarkers(pubky);
    }

    // Highlight a friend in the legend
    highlightFriend(pubkey) {
        // Remove all previous highlights
        document.querySelectorAll('.friend-legend-item').forEach(item => {
            item.style.background = '';
            item.style.transform = '';
            item.style.boxShadow = '';
        });

        // Highlight the selected friend
        const friendId = 'friend-legend-' + pubkey.replace(/[^a-zA-Z0-9]/g, '');
        const friendElement = document.getElementById(friendId);
        if (friendElement) {
            friendElement.style.background = 'linear-gradient(135deg, #f8f9ff 0%, #f0f0ff 100%)';
            friendElement.style.transform = 'translateX(4px)';
            friendElement.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.2)';

            // Scroll to the friend in the list
            friendElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    // Focus on a friend (zoom to their markers)
    focusOnFriend(pubkey) {
        const friendMarkers = [];

        // Find all markers belonging to this friend
        this.markers.forEach((marker, id) => {
            if (marker.author === pubkey) {
                friendMarkers.push([marker.latitude, marker.longitude]);
            }
        });

        if (friendMarkers.length > 0) {
            // Zoom to fit all of this friend's markers
            const bounds = L.latLngBounds(friendMarkers);
            this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });

            // Highlight this friend
            this.highlightFriend(pubkey);
        }
    }

    // Show all friends' markers on the map with different colors
    async showAllFriendsMarkers() {
        this.closeFriendsModal();

        try {
            this.updateStatus('Loading all friends\' markers...', 'testnet');

            // Clear existing markers
            this.clearMapMarkers();

            let totalMarkers = 0;
            const allBounds = [];

            // Load markers for each friend
            for (const friend of this.friendsWithMarkers) {
                const color = this.getFriendColor(friend.pubky);
                this.log(`Loading markers for ${friend.name} with color ${color}`);

                try {
                    const markerPath = `pubky://${friend.pubky}/pub/geostories.app/markers/`;
                    const files = await this.pubky.publicStorage.list(markerPath);
                    const jsonFiles = files.filter(f => f.endsWith('.json'));

                    for (const file of jsonFiles) {
                        try {
                            const marker = await this.pubky.publicStorage.getJson(file);
                            this.addMarkerToMap(marker, color);
                            allBounds.push([marker.latitude, marker.longitude]);
                            totalMarkers++;
                        } catch (err) {
                            console.warn(`Failed to load marker: ${file}`, err);
                        }
                    }
                } catch (err) {
                    console.warn(`Failed to load markers for ${friend.name}`, err);
                }
            }

            // Fit map to show all markers
            if (allBounds.length > 0) {
                const bounds = L.latLngBounds(allBounds);
                this.map.fitBounds(bounds, { padding: [50, 50] });
            }

            this.updateStatus(`Loaded ${totalMarkers} markers from ${this.friendsWithMarkers.length} friends`, 'connected', true);
            this.log(`Loaded ${totalMarkers} total markers from all friends`);

            // Update marker list to show friend legend
            document.getElementById('markerList').innerHTML = `
                <div style="text-align: center; padding: 1rem; background: linear-gradient(135deg, #f8f9ff 0%, #f0f0ff 100%); border-radius: 8px; margin-bottom: 1rem;">
                    <strong>Viewing ${totalMarkers} markers from ${this.friendsWithMarkers.length} friends</strong>
                </div>
                <div style="margin-bottom: 1rem;">
                    <h3 style="font-size: 0.9rem; color: #666; margin-bottom: 0.8rem; font-weight: 600;">Friends Legend:</h3>
                    <ul class="friends-list" style="max-height: none;">
                        ${this.friendsWithMarkers.map(friend => {
                            const color = this.getFriendColor(friend.pubky);
                            return `
                                <li class="friend-item friend-legend-item" id="friend-legend-${friend.pubky.replace(/[^a-zA-Z0-9]/g, '')}"
                                    onclick="app.focusOnFriend('${friend.pubky}')"
                                    style="padding: 0.8rem; margin-bottom: 0.6rem; cursor: pointer;">
                                    <span class="friend-legend" style="background-color: ${color};"></span>
                                    <div class="friend-info" style="flex: 1; min-width: 0;">
                                        <div class="friend-name" style="font-size: 0.9rem;">${friend.name}</div>
                                        <div style="font-size: 0.75rem; color: #999;">${friend.markerCount} marker${friend.markerCount !== 1 ? 's' : ''}</div>
                                    </div>
                                </li>
                            `;
                        }).join('')}
                    </ul>
                </div>
            `;
        } catch (error) {
            this.showError('Failed to load friends\' markers: ' + error.message);
            console.error(error);
        }
    }

    // Show QR code and deeplink UI
    showAuthUI(authUrl) {
        const qrContainer = document.getElementById('qrContainer');
        const qrCodeDiv = document.getElementById('qrCode');
        const deeplinkEl = document.getElementById('deeplink');

        // Show container and deeplink immediately
        deeplinkEl.textContent = authUrl;
        deeplinkEl.href = authUrl;
        qrContainer.style.display = 'block';

        // Clear any existing QR code
        qrCodeDiv.innerHTML = '';

        // Generate QR code using QRCode.js
        try {
            if (typeof QRCode !== 'undefined') {
                new QRCode(qrCodeDiv, {
                    text: authUrl,
                    width: 250,
                    height: 250,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.H
                });
                this.log('QR code displayed - scan with authenticator app');
            } else {
                console.error('QRCode library not loaded');
            }
        } catch (err) {
            console.error('QR code generation error:', err);
        }
    }

    // Hide QR code UI
    hideAuthUI() {
        document.getElementById('qrContainer').style.display = 'none';
    }

    // Add a new marker/story
    async addMarker(event) {
        event.preventDefault();

        if (!this.session) {
            this.showError('Please authorize first using the QR code');
            return;
        }

        if (!this.currentMarkerLocation) {
            this.showError('Please click on the map to select a location');
            return;
        }

        try {
            const title = document.getElementById('title').value;
            const description = document.getElementById('description').value;
            const photoFile = document.getElementById('photo').files[0];

            // Check if we're editing an existing marker
            if (this.editingMarkerId) {
                await this.updateMarker(this.editingMarkerId, title, description, photoFile);
                return;
            }

            this.updateStatus('Saving your story...', 'testnet');

            // Generate unique marker ID
            const markerId = `marker-${Date.now()}`;
            const photoFilename = photoFile ? `photo-${Date.now()}.jpg` : null;

            // Create marker object
            const marker = {
                id: markerId,
                latitude: this.currentMarkerLocation.lat,
                longitude: this.currentMarkerLocation.lng,
                title: title,
                description: description,
                timestamp: Date.now(),
                photos: photoFilename ? [photoFilename] : [],
                author: this.currentPubky
            };

            // Save marker metadata
            this.log(`Attempting to save marker to: /pub/geostories.app/markers/${markerId}.json`);
            this.log(`Using session for user: ${this.currentPubky}`);

            try {
                await this.session.storage.putJson(
                    `/pub/geostories.app/markers/${markerId}.json`,
                    marker
                );
                this.log(`Marker metadata saved: ${markerId}`);
            } catch (storageError) {
                this.log(`Storage error details: ${JSON.stringify(storageError)}`);
                this.log(`Error name: ${storageError.name}, message: ${storageError.message}`);
                if (storageError.data) {
                    this.log(`Error data: ${JSON.stringify(storageError.data)}`);
                }
                throw storageError;
            }

            // Upload photo if provided
            if (photoFile) {
                const photoBytes = await this.fileToUint8Array(photoFile);
                await this.session.storage.putBytes(
                    `/pub/geostories.app/markers/${markerId}/${photoFilename}`,
                    photoBytes
                );
                this.log(`Photo uploaded: ${photoFilename}`);
            }

            this.updateStatus('Story saved successfully!', 'connected');
            this.showSuccess('Your story has been added to the map!');

            // Add marker to map
            this.addMarkerToMap(marker);

            // Reset form
            document.getElementById('markerForm').reset();
            document.getElementById('photoPreview').style.display = 'none';
            if (this.tempMarker) {
                this.map.removeLayer(this.tempMarker);
            }
            this.currentMarkerLocation = null;

            // Switch to view tab
            this.switchTab('view');
        } catch (error) {
            this.showError('Failed to save story: ' + error.message);
            console.error(error);
        }
    }

    // Load markers for a specific user
    async loadUserMarkers(pubky = null) {
        const targetPubky = pubky || document.getElementById('pubkyInput').value.trim();

        if (!targetPubky) {
            this.showError('Please enter a pubky to view their markers');
            return;
        }

        try {
            this.updateStatus(`Loading markers for ${targetPubky.substring(0, 16)}...`, 'testnet');
            document.getElementById('markerList').innerHTML = '<div class="loading">Loading markers...</div>';

            // Clear existing markers from map
            this.clearMapMarkers();

            // List all marker files
            const markerPath = `pubky${targetPubky}/pub/geostories.app/markers/`;
            const files = await this.pubky.publicStorage.list(markerPath);

            const jsonFiles = files.filter(f => f.endsWith('.json'));

            if (jsonFiles.length === 0) {
                document.getElementById('markerList').innerHTML = '<div class="loading">No markers found for this user.</div>';
                this.updateStatus('No markers found', 'testnet');
                return;
            }

            this.log(`Found ${jsonFiles.length} markers`);

            // Load each marker
            const markers = [];
            for (const file of jsonFiles) {
                try {
                    const marker = await this.pubky.publicStorage.getJson(file);
                    markers.push(marker);
                    this.addMarkerToMap(marker);
                } catch (err) {
                    console.warn(`Failed to load marker: ${file}`, err);
                }
            }

            this.displayMarkerList(markers);
            this.updateStatus(`Loaded ${markers.length} marker${markers.length !== 1 ? 's' : ''}`, 'connected', true);

            // Fit map to show all markers
            if (markers.length > 0) {
                const bounds = L.latLngBounds(markers.map(m => [m.latitude, m.longitude]));
                this.map.fitBounds(bounds, { padding: [50, 50] });
            }
        } catch (error) {
            this.showError('Failed to load markers: ' + error.message);
            console.error(error);
            document.getElementById('markerList').innerHTML = '<div class="error">Failed to load markers</div>';
        }
    }

    // Add marker to Leaflet map with optional custom color
    addMarkerToMap(marker, customColor = null) {
        // Determine marker color
        let iconUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png';

        if (customColor) {
            // Use colored marker - map hex colors to available marker colors
            const colorMapping = {
                '#FF6B6B': 'red',
                '#4ECDC4': 'green',
                '#45B7D1': 'blue',
                '#FFA07A': 'orange',
                '#98D8C8': 'green',
                '#F7B731': 'yellow',
                '#5F27CD': 'violet',
                '#00D2D3': 'blue',
                '#FF9FF3': 'red',
                '#54A0FF': 'blue',
                '#48DBFB': 'blue',
                '#1DD1A1': 'green',
                '#F368E0': 'red',
                '#FF9F43': 'orange',
                '#00B894': 'green',
                '#6C5CE7': 'violet',
                '#FD79A8': 'red',
                '#FDCB6E': 'yellow',
                '#74B9FF': 'blue',
                '#A29BFE': 'violet'
            };

            const markerColor = colorMapping[customColor] || 'blue';
            iconUrl = `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${markerColor}.png`;
        }

        // Create marker icon
        const markerLayer = L.marker([marker.latitude, marker.longitude], {
            icon: L.icon({
                iconUrl: iconUrl,
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })
        }).addTo(this.map);

        // Check if current user owns this marker
        const isOwned = this.currentPubky && marker.author === this.currentPubky;

        // Get friend info if this is a friend's marker
        const friend = this.friendsWithMarkers.find(f => f.pubky === marker.author);
        const authorName = friend ? friend.name : (marker.author === this.currentPubky ? 'You' : marker.author.substring(0, 16) + '...');
        const colorIndicator = customColor ? `<span class="friend-legend" style="background-color: ${customColor}; margin-left: 0.5rem;"></span>` : '';

        // Create popup content with optional edit/delete buttons
        const actionsHtml = isOwned ? `
            <div class="popup-actions">
                <button class="edit-btn" onclick="app.editMarker('${marker.id}')">Edit</button>
                <button class="delete-btn" onclick="app.deleteMarker('${marker.id}')">Delete</button>
            </div>
        ` : '';

        const popupContent = `
            <div style="max-width: 200px;">
                <h3 style="margin: 0 0 0.5rem 0; font-size: 1rem;">${marker.title}</h3>
                <p style="margin: 0 0 0.5rem 0; font-size: 0.85rem;">${marker.description}</p>
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem;">
                    <small style="color: #667eea; font-size: 0.75rem; font-weight: 600;">
                        ${authorName}
                    </small>
                    ${colorIndicator}
                </div>
                <small style="color: #666; font-size: 0.75rem;">
                    ${new Date(marker.timestamp).toLocaleDateString()}
                </small>
                ${actionsHtml}
            </div>
        `;

        markerLayer.bindPopup(popupContent);

        // Add click handler to highlight friend in legend
        if (friend) {
            markerLayer.on('click', () => {
                this.highlightFriend(marker.author);
            });
        }

        this.markerLayers.set(marker.id, markerLayer);
        this.markers.set(marker.id, marker);
    }

    // Display marker list in sidebar
    displayMarkerList(markers) {
        const listEl = document.getElementById('markerList');

        if (markers.length === 0) {
            listEl.innerHTML = '<div class="loading">No markers found</div>';
            return;
        }

        // Sort by timestamp (newest first)
        markers.sort((a, b) => b.timestamp - a.timestamp);

        listEl.innerHTML = `
            <ul class="marker-list">
                ${markers.map(m => {
                    const isOwned = this.currentPubky && m.author === this.currentPubky;
                    const actionsHtml = isOwned ? `
                        <div class="marker-actions">
                            <button class="edit-btn" onclick="event.stopPropagation(); app.editMarker('${m.id}')">Edit</button>
                            <button class="delete-btn" onclick="event.stopPropagation(); app.deleteMarker('${m.id}')">Delete</button>
                        </div>
                    ` : '';

                    return `
                        <li class="marker-item" onclick="app.focusMarker('${m.id}')">
                            <div class="marker-title">${m.title}</div>
                            <div class="marker-desc">${m.description}</div>
                            <div class="marker-meta">
                                ${new Date(m.timestamp).toLocaleDateString()} •
                                ${m.latitude.toFixed(4)}, ${m.longitude.toFixed(4)}
                            </div>
                            ${actionsHtml}
                        </li>
                    `;
                }).join('')}
            </ul>
        `;
    }

    // Focus on a specific marker on the map
    focusMarker(markerId) {
        const marker = this.markers.get(markerId);
        const markerLayer = this.markerLayers.get(markerId);

        if (marker && markerLayer) {
            this.map.setView([marker.latitude, marker.longitude], 15);
            markerLayer.openPopup();
        }
    }

    // Clear all markers from map
    clearMapMarkers() {
        this.markerLayers.forEach(layer => this.map.removeLayer(layer));
        this.markerLayers.clear();
        this.markers.clear();
    }

    // Edit a marker
    editMarker(markerId) {
        const marker = this.markers.get(markerId);

        if (!marker) {
            this.showError('Marker not found');
            return;
        }

        // Check ownership
        if (marker.author !== this.currentPubky) {
            this.showError('You can only edit your own markers');
            return;
        }

        // Store the marker ID being edited
        this.editingMarkerId = markerId;

        // Switch to add tab
        this.switchTab('add');

        // Pre-populate the form
        document.getElementById('title').value = marker.title;
        document.getElementById('description').value = marker.description;
        document.getElementById('latitude').value = marker.latitude;
        document.getElementById('longitude').value = marker.longitude;

        // Set the marker location
        this.currentMarkerLocation = { lat: marker.latitude, lng: marker.longitude };

        // Show the marker on the map
        if (this.tempMarker) {
            this.map.removeLayer(this.tempMarker);
        }
        this.tempMarker = L.marker([marker.latitude, marker.longitude], {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })
        }).addTo(this.map);

        // Center map on marker
        this.map.setView([marker.latitude, marker.longitude], 15);

        // Update submit button text
        document.getElementById('submitBtn').textContent = 'Update Story';

        this.log(`Editing marker: ${markerId}`);
    }

    // Update an existing marker
    async updateMarker(markerId, title, description, photoFile) {
        const marker = this.markers.get(markerId);

        if (!marker) {
            this.showError('Marker not found');
            return;
        }

        try {
            this.updateStatus('Updating your story...', 'testnet');

            // Update marker object
            const updatedMarker = {
                ...marker,
                title: title,
                description: description,
                latitude: this.currentMarkerLocation.lat,
                longitude: this.currentMarkerLocation.lng,
            };

            // If new photo provided, update photos array
            if (photoFile) {
                const photoFilename = `photo-${Date.now()}.jpg`;
                updatedMarker.photos = [photoFilename];

                // Upload new photo
                const photoBytes = await this.fileToUint8Array(photoFile);
                await this.session.storage.putBytes(
                    `/pub/geostories.app/markers/${markerId}/${photoFilename}`,
                    photoBytes
                );
                this.log(`Photo uploaded: ${photoFilename}`);

                // Delete old photos
                if (marker.photos && marker.photos.length > 0) {
                    for (const photo of marker.photos) {
                        try {
                            await this.session.storage.delete(`/pub/geostories.app/markers/${markerId}/${photo}`);
                            this.log(`Deleted old photo: ${photo}`);
                        } catch (err) {
                            console.warn(`Failed to delete old photo: ${photo}`, err);
                        }
                    }
                }
            }

            // Save updated marker metadata
            await this.session.storage.putJson(
                `/pub/geostories.app/markers/${markerId}.json`,
                updatedMarker
            );
            this.log(`Marker updated: ${markerId}`);

            this.updateStatus('Story updated successfully!', 'connected');
            this.showSuccess('Your story has been updated!');

            // Update the marker in memory
            this.markers.set(markerId, updatedMarker);

            // Remove old marker from map
            const oldMarkerLayer = this.markerLayers.get(markerId);
            if (oldMarkerLayer) {
                this.map.removeLayer(oldMarkerLayer);
                this.markerLayers.delete(markerId);
            }

            // Add updated marker to map
            this.addMarkerToMap(updatedMarker);

            // Reset form and editing state
            document.getElementById('markerForm').reset();
            document.getElementById('photoPreview').style.display = 'none';
            document.getElementById('submitBtn').textContent = 'Add Story to Map';
            if (this.tempMarker) {
                this.map.removeLayer(this.tempMarker);
            }
            this.currentMarkerLocation = null;
            this.editingMarkerId = null;

            // Refresh the marker list
            await this.loadUserMarkers(this.currentPubky);

            // Switch to view tab
            this.switchTab('view');
        } catch (error) {
            this.showError('Failed to update story: ' + error.message);
            console.error(error);
        }
    }

    // Delete a marker
    async deleteMarker(markerId) {
        const marker = this.markers.get(markerId);

        if (!marker) {
            this.showError('Marker not found');
            return;
        }

        // Check ownership
        if (marker.author !== this.currentPubky) {
            this.showError('You can only delete your own markers');
            return;
        }

        if (!confirm(`Are you sure you want to delete "${marker.title}"?`)) {
            return;
        }

        try {
            this.updateStatus('Deleting marker...', 'testnet');

            // Delete marker metadata file
            await this.session.storage.delete(`/pub/geostories.app/markers/${markerId}.json`);
            this.log(`Deleted marker: ${markerId}`);

            // Delete photo if it exists
            if (marker.photos && marker.photos.length > 0) {
                for (const photo of marker.photos) {
                    try {
                        await this.session.storage.delete(`/pub/geostories.app/markers/${markerId}/${photo}`);
                        this.log(`Deleted photo: ${photo}`);
                    } catch (err) {
                        console.warn(`Failed to delete photo: ${photo}`, err);
                    }
                }
            }

            // Remove from map
            const markerLayer = this.markerLayers.get(markerId);
            if (markerLayer) {
                this.map.removeLayer(markerLayer);
                this.markerLayers.delete(markerId);
            }
            this.markers.delete(markerId);

            // Refresh the marker list
            await this.loadUserMarkers(this.currentPubky);

            this.updateStatus('Marker deleted successfully', 'connected');
            this.showSuccess('Marker deleted!');
        } catch (error) {
            this.showError('Failed to delete marker: ' + error.message);
            console.error(error);
        }
    }

    // Switch between tabs
    switchTab(tab) {
        const tabs = ['add', 'view'];
        tabs.forEach(t => {
            document.getElementById(`${t}Tab`).classList.toggle('active', t === tab);
        });

        document.querySelectorAll('.tab-btn').forEach((btn, idx) => {
            btn.classList.toggle('active', tabs[idx] === tab);
        });
    }

    // Preview photo before upload
    previewPhoto(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.getElementById('photoPreview');
                preview.src = e.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    }

    // Helper: Convert file to Uint8Array
    async fileToUint8Array(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(new Uint8Array(reader.result));
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    // Update status display
    updateStatus(message, type, compact = false) {
        const statusEl = document.getElementById('status');
        statusEl.textContent = message;
        statusEl.className = `status ${type}${compact ? ' compact' : ''}`;
    }

    // Show error message
    showError(message) {
        alert('Error: ' + message);
        this.log('ERROR: ' + message);
    }

    // Show success message
    showSuccess(message) {
        this.log('SUCCESS: ' + message);
    }

    // Log to console
    log(message) {
        console.log(`[GeoStories] ${message}`);
    }
}

// Initialize app
window.app = new GeoStoriesApp();
console.log('GeoStories app initialized');
