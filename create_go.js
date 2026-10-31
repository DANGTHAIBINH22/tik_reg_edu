import path from 'path';
import fsExtra from 'fs-extra';
import GoLogin from 'gologin';
import axios from 'axios';
import { config } from './config.js';
import { generateProxy, extractProxy, getGologinProxy, generateRandomHex, getProxyView } from './utils.js';
import { getGologinProxyRand } from './gologin_proxy.js';

import { mapProxies, getProxyByCountry, getProxyByCountryRandom } from './pyproxy.js';
// import { getProxyByState,getProxyByStateRandom,getProxyByCountry,getProxyByCountryRandom} from './smart.js';
const GL = new GoLogin({ token: config.GOLOGIN_API_TOKEN });

// Override GL.getRandomFingerprint to pass target resolution and isM1 parameters to the GoLogin API
GL.getRandomFingerprint = async function (options) {
    let os = options.os || 'lin';
    let resolution = options.navigator?.resolution || '1920x1080';
    let isM1 = options.isM1 || false;

    let url = `https://api.gologin.com/browser/fingerprint?os=${os}&resolution=${resolution}`;
    if (isM1) {
        url += '&isM1=true';
    }

    const response = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${this.access_token}`,
            'Content-Type': 'application/json'
        }
    });

    return response.data;
};
const delay = (time) => new Promise((resolve) => setTimeout(resolve, time));
export async function createMultipleProfiles(osType, numOfProfiles, userAgent = "random", startUrl = false) {
    const sessionTime = 5;
    let completedProfiles = 0;
    let progressMessage = '';
    let profileId = '';
    let profiles = [];

    const createProfilePromises = Array.from({ length: numOfProfiles }, async function (_, index) {
        let proxy = generateProxy(sessionTime);
        let state = getProxyByCountryRandom()
        let proxy_arr = getProxyByCountry({
            country: state,
            length: 1,
            username: "babalili121415",
            password: "Tabdajkhsdf13235",
            // type: config.proxy_type,
            host: "b35301d43d682c1a.xuw.as.pyproxy.io",
            port: "16666",
            type: "sticky_1",
        })
        proxy = proxy_arr.proxies[0].replace('http://', '')
        // proxy = 'babalili121415-zone-resi-region-vn-session-'+generateRandomHex(12)+'-sessTime-5:Tabdajkhsdf13235@b35301d43d682c1a.xuw.as.pyproxy.io:16666'
        // process.exit(1)
        // proxy = "gologin"
        proxy = "gologinrand"
        /*
                let number = (Math.floor(Math.random() * 800) + 10006);
                let list_country = ["Vietnam","Japan","Indonesia","Taiwan"]
               country_rand = list_country[Math.floor((Math.random() * list_country.length))];
                state = getProxyByCountryRandom()
              // state = country_rand
              let proxys = getProxyByCountry({ country:state, length:1, type: "sticky_1" })
              // let state = getProxyByStateRandom()
              // let proxys = getProxyByState({ country:state, length:1, type: "sticky_1" })
        
              proxy = proxys.proxies[0]
        //*/
        // proxy = "http://user-spv7n9t9zd-country-nl-city-almere_stad:hemqGREip9T45i+d8j@gate.smartproxy.com:"+getRandomInt(10001,10299)
        // proxy = "user-spv7n9t9zd-country-nl-city-almere_stad:hemqGREip9T45i+d8j@gate.smartproxy.com:10028"
        // proxy = "user-spv7n9t9zd-country-br-city-varginha-sessionduration-1:hemqGREip9T45i+d8j@gate.smartproxy.com:10004"
        // proxy = "spv7n9t9zd:hemqGREip9T45i+d8j@ae.smartproxy.com:20001"
        // proxy = "spv7n9t9zd:hemqGREip9T45i+d8j@sa.smartproxy.com:45002"
        // proxy = "user-spv7n9t9zd-country-co-city-santa_marta:hemqGREip9T45i+d8j@gate.smartproxy.com:10027"
        // proxy = "user-spv7n9t9zd-country-us-city-jackson:hemqGREip9T45i+d8j@gate.smartproxy.com:10005"
        // proxy = "user-spv7n9t9zd-sessionduration-1:hemqGREip9T45i+d8j@ph.smartproxy.com:40001"
        // proxy = "user-spv7n9t9zd-country-ar-city-caseros-sessionduration-5:hemqGREip9T45i+d8j@gate.smartproxy.com:"+number
        // proxy = "http://spv7n9t9zd:hemqGREip9T45i+d8j@gate.smartproxy.com:"+getRandomInt(10001,49999)
        // proxy = "http://spv7n9t9zd:hemqGREip9T45i+d8j@jp.smartproxy.com:"+getRandomInt(30006,30906)
        // proxy = proxys.proxies[0]
        let proxys = await getProxyView();
        proxy = proxys[Math.floor((Math.random() * proxys.length))];
        // proxy = `thinhfb123-zone-resi-session-`+generateRandomHex(12)+`-sessTime-${sessionTime}:KikOg9wRNnfzBjd@b35301d43d682c1a.byi.na.pyproxy.io:16666`
        // proxy = 'amac~ala:Sonetrend817@bupview.ddns.net:5005'
        proxy = proxy.replace('http://', '')

        // console.log('country',state,proxy)

        try {
            profileId = await createOneProfile(osType, proxy, userAgent, startUrl);
            profiles.push({ profileId, proxy });
            progressMessage = `Profile ${profileId} [${osType}]: Created -> `;
            return { profileId, proxy }
        } catch (error) {
            progressMessage += `Error: ${error.message}`;
            console.error(`Failed to complete all steps for profile:`, error);
        } finally {
            completedProfiles += 1;
            console.log(`Progress: ${completedProfiles}/${numOfProfiles} profiles created.`);
        }
    });

    try {
        let res = await Promise.allSettled(createProfilePromises);
        return res.filter(i => i.value.profileId).map(i => i.value);
        console.log('Profiles creation completed');
    } catch (error) {
        console.error('An error occurred during profile creation:', error);
        return [];
    }
};
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min);
}
const resolutions = [
    "1280x720",  // HD
    "1280x800",  // WXGA
    "1366x768",  // FWXGA
    "1440x900",  // WXGA+
    "1600x900",  // HD+
    "1680x1050", // WSXGA+
    "1920x1080", // Full HD
    "1920x1200", // WUXGA
];

function getRandomResolution() {
    const randomIndex = Math.floor(Math.random() * resolutions.length);
    return resolutions[randomIndex];
}

// Sử dụng hàm
// const randomResolution = getRandomResolution();
// console.log("Resolution ngẫu nhiên:", randomResolution);

export async function createOneProfile(osType, proxy = {}, userAgent = "random", startUrl = false, pname = "") {
    let isM1 = false;
    let osSpec = "";

    if (osType === 'mac') {
        isM1 = true;
        const macChips = ["M1", "M2", "M3", "M4"];
        osSpec = macChips[Math.floor(Math.random() * macChips.length)];
    } else if (osType === 'win') {
        osSpec = Math.random() < 0.5 ? "win11" : "";
    }

    const resolution = getRandomResolution();
    const profileName = pname || "AMAC " + Math.random().toString(36).substring(2, 8);

    // Override User-Agent if it mismatches the OS type to prevent leaks
    let formattedUserAgent = userAgent;
    if (userAgent && userAgent !== 'random') {
        if (osType === 'win' && userAgent.includes('Macintosh; Intel Mac OS X')) {
            formattedUserAgent = userAgent.replace(/Macintosh; Intel Mac OS X [0-9_]+/g, 'Windows NT 10.0; Win64; x64');
        } else if (osType === 'mac' && userAgent.includes('Windows NT')) {
            formattedUserAgent = userAgent.replace(/Windows NT [0-9.]+; Win64; x64/g, 'Macintosh; Intel Mac OS X 10_15_7');
        } else if (osType === 'lin' && (userAgent.includes('Macintosh') || userAgent.includes('Windows'))) {
            formattedUserAgent = userAgent.replace(/(Macintosh; Intel Mac OS X [0-9_]+|Windows NT [0-9.]+; Win64; x64)/g, 'X11; Linux x86_64');
        }
    }

    // Configure Proxy
    let proxyConfig = {
        mode: 'none'
    };

    if (proxy) {
        if (proxy === 'gologin') {
            let proxyInfo = await getGologinProxy();
            proxyInfo = proxyInfo?.data;

            if (proxyInfo?.host) {
                proxyConfig = {
                    mode: 'http',
                    host: proxyInfo.host,
                    port: parseInt(proxyInfo.port, 10),
                    username: proxyInfo.username || '',
                    password: proxyInfo.password || ''
                };
            }
        } else if (proxy === 'gologinrand') {
            let proxyInfo = await getGologinProxyRand();
            proxyInfo = proxyInfo?.data;
            if (proxyInfo?.trafficUsed > 0.43) {
                await delay(10000);
                process.exit(1);
            }
            if (proxyInfo?.host) {
                proxyConfig = {
                    mode: 'http',
                    host: proxyInfo.host,
                    port: parseInt(proxyInfo.port, 10),
                    username: proxyInfo.username || '',
                    password: proxyInfo.password || ''
                };
            }
        } else if (typeof proxy === 'string' && proxy.trim()) {
            const { host, port, username, password } = extractProxy(proxy);
            if (host && port) {
                proxyConfig = {
                    mode: 'http',
                    host: host,
                    port: parseInt(port, 10),
                    username: username || '',
                    password: password || ''
                };
            }
        } else if (typeof proxy === 'object' && proxy?.host) {
            proxyConfig = {
                mode: proxy.mode || 'http',
                host: proxy.host,
                port: parseInt(proxy.port, 10),
                username: proxy.username || '',
                password: proxy.password || ''
            };
        }
    }

    // Fetch fresh dynamic fingerprint from GoLogin API
    let fp = null;
    try {
        const fpUrl = `https://api.gologin.com/browser/fingerprint?os=${osType}&resolution=${resolution}${isM1 ? '&isM1=true' : ''}`;
        const fpRes = await axios.get(fpUrl, {
            headers: {
                'Authorization': `Bearer ${config.GOLOGIN_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        fp = fpRes.data;
    } catch (err) {
        console.warn(`[WARN] Failed to fetch fingerprint for ${osType}:`, err.message);
    }

    let finalUserAgent = (formattedUserAgent && formattedUserAgent !== 'random')
        ? formattedUserAgent
        : (fp?.navigator?.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.102 Safari/537.36');

    // Ensure Chrome version in userAgent is >= 147 to satisfy GoLogin securedOrbitaVersion requirement
    const majorMatch = finalUserAgent.match(/Chrome\/(\d+)/);
    const major = majorMatch ? parseInt(majorMatch[1], 10) : 0;
    if (major > 0 && major < 147) {
        const fallbackUA = fp?.navigator?.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.102 Safari/537.36';
        const fallbackVerMatch = fallbackUA.match(/Chrome\/([0-9.]+)/);
        const targetVer = fallbackVerMatch ? fallbackVerMatch[1] : '149.0.7827.102';
        console.log(`[INFO] Upgrading Chrome version in userAgent from ${major} to ${targetVer} (GoLogin securedOrbitaVersion requirement >= 147)`);
        finalUserAgent = finalUserAgent.replace(/Chrome\/[0-9.]+/, `Chrome/${targetVer}`);
    }

    // Build payload strictly adhering to GoLogin standard POST /browser/custom API
    const customPayload = {
        os: osType,
        osSpec: osSpec,
        name: profileName,
        notes: "created via /browser/custom API",
        googleServicesEnabled: true,
        lockEnabled: false,
        navigator: {
            userAgent: finalUserAgent,
            resolution: resolution,
            language: fp?.navigator?.language || 'en-US,en;q=0.9',
            platform: osType === 'mac' ? 'MacIntel' : (osType === 'win' ? 'Win32' : 'Linux x86_64')
        },
        storage: {
            local: true,
            extensions: true,
            bookmarks: true,
            history: true,
            passwords: true,
            session: true,
            indexedDb: false,
            enableExternalExtensions: false
        },
        fonts: {
            families: Array.isArray(fp?.fonts) ? fp.fonts : (fp?.fonts?.families || []),
            enableMasking: true,
            enableDomRect: true
        },
        webGLMetadata: {
            mode: 'mask',
            vendor: fp?.webGLMetadata?.vendor || (osType === 'mac' ? 'Google Inc. (Apple)' : 'Google Inc. (Intel)'),
            renderer: fp?.webGLMetadata?.renderer || (osType === 'mac' ? 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)' : 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)')
        },
        webglParams: fp?.webglParams || {},
        canvas: { mode: 'off' },
        audioContext: { mode: 'noise' },
        clientRects: { mode: 'off' },
        webGL: { mode: 'off' },
        webRTC: { mode: 'alerted' },
        mediaDevices: {
            enableMasking: true,
            videoInputs: 1,
            audioInputs: 1,
            audioOutputs: 1
        },
        timezone: {
            enabled: true,
            fillBasedOnIp: true
        },
        proxy: proxyConfig
    };

    if (startUrl) {
        customPayload.startUrl = startUrl;
    }

    const extensions = config.EXTENDSIONS ? config.EXTENDSIONS.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (extensions.length) {
        customPayload.chromeExtensions = extensions;
    }

    try {
        const response = await axios.post('https://api.gologin.com/browser/custom', customPayload, {
            headers: {
                'Authorization': `Bearer ${config.GOLOGIN_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            timeout: 20000
        });

        const profile_id = response.data?.id || response.data?.profile_id;
        return profile_id;
    } catch (e) {
        const errorData = e.response?.data ? JSON.stringify(e.response.data) : e.message;
        console.error('[ERROR] Failed to create profile via /browser/custom:', errorData);
    }

    return;
}

export async function deleteProfile(profile_id) {
    await GL.delete(profile_id);
}

export const activeGLInstances = new Map();

export async function startProfile(profileId, extraParams = []) {
    let launchArgs = [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-infobars",
        "--window-position=0,0",
        "--ignore-certificate-errors",
        "--ignore-certificate-errors-spki-list",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--enable-features=NetworkService",
        ...extraParams
    ];

    const GL = new GoLogin({
        token: config.GOLOGIN_API_TOKEN,
        profile_id: profileId,
        args: launchArgs,
        defaultViewport: { width: 1366, height: 768, deviceScaleFactor: 1 },
    });

    try {
        const { status, wsUrl } = await GL.startLocal();
        if (status === 'success') {
            activeGLInstances.set(profileId, GL);
        }
        return { status, wsUrl: wsUrl ? wsUrl.toString() : null };
    } catch (e) {
        console.error(`Error starting profile ${profileId} via GoLogin NPM:`, e);
        return { status: 'failure', error: e.message };
    }
}

export async function stopProfileNPM(profileId) {
    const GL = activeGLInstances.get(profileId);
    if (GL) {
        try {
            await GL.stopLocal({ posting: true });
            activeGLInstances.delete(profileId);
            return true;
        } catch (e) {
            console.error(`Error stopping profile ${profileId} via GoLogin NPM:`, e);
        }
    }
    return false;
}