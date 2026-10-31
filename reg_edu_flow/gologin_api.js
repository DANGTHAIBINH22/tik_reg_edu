import axios from 'axios';
import { config } from '../config.js';

const CLOUD_BASE_URL = 'https://api.gologin.com/browser/v2';
const LOCAL_API_URL = 'http://localhost:36912';
const KEEP_NEWEST_PROFILES = 20;

const authHeaders = () => ({
    'Authorization': `Bearer ${config.GOLOGIN_API_TOKEN}`,
    'Content-Type': 'application/json'
});

export async function getProfiles() {
    const profiles = [];
    for (let page = 1; ; page++) {
        const response = await axios.get(`${CLOUD_BASE_URL}?page=${page}`, { headers: authHeaders() });
        if (!response.data.profiles.length) break;
        profiles.push(...response.data.profiles);
    }
    return profiles;
}

export async function deleteProfiles(profileIds) {
    if (!profileIds.length) return;
    try {
        const response = await axios.delete('https://api.gologin.com/browser', {
            headers: authHeaders(),
            data: { profilesToDelete: profileIds }
        });
        return response.data;
    } catch (error) {
        console.error('Error deleting profiles:', error.message);
    }
}

/** Keeps only the newest profiles so the GoLogin account never hits its profile quota. */
export async function clearProfile() {
    try {
        const profiles = await getProfiles();
        const stale = profiles
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .filter((_, index) => index > KEEP_NEWEST_PROFILES);
        await deleteProfiles(stale.map(p => p.id));
    } catch (error) {
        console.error('Error clearing profiles:', error.message);
    }
}

export async function stopProfile(profileId) {
    try {
        const response = await axios.post(`${LOCAL_API_URL}/browser/stop-profile`, { profileId }, {
            headers: authHeaders(),
            timeout: 15000
        });
        return response.data;
    } catch (error) {
        console.error('stop profile error:', error.message);
    }
}
