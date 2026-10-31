import fs from 'fs';
import path from 'path';

const STATE_FILE = path.resolve('./reg_edu_ua_major.txt');
// 145/146 are silently upgraded by create_go.js to the GoLogin fingerprint's Chrome 154, and a 154 profile
// fails every request with ERR_PROXY_CONNECTION_FAILED (measured). 147-149 work, so 147 is the real floor.
const FIRST_MAJOR = 147;

/** Chrome's reduced User-Agent format (what real Chrome sends) is "<major>.0.0.0". */
export const chromeVersion = (major) => `${major}.0.0.0`;

export function readUaMajor() {
    try {
        const major = parseInt(fs.readFileSync(STATE_FILE, 'utf-8'), 10);
        return Number.isFinite(major) && major >= FIRST_MAJOR ? major : FIRST_MAJOR;
    } catch (e) {
        return FIRST_MAJOR;
    }
}

/** TikTok served the "download app" wall for this UA; the next run starts one major higher. */
export function bumpUaMajor() {
    const next = readUaMajor() + 1;
    fs.writeFileSync(STATE_FILE, `${next}\n`);
    console.log(`[UA] download-app wall hit, next run uses Chrome ${next}`);
    return next;
}
