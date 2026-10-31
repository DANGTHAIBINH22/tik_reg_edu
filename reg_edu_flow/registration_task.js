import path from 'path';
import helper from '../helper.pup.js';
import Clone from './clone_reg.js';
import { stopProfile } from './gologin_api.js';

const SUPPORTED_ALIASES = ['US', 'VN', 'JP', 'BD', 'BR', 'ID', 'IN'];
const STOP_PROFILE_DELAY_MS = 5000;

const filterCookiesByDomainKeyword = (cookies, keyword) => {
    if (!Array.isArray(cookies)) return [];
    return cookies.filter(c => (c.domain || '').toLowerCase().includes(keyword));
};

/** Drives one email through Clone.setupprofile with a hard timeout and guaranteed profile cleanup. */
export class RegistrationTask {
    constructor({ profileData, emailInfo, proxys, proxy, options, timeout }) {
        this.profileData = profileData;
        this.emailInfo = emailInfo;
        this.proxys = proxys;
        this.proxy = proxy;
        this.options = options;
        this.timeout = timeout;
    }

    async stopProfileOnce() {
        if (this.stopped) return;
        this.stopped = true;
        await stopProfile(this.profileData.profileId);
        console.log(`[CLEANUP] Profile ${this.profileData.profileId} stopped for ${this.emailInfo.email}`);
    }

    async execute() {
        const startTime = Date.now();
        const { profileId } = this.profileData;

        if (!this.emailInfo?.email) {
            throw new Error(`Invalid emailInfo: ${JSON.stringify(this.emailInfo)}`);
        }

        let timer;
        try {
            const { aliasName, cronName } = this.options;
            Object.assign(this.emailInfo, {
                password: this.emailInfo.password || '',
                proxys: this.proxys,
                alias_name: SUPPORTED_ALIASES.includes(aliasName) ? aliasName : 'VN',
                cron_name: cronName
            });

            const googleCookies = filterCookiesByDomainKeyword(
                await helper.getCookies({ email: this.emailInfo.email }), 'google');

            const registration = Clone.setupprofile({
                wsUrl: this.profileData.wsUrl,
                email_info: this.emailInfo,
                folder_avatar: path.resolve('./pexels'),
                cron_name: cronName,
                proxy: this.proxy,
                cookies: googleCookies,
                is_stop_username: this.options.isStopUsername,
                is_finish_at_username: this.options.finishAtUsername,
                category: 'tiktok_reg_vn_edu5',
            });
            const timeout = new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('Registration timeout')), this.timeout);
            });

            const result = await Promise.race([registration, timeout]);
            const duration = Date.now() - startTime;
            if (result !== true) throw new Error(`Registration failed with result: ${result}`);

            console.log(`[REG_SUCCESS] ${this.emailInfo.email} completed in ${duration}ms`);
            setTimeout(() => this.stopProfileOnce(), STOP_PROFILE_DELAY_MS);
            return { success: true, email: this.emailInfo.email, result: true, duration, profileId };
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`[REG_ERROR] ${this.emailInfo.email} failed after ${duration}ms:`, error.message);
            await this.stopProfileOnce();
            return { success: false, email: this.emailInfo.email, error: error.message, duration, profileId };
        } finally {
            clearTimeout(timer);
        }
    }
}
