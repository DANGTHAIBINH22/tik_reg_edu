import axios from 'axios'

import path from 'path'
import fs from "fs"
import { solvecap } from './ResolveCapcha.js';
// const randomstring = require('randomstring');
// import { encrypt} from "./encrypt.js"
import { get_first_name, get_last_name } from "./names.js"
import moment from "moment"


import Fingerprint from "./fpgen.js"
function randomString(length) {
    const characters = '1234567890qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}
const decodeUrl = (encodedString) => {
    return encodedString.replace(/\\u([0-9a-fA-F]{4})/g, (match, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
    });
}

import vm from 'vm'
import helper from './helper.pup.js';

// Function to encrypt password using encrypter.js
function encrypt(password, random_num, key) {
    // Read the encrypter.js file
    const encrypterScript = fs.readFileSync('encrypter.js', 'utf8');

    // Create a script from the encrypter.js content
    const script = new vm.Script(encrypterScript);

    // Create a sandbox environment for the script to execute in
    const sandbox = {};
    const context = vm.createContext(sandbox);

    // Run the script to make functions in encrypter.js available in the sandbox
    script.runInContext(context);

    // Call the "encrypt" function from encrypter.js
    if (typeof sandbox.encrypt === 'function') {
        return sandbox.encrypt(password, random_num, key);
        
    } else {
        throw new Error('encrypt function not found in encrypter.js');
    }
}

class Outlook {
    constructor(proxy = null, proxyKey = "", enablePop3 = true, options = {}) {
        this.total_init = 0
        this.total_eval = 0
        this.cookies_array = []
        this.worker = options.thread || 1;
        this.duoimail = options.typemail || '@hotmail.com';
        if (this.duoimail === 'random') {
            this.duoimail = Math.random() > 0.5 ? '@outlook.com' : '@hotmail.com';
        }
        this.firstName = get_first_name().trim();
        this.firstName = this.firstName.includes(" ") ? (this.firstName.split(" "))[0] : this.firstName
        this.email = this.firstName.toLowerCase() + randomString(10) + this.duoimail;
        this.func = options.func || null;
        this.password = options.password || 'NongDoHuyAnh21@';
        if (this.password === 'rand') {
            this.password = randomString(7) + "21@";
        }
        this.keyCaptcha = options.key || '';
        this.outfile = options.out || 'output.txt';
        this.proxy = proxy;
        this.proxyKey = proxyKey;
        this.enablePop3 = enablePop3;
        this.message = '';
        this.key_captcha = "43b94d9fee2f4990be628e99dceec648326279"
        this.session = axios.create({
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'
            },
            proxy: proxy ? {
                host: proxy.split(':')[0],
                port: parseInt(proxy.split(':')[1])
            } : false
        });
    }

    log(text) {
        const now = new Date();
        if (this.func) {
            this.func(text);
        }
        this.message = `[ ${now.toLocaleTimeString()} ] [ Worker ${this.worker} ] - ${text}`;
        console.log(this.message);
    }

    async init() {
        try {
            this.headers = {
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'accept-language': 'vi,vi-VN;q=0.9,en-US;q=0.8,en;q=0.7',
                'priority': 'u=0, i',
                'sec-ch-ua': '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'none',
                'sec-fetch-user': '?1',
                'upgrade-insecure-requests': '1',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
            }
            const response = await this.session.get('https://signup.live.com/?lic=1', { headers: this.headers });
            if (response.status === 200) {
                this.log("load host 200");

                this.updateCookies(response)

                await this.fetchDataHome(response.data)
                if(!this.apiCanary){
                    if(this.total_init < 3) {
                        this.total_init  ++ ;
                        return await this.init()
                    }  
                    throw new Error("Failed to load the host.");

                  
                }
                return response.data;
            } else {
                this.log("load host failed");
                if(this.total_init < 3) {
                    this.total_init  ++ ;
                    return await this.init()
                }  
                throw new Error("Failed to load the host.");
            }

            
        } catch (error) {
            this.log("load host failed");
            throw error;
        }
    }

    async fetchDataHome(source) {
        try {
            this.randomNum = /var randomNum="(.*?)"/.exec(source)[1];
            this.Key = /var Key="(.*?)"/.exec(source)[1];
            this.SKI = /var SKI="(.*?)"/.exec(source)[1];
            this.apiCanary = decodeUrl(/"apiCanary":"(.*?)"/.exec(source)[1]);
            this.iUiFlavor = /"iUiFlavor":(\d*?),/.exec(source)[1];
            this.iScenarioId = /"iScenarioId":(\d*?),/.exec(source)[1];
            this.hpgid = /"hpgid":(\d*?),/.exec(source)[1];
            this.fptlink = /"urlDfp":"(.*?)"/.exec(source)[1];
            this.uaid = /"sUnauthSessionID":"(.*?)"/.exec(source)[1];
            this.sHipFid = /"sHipFid":"(.*?)"/.exec(source)[1];
            this.sSiteId = /"sSiteId":"(.*?)"/.exec(source)[1];
      
            this.log("Loaded params successfully");
        } catch (error) {
            this.log("Failed to fetch data from home page");
            throw error;
        }
    }
    async fetchDataFPT(source) {
        try {

            this.txnId = /txnId='(.*?)'/.exec(source)[1];
            this.rid = /rid='(.*?)'/.exec(source)[1];
            this.ticks = /ticks='(.*?)'/.exec(source)[1];
            this.authKey = /authKey='(.*?)'/.exec(source)[1];
            this.cid = /cid='(.*?)'/.exec(source)[1];
            this.log("load fpt params success")

        } catch (error) {
            this.log("Failed load fpt params");
            throw error;
        }
    }
    async fpt() {
        try {
            // First request
            const r1 = await this.session.get(this.fptlink);
            this.log("load host fpt success");
            this.fetchDataFPT(r1.data);

            // First headers and params
            const headers1 = {
                'accept': '*/*',
                'accept-language': 'vi,vi-VN;q=0.9,en-US;q=0.8,en;q=0.7',
                'priority': 'u=1, i',
                'referer': this.fptlink,
                'sec-ch-ua': '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                "cookie": this.cookies,

            };

            const fingerprint = new Fingerprint(headers1['user-agent']);
            const fptData = fingerprint.fpt(this.ticks, this.rid);

            const params1 = {
                ...fptData,
                'ctx': 'jscb1.0',
                'session_id': this.uaid,
                'CustomerId': this.cid,
                'PageId': 'SU',
                'u1': '',
                'u3': '10.0.0',
                'u4': 'x86',
                'u5': '64',
                'u2': '(Not)A;Brand,99.0.0.0),(Google Chrome,127.0.6533.73),(Chromium,127.0.6533.73)',
            };

            const response1 = await this.session.get('https://fpt.live.com/Images/Clear.PNG', {
                params: params1,
                headers: headers1,
            });
            this.updateCookies(response1)

            this.log("load fpt api 1");

            // Second headers and params
            const headers2 = {
                'Referer': 'https://fpt.live.com/',
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                'sec-ch-ua': '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                "cookie": this.cookies,

            };

            const params2 = {
                'ctx': 'Ls1.0',
                'wl': 'False',
                'session_id': this.uaid,
                'id': this.rid,
                'w': this.ticks,
                'tkt': this.authKey,
                'CustomerId': this.cid,
            };

            const response2 = await this.session.get('https://fpt2.microsoft.com/Clear.HTML', {
                params: params2,
                headers: headers2,
            });
            this.updateCookies(response2)

            this.log("load fpt api 2");

        } catch (error) {
            console.error("Error in fpt:", error);
        }
    }

    async EvaluateExperimentAssignments() {
        try {
            let headers = {
                'accept': 'application/json',
                'accept-language': 'vi,vi-VN;q=0.9,en-US;q=0.8,en;q=0.7',
                'canary': this.apiCanary,
                'client-request-id': this.uaid,
                'content-type': 'application/json; charset=utf-8',
                'correlationid': this.uaid,
                'hpgact': '0',
                'hpgid': this.hpgid,
                'origin': 'https://signup.live.com',
                'priority': 'u=1, i',
                'referer': 'https://signup.live.com/?lic=1',
                'sec-ch-ua': '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                "cookie": this.cookies,

            }


            const response = await this.session.post('https://signup.live.com/API/EvaluateExperimentAssignments', JSON.stringify({
                clientExperiments: [
                    {
                        parallax: 'enableplaintextforsignupexperiment',
                        control: 'enableplaintextforsignupexperiment_control',
                        treatments: ['enableplaintextforsignupexperiment_treatment'],
                    },
                    {
                        parallax: 'enablejspublickeydeprecationexperiment',
                        control: 'enablejspublickeydeprecationexperiment_control',
                        treatments: ['enablejspublickeydeprecationexperiment_treatment'],
                    },
                ]
            }), {
                headers: headers
            });
            this.apiCanary = response.data.apiCanary  || this.apiCanary ;
            if (!response.data.apiCanary){
                this.log("EvaluateExperimentAssignments"+ JSON.stringify(response.data))
                throw new Error("no   apiCanary");
            } 
            this.updateCookies(response)

            this.log("EvaluateExperimentAssignments success");
        } catch (error) {
            this.log("Failed to evaluate experiments");
            if(this.total_eval < 3){
                this.total_eval ++ 
                await helper.delay(1000)
                return await this.EvaluateExperimentAssignments()
            }
            // throw error;
        }
    }

    accountInfoGeneration() {
        return {
            BirthDate: `${Math.floor(Math.random() * 28) + 1}:0${Math.floor(Math.random() * 9) + 1}:${Math.floor(Math.random() * (2006 - 1997 + 1)) + 1997}`,
            CheckAvailStateMap: [`${this.email}:undefined`],
            Country: "VN",
            FirstName: this.firstName,
            LastName: get_last_name().trim(),
            MemberName: this.email,
        };
    }
    async updateCookies(response) {
        try {
            let cookies = response.headers["set-cookie"];

            cookies ? cookies.forEach(element => {
                let [name, value] = (element.split(";"))[0].split("=")
                let index = this.cookies_array.findIndex(i => i.name == name);
                if (index > -1) {
                    this.cookies_array[index].value = value;
                } else {
                    this.cookies_array.push({ name, value })
                }
            }) : null;
            this.cookies = this.cookies_array.reduce((p, c) => p + `${c.name}=${c.value};`, "")
        } catch (e) {
            this.log("error updateCookies", e)
        }
        let cookies = response

    }
    async checkUser() {
        try {
            const headers = {
                'accept': 'application/json',
                'accept-language': 'vi,vi-VN;q=0.9,en-US;q=0.8,en;q=0.7',
                'canary': this.apiCanary,
                'client-request-id': this.uaid,
                'content-type': 'application/json; charset=utf-8',
                'correlationid': this.uaid,
                'hpgact': '0',
                'hpgid': this.hpgid,
                'origin': 'https://signup.live.com',
                'priority': 'u=1, i',
                'referer': 'https://signup.live.com/?lic=1',
                'sec-ch-ua': '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                "cookie": this.cookies,

            };

            const params = {
                lic: '1',
            };

            const json_data = {
                includeSuggestions: true,
                signInName: 'huyasdnhasd@hotmail.com', // replace with actual sign-in name dynamically if needed
                uiflvr: this.iUiFlavor,
                scid: this.iScenarioId,
                uaid: this.uaid,
                hpgid: this.hpgid,
            };

            const response = await this.session.post('https://signup.live.com/API/CheckAvailableSigninNames', json_data, {
                params: params,
                headers: headers,
            });
            this.updateCookies(response)

            // Update apiCanary from response
            this.apiCanary = response.data.apiCanary;
            this.log(`check username success | ok: ${this.apiCanary ? "1" : "0"}`);
        } catch (error) {
            console.error("Error checking user:", error);
        }
    }

async  pop3() {
    try {
        let headers = {
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'accept-language': 'en-US,en;q=0.9',
            'priority': 'u=0, i',
            'referer': 'https://www.microsoft.com/',
            'sec-ch-ua': '"Not)A;Brand";v="99", "Microsoft Edge";v="127", "Chromium";v="127"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-ch-ua-platform-version': '"10.0.0"',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'cross-site',
            'sec-fetch-user': '?1',
            'upgrade-insecure-requests': '1',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
            'x-edge-shopping-flag': '0',
            "Cookie": this.cookies
        };
        
        let params = {
            'nlp': '1',
            'cobrandid': 'ab0455a0-8d03-46b9-b18b-df2f57b9e44c',
            'deeplink': 'owa/'
        };

        let response = await this.session.get('https://outlook.live.com/owa/', { params, headers });
        let $ = cheerio.load(response.data);
        
        this.updateCookies(response)
        let ppft =response.data.match(/name='PPFT' id='i0327' value='(.*?)'/)[1];


        let urlStay = response.data.match(/urlPostMsa:'(.*?)'/)[1];

        headers['referer'] = urlStay;

        let data = `ps=2&psRNGCDefaultType=&psRNGCEntropy=&psRNGCSLK=&canary=&ctx=&hpgrequestid=&PPFT=${ppft}&PPSX=Passport&NewUser=1&FoundMSAs=&fspost=0&i21=0&CookieDisclosure=0&IsFidoSupported=1&isSignupPost=0&isRecoveryAttemptPost=0&i13=0&login=${this.email}&loginfmt=${this.email}&type=11&LoginOptions=3&lrt=&lrtPartition=&hisRegion=&hisScaleUnit=&passwd=${this.password}`;
        
        response = await axios.post(urlStay, data, { headers });
        ppft = response.data.match(/sFT:'(.*?)'/)[1];
        let urlPost = response.data.match(/urlPost:'(.*?)'/)[1];

        let postData = {
            "LoginOptions": "1",
            "type": "28",
            'ctx': '',
            'hpgrequestid': '',
            'PPFT': ppft,
            'canary': ''
        };

        response = await this.post(urlPost, postData);

        let nap = response.data.match(/id="NAP" value="(.*?)"/)[1];
        let anon = response.data.match(/id="ANON" value="(.*?)"/)[1];
        let anonExp = response.data.match(/id="ANONExp" value="(.*?)"/)[1];
        let wlssc = response.data.match(/id="t" value="(.*?)"/)[1];
        let NAPExp = response.data.match(/id="NAPExp" value="(.*?)"/)[1];
        let pprid = response.headers['set-cookie'].find(c => c.startsWith('MSPCID')).split(';')[0].split('=')[1];

        let urlOwa = response.data.match(/action="(.*?)"/)[1];
        
        let finalData = {
            'NAPExp': NAPExp,
            'wbids': '0',
            'pprid': pprid,
            'wbid': 'MSFT',
            'NAP': nap,
            'ANON': anon,
            'ANONExp': anonExp,
            't': wlssc
        };

        await this.session.post(urlOwa, finalData);
        console.log("Sent pop3");
        return true;

    } catch (error) {
        console.error(error);
        return false;
    }
}

    async registerAccount() {
        try {
            const headers = {
                'accept': 'application/json',
                'accept-language': 'vi,vi-VN;q=0.9,en-US;q=0.8,en;q=0.7',
                'canary': this.apiCanary,
                'client-request-id': this.uaid,
                'content-type': 'application/json; charset=utf-8',
                'correlationid': this.uaid,
                'hpgact': '0',
                'hpgid': this.hpgid,
                'origin': 'https://signup.live.com',
                'priority': 'u=1, i',
                'referer': 'https://signup.live.com/?lic=1',
                'sec-ch-ua': '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                "cookie": this.cookies,

            };

            const params = { lic: '1' };
            let account_info = this.accountInfoGeneration()
            let json_data = {
                ...account_info,
                'EvictionWarningShown': [],
                "UpgradeFlowToken": {},
                'IsRDM': false,
                'IsOptOutEmailDefault': true,
                'IsOptOutEmailShown': 1,
                'IsOptOutEmail': true,
                'LW': 1,
                'RequestTimeStamp': moment.utc().format("YYYY-MM-DDTHH:mm:ss.SSS[Z]"),
                'ReturnUrl': null,
                'SignupReturnUrl': null,
                'SuggestedAccountType': 'EASI',
                'SiteId': this.sSiteId,
                'VerificationCode': null,
                'VerificationCodeSlt': null,
                'WReply': null,
                'MemberNameChangeCount': 1,
                'MemberNameAvailableCount': 1,
                'MemberNameUnavailableCount': 0,
                'CipherValue': encrypt(this.password, this.randomNum, this.Key),
                'SKI': this.SKI,
                'Password': this.password,
                'uiflvr': this.iUiFlavor,
                'scid': this.iScenarioId,
                'uaid': this.uaid,
                'hpgid': this.hpgid,
            };
            headers.Cookie = this.cookies
            const res = await this.session.post('https://signup.live.com/API/CreateAccount', json_data, {
                params: params,
                headers: headers,
            });
            this.updateCookies(res)

            let arkoseBlob
            let RiskAssessmentDetails
            if (res.data.error) {
                const error_data = res.data.error;
                arkoseBlob = "", RiskAssessmentDetails = "";

                if (error_data.telemetryContext) {
                    const data = JSON.parse(error_data.data || "{}");

                    RiskAssessmentDetails = data.riskAssessmentDetails;
                    arkoseBlob = data.arkoseBlob;

                    this.log("arkoseBlob", arkoseBlob.length);

                }
            } else {
                return false;
            }
            if (!arkoseBlob) {
                throw new Error("No arkoseBlob")
            }
            this.log("sent API 1");

            for (let i = 0; i < 10; i++) {
                const tc = Date.now();
                const solution = await solvecap(arkoseBlob, this.key_captcha, this);
                this.log("solution");

                if (!solution) {
                    this.log("No solution")
                    return false
                }

                this.log(`Solved captcha | ${(Date.now() - tc) / 1000}s`);

                const formatted_time = moment.utc().format("YYYY-MM-DDTHH:mm:ss.SSS[Z]");
                const data = {
                    ...json_data,
                    "RequestTimeStamp": formatted_time,
                    "MemberName": this.email,
                    "CheckAvailStateMap": [`${this.email}:false`],
                    "Password": this.password,
                    "CipherValue": encrypt(this.password, this.randomNum, this.Key),
                    "SKI": this.SKI,
                    "IsUserConsentedToChinaPIPL": false,
                    "Country": "VN",
                    "IsOptOutEmailDefault": true,
                    "PrefillMemberNamePassed": true,
                    "LW": 1,
                    "SiteId": this.sSiteId,
                    "uiflvr": this.iUiFlavor,
                    "uaid": this.uaid,
                    "HFId": this.sHipFid,
                    "HType": "enforcement",
                    "HSol": solution,
                    "scid": this.iScenarioId,
                    "HPId": "B7D8911C-5CC8-A9A3-35B0-554ACEE604DA",
                    "RiskAssessmentDetails": RiskAssessmentDetails,

                };
                headers.cookie = this.cookies

                const d = await this.session.post(
                    "https://signup.live.com/API/CreateAccount", data,
                    {
                        params: params,
                        headers: headers
                    }
                );

                this.updateCookies(d)

                if (!d.data.error) {
                    this.redirect_url = d.redirectUrl;
                    this.slt = d.slt;
                    this.log(`${this.email}:${this.password} | Sign up successfully`);
                    return true;
                    break;
                }
            }
            this.log("Signup fail");
            return false;

        } catch (error) {
            this.log("Error during account registration:"+ error.message);
            return false;
        }
    }
    async register() {
        try {
            let status
            let t = Date.now()
            this.log("Start ...")
            let init = await this.init()
            await this.EvaluateExperimentAssignments()
            await this.fpt()
            await this.checkUser()
            if (await this.registerAccount()) {
                let { email, password} = this
                await this.pop3()

                return { email, password}
            }


            return false
        } catch (e) {
            this.log("Error reg", e)
            return false
        }

    }
}
export default Outlook
// // Example usage
// (async () => {
//     try {
//         const outlook = new Outlook();
//         const homeData = await outlook.init(); // Initialize the signup process and get home data
//         await outlook.fetchDataHome(homeData); // Parse and store important params
//         await outlook.evaluateExperimentAssignments(); // Evaluate experiments
//         await outlook.registerAccount(); // Register an account
//     } catch (error) {
//         console.error("Error during the signup process:", error);
//     }
// })();
