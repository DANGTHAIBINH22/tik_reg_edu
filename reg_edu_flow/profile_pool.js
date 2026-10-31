import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import helper from '../helper.pup.js';
import { createOneProfile } from '../create_go.js';
import { stopProfile } from './gologin_api.js';

const execAsync = promisify(exec);
const delay = (time) => new Promise((resolve) => setTimeout(resolve, time));

const withTimeout = (promise, ms, message) => {
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

/** Runs tasks with at most `maxWorkers` in flight; never rejects, failures are collected in results. */
export class WorkerPool {
    constructor(maxWorkers) {
        this.maxWorkers = maxWorkers;
        this.activeWorkers = 0;
        this.queue = [];
        this.results = [];
        this.completed = 0;
        this.totalTasks = 0;
        this.startTime = null;
    }

    execute(tasks) {
        this.totalTasks = tasks.length;
        this.startTime = Date.now();
        console.log(`[POOL] Starting ${this.totalTasks} tasks with ${this.maxWorkers} workers`);

        return new Promise((resolve) => {
            this.queue = [...tasks];
            this.results = [];
            this.completed = 0;
            this.onComplete = resolve;
            this.progressTimer = setInterval(() => this.logProgress(), 10000);
            this.processQueue();
        });
    }

    logProgress() {
        const elapsed = (Date.now() - this.startTime) / 1000;
        const rate = (this.completed / elapsed * 60).toFixed(1);
        console.log(`[PROGRESS] ${this.completed}/${this.totalTasks} completed, ${this.activeWorkers} active, ${rate}/min`);
    }

    processQueue() {
        while (this.queue.length > 0 && this.activeWorkers < this.maxWorkers) {
            const task = this.queue.shift();
            this.activeWorkers++;
            this.processTask(task).finally(() => {
                this.activeWorkers--;
                this.completed++;
                this.processQueue();
            });
        }

        if (this.queue.length === 0 && this.activeWorkers === 0) {
            clearInterval(this.progressTimer);
            this.logProgress();
            this.onComplete(this.results);
        }
    }

    async processTask(task) {
        const taskStart = Date.now();
        try {
            const data = await task.execute();
            this.results.push({ success: true, data, task, duration: Date.now() - taskStart });
        } catch (error) {
            console.error(`[ERROR] Task failed after ${Date.now() - taskStart}ms:`, error.message);
            this.results.push({ success: false, error: error.message, task, duration: Date.now() - taskStart });
        }
    }
}

/** Creates a GoLogin profile and starts its browser, returning the CDP wsUrl. */
export class ProfileTask {
    constructor({ email, proxy, userAgent, startUrl, version, platform, osType, cronName, retryCount = 1 }) {
        this.email = email;
        this.proxy = proxy;
        this.userAgent = userAgent;
        this.startUrl = startUrl;
        this.version = version;
        this.platform = platform || osType;
        this.cronName = cronName;
        this.retryCount = retryCount;
    }

    async execute() {
        const startTime = Date.now();
        let lastError = null;

        for (let attempt = 0; attempt < this.retryCount; attempt++) {
            try {
                // Jitter spreads GoLogin API calls when many profiles start together.
                await delay(helper.getRandomInt(1000, 3000) + Math.random() * 2000);

                const cleanProxy = this.proxy.replace(/^https?:\/\//, '');
                const profileId = await this.createProfile(cleanProxy);
                if (!profileId) throw new Error('Failed to create profile - no ID returned');

                const browserData = await this.startBrowser(profileId);
                console.log(`[SUCCESS] Profile ${profileId} started for ${this.email} (${Date.now() - startTime}ms)`);
                return {
                    profileId,
                    wsUrl: browserData.wsUrl,
                    email: this.email,
                    proxy: this.proxy,
                    data: browserData,
                    duration: Date.now() - startTime
                };
            } catch (error) {
                lastError = error;
                console.log(`[RETRY] ${this.email} attempt ${attempt + 1}/${this.retryCount}: ${error.message}`);
                if (attempt < this.retryCount - 1) {
                    await delay(Math.min(1000 * 2 ** attempt, 8000) + Math.random() * 1000);
                }
            }
        }
        throw new Error(`All ${this.retryCount} attempts failed. Last error: ${lastError?.message}`);
    }

    createProfile(cleanProxy, timeout = 30000) {
        const profileName = this.cronName ? `P ${this.cronName}` : '';
        return withTimeout(
            createOneProfile(this.platform, cleanProxy, this.userAgent, this.startUrl, profileName),
            timeout, 'Profile creation timeout'
        );
    }

    /** GoLogin sometimes answers before Orbita opens its debug port; read the port from the process list. */
    async waitForWsUrlFromProcess(profileId, timeoutMs = 10000) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            try {
                const { stdout } = await execAsync(`ps aux | grep "${profileId}" | grep -v grep`);
                const port = stdout.match(/--remote-debugging-port=(\d+)/)?.[1];
                if (port) {
                    const res = await axios.get(`http://127.0.0.1:${port}/json/version`, { timeout: 1000 }).catch(() => null);
                    if (res?.data?.webSocketDebuggerUrl) return res.data.webSocketDebuggerUrl;
                }
            } catch (_) { /* process not up yet */ }
            await delay(500);
        }
        return null;
    }

    async startBrowser(profileId, timeout = 60000) {
        const pacFlag = process.env.VPS_IP
            ? `--proxy-pac-url=http://${process.env.VPS_IP}:${process.env.VPS_PAC_PORT || 8878}/proxy.pac`
            : '';
        const body = JSON.stringify({ profileId, extra_params: pacFlag, sync: true });

        const response = await withTimeout(helper.makeRequest({
            url: 'http://localhost:36912/browser/start-profile',
            method: 'post',
            body,
            headers: { 'Content-Type': 'application/json' },
            timeout
        }), timeout, 'Browser start timeout');

        const json = response.bodyJson;
        if (json?.status === 'success' && json?.wsUrl) {
            await helper.lastStartGologin(true);
            return json;
        }

        if (json?.status === 'success') {
            console.log(`[WARN] start-profile returned success but empty wsUrl for ${profileId}. Polling process for port...`);
            const wsUrl = await this.waitForWsUrlFromProcess(profileId);
            if (wsUrl) {
                await helper.lastStartGologin(true);
                return { status: 'success', wsUrl };
            }
        }

        await helper.lastStartGologin(false);
        await stopProfile(profileId);
        const detail = (json && Object.keys(json).length > 0)
            ? JSON.stringify(json)
            : (response.body || response.statusText || 'empty response');
        throw new Error(`Invalid browser response: ${detail}`);
    }
}
