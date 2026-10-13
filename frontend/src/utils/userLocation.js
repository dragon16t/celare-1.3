import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const LOCATION_KEY = 'cg_delivery_location';
export const LOCATION_EVENT = 'cg-location-change';

export function getSavedLocation() {
  try {
    const raw = localStorage.getItem(LOCATION_KEY);
    const loc = raw ? JSON.parse(raw) : null;
    if (loc && loc.lat != null && loc.lng != null) return loc;
    const legacy = JSON.parse(localStorage.getItem('userLocation') || 'null');
    if (legacy?.latitude) return { lat: legacy.latitude, lng: legacy.longitude, locality: 'Current location' };
    return loc;
  } catch (_) { return null; }
}

export function saveLocation(loc) {
  try { localStorage.setItem(LOCATION_KEY, JSON.stringify(loc)); } catch (_) { /* noop */ }
  window.dispatchEvent(new CustomEvent(LOCATION_EVENT, { detail: loc }));
}

// Browser GPS → address; always saves coordinates even if address lookup fails.
export function detectLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('unsupported'));
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      let info = { lat, lng, locality: 'Current location' };
      try {
        const r = await axios.get(`${API}/geo/reverse-geocode`, { params: { lat, lng } });
        if (r.data) info = { ...r.data, lat, lng };
      } catch (_) { /* coordinates are enough */ }
      saveLocation(info);
      resolve(info);
    }, (err) => reject(err), { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 });
  });
}
