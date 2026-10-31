import axios from 'axios';
import os from 'os';
import fetch from "node-fetch"
import { HttpsProxyAgent } from 'https-proxy-agent';
import { config } from './config.js';
import imaps  from 'imap-simple';
import _ from 'lodash';
import { readFile, writeFile,appendFile,access, open,mkdir } from 'fs/promises';
import {simpleParser} from 'mailparser';
import crypto from 'crypto';
import helper from './helper.pup.js';
import { existsSync, mkdirSync } from 'fs';
import { resolve,dirname } from 'path';
export function extractProxy(proxy){
    const [account, server] = proxy.split('@');
    const [host, port] = server.split(':');
    const [username, password] = account.split(':');

    return {
        host,
        port,
        username,
        password
    }
}

export function generateProxy(sessionTime){
    // return 'vrHtWvHqTgK8AVIp:iLjKMQiuMmntrjE3_country-ge_session-'+ generateRandomHex(8) +'_lifetime-5m@geo.iproyal.com:12321'
    // return 'vrHtWvHqTgK8AVIp:iLjKMQiuMmntrjE3_country-kr_session-'+ generateRandomHex(8) +'_lifetime-5m@geo.iproyal.com:12321'
    // return 'vrHtWvHqTgK8AVIp:iLjKMQiuMmntrjE3_country-es_session-'+ generateRandomHex(8) +'_lifetime-5m@geo.iproyal.com:12321'
    return 'vrHtWvHqTgK8AVIp:iLjKMQiuMmntrjE3_session-'+ generateRandomHex(8) +'_lifetime-5m@geo.iproyal.com:12321'
    const prefixes = [
        'babalili121415-zone-resi-region-sa-st-jazanregion-session-',
        'babalili121415-zone-resi-region-ae-session-'
        // 'babalili121415-zone-resi-session-',
        // 'babalili121415-zone-resi-region-jo-session-',
        // 'babalili121415-zone-resi-region-jo-st-irbid-session-'
    ]

    const suffixes = `-sessTime-${sessionTime}:Tabdajkhsdf13235@b35301d43d682c1a.xuw.as.pyproxy.io:16666`;

    return prefixes[Math.floor(Math.random() * prefixes.length)] + generateRandomHex(12) + suffixes;
}

export function generateRandomHex(length) {
    let result = '';
    const characters = 'abcdef0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

export function generateRandomName(length) {
    const characters = 'abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

export function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateRandomDOB() {
    const year = getRandomInt(1981, 1995).toString();
    const month = getRandomInt(1, 12).toString();
    let day;
    if (month === '2') {
        day = getRandomInt(1, 28).toString();
    } else if (['4', '6', '9', '11'].includes(month)) {
        day = getRandomInt(1, 30).toString();
    } else {
        // Other months
        day = getRandomInt(1, 31).toString();
    }
    return { day, month, year };
}

export function generateRandomPassword(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        password += characters.charAt(randomIndex);
    }
    return password;
}

export async function getGologinProxy() {
    let regions = ["AE", "SA", "ID"]
    regions = ["SA"]
    let url = "https://api.gologin.com/users-proxies/mobile-proxy"
    let headers = {
        "Authorization": "Bearer " + config.GOLOGIN_API_TOKEN,
        "Content-Type": "application/json"
    }

    return await axios.post(url, {
        "browserId": "",
        "countryCode": regions[Math.floor(Math.random() * regions.length)],
        "isDC": true,
        "isMobile": false
    }, {headers})
    
}
export async function makeRequest(options){
    let {
        url, headers, method = 'get', proxy, retryCount = 0, body, timeout = 10000,
        retryTime = 2, retryAfter = 1000, proxy_list, form, preCheckRetry, name, isGetBody = true, isRetry = true
    } = options;

    const makeAxiosCall = async () => {
        try {
            const axiosOptions = {
                url,
                method: method.toUpperCase(),
                headers,
                timeout,
                data: form ? form : body,
                ...(proxy && { proxy: {
                    host: proxy.host,
                    port: proxy.port,
                    auth: {
                        username: proxy.username,
                        password: proxy.password
                    }
                }})
            };

            const response = await axios(axiosOptions);
            return { body: JSON.stringify(response.data), headers: response.headers, status: response.status };

        } catch (error) {
            return { error: error.message, body: "", headers: {}, status: null };
        }
    };

    let result = await makeAxiosCall();
    let bodyJson = {};
    try { bodyJson = JSON.parse(result.body); } catch (e) { }
    result.bodyJson = bodyJson;
// console.log(result)
    let isRetryPreCheck = false;
    if (typeof preCheckRetry === 'function' && result.body) {
        try {
            isRetryPreCheck = await preCheckRetry(result.body, bodyJson);
        } catch (e) {
            console.log("err pre", e);
        }
    }

    if (isRetryPreCheck || result.error || (!result.body && isGetBody)) {
        if (retryCount < retryTime && isRetry) {
            if (proxy_list && proxy_list.length > 0) {
                options.proxy = proxy_list[Math.floor(Math.random() * proxy_list.length)];
            }
            retryCount++;
            options.retryCount = retryCount;
            await new Promise(resolve => setTimeout(resolve, retryAfter));
            return await makeRequest(options);
        } else {
            console.log("retry maxtime request custom");
        }
        return result;
    }

    return result;
}
export async function getcodeVery(user, password, code_length){
    var globalval = {}
    var mail_die = false;
    var config = {
        imap: {
            user: user,
            password: password,
            host: 'outlook.office365.com',
            port: 993,
            tlsOptions : {
              rejectUnauthorized: false,
            },
            tls: true,
            authTimeout: 20000
        }
    };
    // 
    return new Promise((resolve,reject) => {
        setTimeout(function(){
            getCodeBegin(0, 5, function(code){
                if(code != ''){
                    globalval.code_otp = code;
                }else{
                }
                return resolve(code);
            })
        }, 1000)
        
     })
    
    async function getCodeBegin(min, max, callback){
        globalval.otp_time = min;
        if(min > max || mail_die){
            callback('');
        }else{
            getCode(function(dataPayment){
                    var code = '';
                    if(dataPayment.length && dataPayment[dataPayment.length-1].code){
                      code = dataPayment[dataPayment.length-1].code.trim();
                    }
                    if(code == ''){
                        min++;
                        setTimeout(function(){
                            getCodeBegin(min, max, callback);
                        }, 7000)
                    }else{
                        callback(code);
                    }
                    // censele.log('ok',code)
                })
        }
    }
    function getCodeFromText(text, key_begin, key_end){
      var code = getString(text,key_begin,key_end);
      if(code && code != "" && code.indexOf(key_begin) > -1){
        return getCodeFromText(code+key_end, key_begin, key_end);
      }else{
        return code;
      }
    }
    function getCode(callback){
        var dataPayment = [];
        try{
          imaps.connect(config)
          .then(function (connection) {

            connection.openBox('INBOX').then(function () {

                // Fetch emails from the last 24h
                // var delay = 7 * 3600 * 1000-7*60*60*1000;
                var delay = 7*60*60*1000;
                var yesterday = new Date();
                yesterday.setTime(Date.now() - delay);
                yesterday = yesterday.toISOString();
                // censele.log(yesterday)
                var searchCriteria = ['UNSEEN', ['SINCE', yesterday]];
                var fetchOptions = { bodies: ['HEADER', 'TEXT', '']};

                // retrieve only the headers of the messages
                return connection.search(searchCriteria, fetchOptions);
            }).then(function (messages) {
                // censele.log('messages',messages)
                var number_complete = 0;
                if(messages.length == 0){
                    connection.imap.closeBox(true, (err) => {
                        if (err){
                        }
                    });
                    connection.end();
                }else{
                    // messages = [messages[messages.length-1]]
                }
                messages.forEach(function (item) {
                    var all = _.find(item.parts, { "which": "" })
                    var id = item.attributes.uid;
                    var idHeader = "Imap-Id: "+id+"\r\n";
                    simpleParser(idHeader+all.body, (err, mail) => {
                        number_complete++;
                        // access to the whole mail object
                            // console.log(mail.from.text,mail.text)//subject
                        // if((true || mail.from.text.indexOf('account.tiktok.com') > -1)){
                        if((mail.from.text.includes('tiktok'))){
                            var code = ""
                            try{
                                code = mail.subject.match(/\d+/)[0];
                            }catch(e){
                                console.log(mail.subject,mail.from.text)
                            }
                            

                   
                            var array_code_exac = code
                              console.log('Detected code',array_code_exac)
                              if(array_code_exac != '' && dataPayment.length == 0){
                                  dataPayment.push({
                                    code: array_code_exac
                                  })
                              }
                            // connection.append(item.toString(), {mailbox: 'Drafts', flags: '\\Draft'});
                        }
                        if(number_complete == messages.length){
                            // return Promise.all(dataPayment);
                            // censele.log('dataPayment',dataPayment)
                            connection.imap.closeBox(true, (err) => {
                                if (err){
                                    console.log(err);
                                }
                            });
                            connection.end();
                             // callback(dataPayment);
                            // return Promise.all(dataPayment);
                        }
                        
                    });
                });
                
            })
            connection.once('end', function() {
            // censele.log('Connection ended');
              if(dataPayment.length > 0){
                callback(dataPayment)
              }else{
                console.log("Chưa có code");
              callback(dataPayment)
              }
          });
        }).then(function(e){
            // censele.log('hihi2',e)
            // callback(dataPayment)
        })
        .catch(function(e){
            if(e.toString().indexOf('User is authenticated but not connected.') > -1){
                console.log('User is authenticated but not connected.')
                // mail_die = true;
            }else if(e.toString().indexOf('Account is blocked. Login to your account via') > -1){
                console.log('Account is blocked. Login to your account via')
            }else if(e.toString().indexOf('LOGIN failed') > -1){
                console.log('LOGIN failed')
                mail_die = true
            }
            console.log(e)
            // censele.log(config)
            callback(dataPayment)
        })
          
        }catch(e){
            console.log(e)
             callback(dataPayment)
            // return Promise.all(dataPayment);
        }
    }
}
export async function loadJsonFile(filePath) {
  try {
    let data = await readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to read JSON file:', error);
    return false;  // Hoặc xử lý lỗi theo cách khác
  }
}
export async function appendContentToFile(filePath, content) {
    try {
        await appendFile(filePath, content);
        // console.log('Content appended successfully!');
    } catch (error) {
        console.error('Error appending content to file:', error);
    }
}
export async function ensureFileExists(filePath) {
    try {
        // Check if file exists
        await access(filePath);
        // console.log('File exists.');
    } catch (error) {
        // If the file does not exist, error will be thrown
        console.log('File does not exist. Creating file...');
        try {
            // Create a new file with an empty content
            const fileHandle = await open(filePath, 'w');
            await fileHandle.close();
            console.log('File created successfully.');
        } catch (createError) {
            console.error('Error creating file:', createError);
        }
    }
}
export async function createDirectoryIfNotExists(dirPath) {
    try {
        // Tạo thư mục với tùy chọn recursive để tạo tất cả thư mục cha nếu cần
        await mkdir(dirPath, { recursive: true });
        // console.log(`Directory created or already exists at ${dirPath}`);
    } catch (error) {
        console.error(`Error creating directory at ${dirPath}:`, error);
    }
}
export async function getProxyView1() {
    const headers = {
        "User-Agent": '',
        'Cookie': '',
        "Authorization": "Basic a2llbmFkbWluOkFiY0AyMDUw",
    };
    //const url = 'http://bupview.ddns.net:13000/v2/eth_get_proxy_list?page=1&limit=60&sort=%2Bid';
	const url ='http://xprxs15.ddns.net:17000/v2/eth_get_proxy_list?page=1&limit=60&sort=%2Bid'
    try {
        const response = await axios.get(url, {
            headers: headers,
            timeout: 60000
        });
        const data = response.data;
        let list_order = [];
        if (data && data.data) {
            for (let i = 0; i < data.data.length; i++) {
                if (!data.data[i].adsl_failed && data.data[i].public_ip && data.data[i].public_ip.indexOf('.') > -1) {
                    list_order.push('http://amac~ala:Sonetrend817@xprxs15.ddns.net:' + data.data[i].proxy_port);
                }
            }
        }
        return list_order;
    } catch (error) {
        console.error('Error encountered, retrieving proxies from backup method:', error);
        return []
    }
}
export async function getProxyKey() {
    let list_order = [];
    let domain = '27.75.111.24'
    domain = 'xprxs15.ddns.net'
    const headers = {
        "User-Agent": '',
        "Cookie": '',
    };
    const url = 'http://217.15.163.20:8549/api/cron/getliveproxies?authensone=mysonetrend&time=300';

    try {
        const response = await axios.get(url, {
            headers: headers,
            json: true,
            timeout: 20000 // 60000ms = 60 giây
        });

        const data = response.data;
        // console.log("getProxyKey",data)
        if (data && data.proxies) {
            for (let i = 0; i < data.proxies.length; i++) {
                const item = data.proxies[i];
                list_order.push('http://'+item)
            }
        }

        return list_order;

    } catch (error) {
        return list_order;
    }
}
export async function getProxyView() {
    let list_order = [];
    let domain = '27.75.111.24'
    domain = 'xprxs15.ddns.net'
    const headers = {
        "User-Agent": '',
        "Cookie": '',
        "Authorization": "Basic a2llbmFkbWluOkFiY0AyMDUw",
    };
    const url = 'http://'+domain+':17000/v2/eth_get_proxy_list?page=1&limit=60&sort=%2Bid';

    try {
        const response = await axios.get(url, {
            headers: headers,
            timeout: 20000 // 60000ms = 60 giây
        });

        const data = response.data;

        if (data && data.data) {
            for (let i = 0; i < data.data.length; i++) {
                const item = data.data[i];
                if (!item.adsl_failed && item.public_ip && item.public_ip.includes('.')) {
                    list_order.push('http://amac~ala:Sonetrend817@'+domain+':' + item.proxy_port);
                }
            }
        }

        return list_order;

    } catch (error) {
        return list_order;
        // if (error.code === 'ECONNABORTED') {
        //     throw new Error('Request timed out');
        // } else {
        //     throw error;
        // }
    }
}
export async function sendMessageTeleConfig(config) {
    const data_tele = {
        token: config.token,
        chat_id: config.chat_id,
        message: config.message,
    };
    const headers = {
        "User-Agent": 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };
    const url = `https://api.telegram.org/bot${data_tele.token}/sendMessage?chat_id=${data_tele.chat_id}&text=${encodeURIComponent(data_tele.message)}`;

    try {
        const response = await axios.get(url, { headers });
        return response.data;
    } catch (error) {
        console.error('Error:', error);
        return '';
    }
}
export async function writeFileAppend(filePath, content){
    try {
        await appendFile(filePath, content);
        // console.log('Content appended successfully!');
    } catch (error) {
        console.log('Error appending content to file:', error);
    }
    // return await new Promise(r=>{
    //     fs.appendFile(pathFile, data,(e)=>{
    //         return r()
    //     })
    // })
}
export async function sendAccountToPanel(data_account) {
    let data_post = data_account;
    const url_account = `http://acc2.amazingcpanel.com/api/receive-account-gmail`;
    
    let response;
    let attempt = 0;
    while (attempt < 3) {
        try {
            response = await axios.post(url_account, {
                account: data_post
            });
            
            
            break; // Nếu thành công, thoát khỏi vòng lặp
        } catch (error) {
            attempt++; // Tăng biến đếm
            console.error(`Attempt ${attempt}:`, error);
            if (attempt === 3) {
                await writeFileAppend("./reg_accounts.txt",JSON.stringify(data_post)+", ")
                console.error('Failed afterc 3 attempts');
                // Xử lý thêm khi không thành công sau 3 lần
            }else{
                await helper.delay(2000);
            }

        }
    }
}
export function parserProxyString (proxystring) {
    proxystring = proxystring || ""
    let authInfoI = ""
    let proxyAddressI = proxystring
    proxystring = proxystring.replace("https://","").replace("http://","")
    if((proxystring||"").includes("@")) {
      const [authInfo, proxyAddress] = proxystring.split('@');
      proxyAddressI = proxyAddress;
      authInfoI = authInfo
    }
    const [username, password] = authInfoI.split(':');
    const [host, port] = proxyAddressI.split(':');
    if(port && host)
    return  {"protocol":"http",username,password,host,port}
}
export async function updateAccountToPanel(data_account) {
    let data_post = {
        url: data_account.url,
        cookie: data_account.cookie
    };
    const url_account = `http://acc2.amazingcpanel.com/api/accounts/updateAccountGoogle?email=${data_account.email}`;
    let response;
    let attempt = 0;
    while (attempt < 3) {
        try {
            response = await axios.post(url_account, {
                url: data_account.url,
                cookie: data_account.cookie,
                cookies: data_account.cookies
            });
            
            
            break; // Nếu thành công, thoát khỏi vòng lặp
        } catch (error) {
            attempt++; // Tăng biến đếm
            console.error(`Attempt ${attempt}:`, error);
            if (attempt === 3) {
                console.error('Failed afterc 3 attempts');
                // Xử lý thêm khi không thành công sau 3 lần
            }
        }
    }
}
export async function moveAccountToPanel(category_to,accounts) {
    let data_post = {
        category_to: category_to,
        accounts: accounts
    };
    const url_account = `http://acc2.amazingcpanel.com/api/accounts/move-email-to-category`;
    let response;
    let attempt = 0;
    while (attempt < 3) {
        try {
            response = await axios.post(url_account, data_post);
            
            
            break; // Nếu thành công, thoát khỏi vòng lặp
        } catch (error) {
            attempt++; // Tăng biến đếm
            console.error(`Attempt ${attempt}:`, error);
            if (attempt === 3) {
                console.error('Failed afterc 3 attempts');
                // Xử lý thêm khi không thành công sau 3 lần
            }
        }
    }
}
export function encryptJson(jsonData, password) {
    const jsonStr = JSON.stringify(jsonData);
    const key = crypto.scryptSync(password, 'salt', 32); // Tạo khóa từ mật khẩu
    const iv = crypto.randomBytes(16); // Tạo IV ngẫu nhiên
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(jsonStr, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return `${iv.toString('base64')}:${encrypted}`;
}

// Hàm giải mã JSON
export function decryptJson(encryptedData, password) {
    try{
        const [ivBase64, encryptedText] = encryptedData.split(':');
        const key = crypto.scryptSync(password, 'salt', 32); // Tạo khóa từ mật khẩu
        const iv = Buffer.from(ivBase64, 'base64');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    }catch(e){
        return false
    }
    
}
export function getTimeNow() {
  // Thiết lập đối tượng Date theo múi giờ Việt Nam
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  
  // Định dạng giờ, phút, giây
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  // Trả về chuỗi thời gian đã định dạng
  return (`[${hours}:${minutes}:${seconds}]`);
}
export async function getInitGmail({cookie_string}){
  try {
    let res = await axios.get("https://mail.google.com/mail/u/0/?sw=2#all",{
        headers :{
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'accept-language': 'vi',
                'cache-control': 'no-cache',
                'cookie': cookie_string,
                'dnt': '1',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'none',
                'upgrade-insecure-requests': '1',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
            }
    })
    let bodyHtml = res.data;
    let [grge, data_link] = /id="embedded_data_iframe" src="(.*?)"/.exec(bodyHtml) || []
    data_link= data_link.replaceAll('&amp;','&')
    let [gewr, sdpc] = /"sdpc","(.*?)"/.exec(bodyHtml) || []
    let [t, GM_ID_KEY] = /GM_ID_KEY = '(.*?)'/.exec(bodyHtml) || []
    let [t2, date_p] = /pinto-server_(.*?)"/.exec(bodyHtml) || []



    return {data_link,sdpc,GM_ID_KEY,date_p}
  } catch(e){

    console.log("error getInitGmail",e)
    return  {e}

  }
   
}
export async function getMessagesGmail(url, cookie_string){
    try {
        let headers = {
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'accept-language': 'vi',
            'cache-control': 'no-cache',
            'cookie': cookie_string,
            'dnt': '1',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'none',
            'upgrade-insecure-requests': '1',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
          }
        const response = await axios.get(url, {
          headers: headers
        });
        let messages = parseMessagesGmail(response.data)
        return messages;
    } catch (error) {
        console.error('Error:', error);
        return false;
    }
}
function extractUrls(text) {
    // Regex tìm kiếm URL
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    // Tìm tất cả URL trong văn bản
    const urls = text.match(urlRegex);

    // Nếu không tìm thấy URL, trả về mảng rỗng
    return urls || [];
}
export function getUrlActive(message){
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = message.data_html_text.match(urlRegex);
    if (!urls) return ""; // Nếu không tìm thấy URL, trả về mảng rỗng
    urls.map(url =>
        url
            .replace(/&amp;/g, '&') // Thay &amp; thành &
            .replace(/&#39;/g, "'") // Thay &#39; thành '
            .replace(/&quot;/g, '"') // Thay &quot; thành "
            .replace(/&lt;/g, '<') // Thay &lt; thành <
            .replace(/&gt;/g, '>') // Thay &gt; thành >
    );
    return urls[0]
    // switch(message.display.toLowerCase()) {
    //     case "facebook":
    //         break;
    //     case "reverso":

    //         break;
    //     default:
            
    // }
    // return ""
}
export function getTextFromHtml(htmlContent) {
    // Loại bỏ tất cả các thẻ script, style và nội dung của chúng
    htmlContent = htmlContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    htmlContent = htmlContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

    // Loại bỏ tất cả các thẻ HTML khác
    const text = htmlContent.replace(/<[^>]*>/g, '');

    // Loại bỏ khoảng trắng thừa và xuống dòng không cần thiết
    return text.replace(/\s+/g, ' ').trim();
}
export async function parserMesssageHtml({messages, cookie_string,sdpc,GM_ID_KEY,date_p}){
    try {
  let body_post = messages.map(i=>{
            let [t,id]= i.threadid.split(":")
            return  [
                "thread-f:"+id,
                null,
                [
                  "msg-f:"+id
                ]
              ]
    
        })
        let data = JSON.stringify([body_post,2]);

    let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://mail.google.com/sync/u/0/i/fd?hl=vi&c=18&rt=r&pt=ji',
    headers: { 
        'accept': '*/*', 
        'accept-language': 'vi,en-US;q=0.9,en;q=0.8,vi-VN;q=0.7', 
        'cache-control': 'no-cache', 
        'content-type': 'application/json', 
        'cookie': cookie_string, 
        'dnt': '1', 
        'origin': 'https://mail.google.com', 
        'pragma': 'no-cache', 
        'priority': 'u=1, i', 
        'referer': 'https://mail.google.com/mail/u/0/', 
        'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"', 
        'sec-ch-ua-arch': '"arm"', 
        'sec-ch-ua-bitness': '"64"', 
        'sec-ch-ua-full-version': '"131.0.6778.109"', 
        'sec-ch-ua-full-version-list': '"Google Chrome";v="131.0.6778.109", "Chromium";v="131.0.6778.109", "Not_A Brand";v="24.0.0.0"', 
        'sec-ch-ua-mobile': '?0', 
        'sec-ch-ua-model': '""', 
        'sec-ch-ua-platform': '"macOS"', 
        'sec-ch-ua-platform-version': '"15.0.0"', 
        'sec-ch-ua-wow64': '?0', 
        'sec-fetch-dest': 'empty', 
        'sec-fetch-mode': 'cors', 
        'sec-fetch-site': 'same-origin', 
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', 


        'x-framework-xsrf-token': sdpc, 
        'x-gmail-btai': '[null,null,[null,null,null,null,null,null,null,null,null,1,null,null,1,null,0,1,1,0,1,null,null,1,1,1,1,1,1,1,0,1,1,1,1,1,0,1,"vi","Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",1,0,25,null,0,1,0,1,1,1,1,1,null,1,1,0,1,1,0,0,null,0,1,null,1,0,null,null,0,null,1,0,1,1,null,0,0,null,null,null,1,100,1,1,0,1,0,null,0,1,0,1,1,null,null,0,1,1,0,1,0,0,0,0],null,"'+GM_ID_KEY+'",null,25,"gmail.pinto-server_'+date_p+'",1,5,"",25200000,"+07:00",null,null,702735795,"","",1733821461030,null,1869458]', 
        
        'x-google-btd': '1'
    },
    data : data
    };


    const response = await axios.request(config);
    let datas = (response.data);
    if(datas[1]?.length){
        datas[1].forEach(i=>{
            try {
                let [threadid, n, contens] = i

                let data_html = contens[0][1][5][1][0][2][1]
                let index = messages.findIndex(item=>item.threadid == threadid);
                if(index>=-1){
                    messages[index].data_html = data_html
                }
            } catch(e){

            }
          
        })
    }
    
       
    } catch(e){
        console.log("error parserMessageHtml",e)
    }
    return messages


}
export async function deleteEmail(params) {
    let  {threadid, cookie_string} = params;
    let initData = await getInitGmail({cookie_string})
    let result = await deleteOneEmail({cookie_string, threadid, ...initData})
    return result
}
export async function deleteOneEmail({threadid, cookie_string,sdpc,GM_ID_KEY,date_p}){
    try {
  let body_post = JSON.stringify([
    null,
    [
      [
        [
          2,
          [
            `thread-f:${threadid}`,
            [
              null,
              null,
              null,
              null,
              null,
              null,
              [
                [
                  "^io_lr"
                ],
                null,
                [
                  `msg-f:${threadid}`
                ],
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                [
                  "^sq_ig_i_personal",
                  [
                    ""
                  ],
                  [
                    "^smartlabel_notification"
                  ]
                ]
              ]
            ]
          ]
        ],
        [
          3,
          [
            `thread-f:${threadid}`,
            [
              null,
              null,
              null,
              null,
              null,
              null,
              [
                [
                  "^k"
                ],
                [
                  "^ri_hl",
                  "^i",
                  "^iim",
                  "^t_p",
                  "^t_rd",
                  "^us",
                  "^s",
                  "^a",
                  "^t_z",
                  "^afw"
                ],
                [
                  `msg-f:${threadid}`
                ],
                1735800546620,
                null,
                null,
                null,
                null,
                [
                  1735800546617,
                  null,
                  null,
                  12
                ],
                null,
                null,
                [
                  "^sq_ig_i_personal",
                  [
                    ""
                  ],
                  [
                    "^smartlabel_notification"
                  ]
                ]
              ]
            ]
          ]
        ]
      ]
    ],
    [
      1,
      9910,
      null,
      null,
      [
        null,
        0
      ],
      null,
      1
    ],
    [
      1735800386666,
      2,
      1735800388421,
      0,
      112
    ],
    2
  ])

    let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://mail.google.com/sync/u/0/i/s?hl=vi&c=11&rt=r&pt=ji',
    headers: { 
        'accept': '*/*', 
        'accept-language': 'vi,en-US;q=0.9,en;q=0.8,vi-VN;q=0.7', 
        'cache-control': 'no-cache', 
        'content-type': 'application/json', 
        'cookie': cookie_string, 
        'dnt': '1', 
        'origin': 'https://mail.google.com', 
        'pragma': 'no-cache', 
        'priority': 'u=1, i', 
        'referer': 'https://mail.google.com/mail/u/0/', 
        'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"', 
        'sec-ch-ua-arch': '"arm"', 
        'sec-ch-ua-bitness': '"64"', 
        'sec-ch-ua-full-version': '"131.0.6778.109"', 
        'sec-ch-ua-full-version-list': '"Google Chrome";v="131.0.6778.109", "Chromium";v="131.0.6778.109", "Not_A Brand";v="24.0.0.0"', 
        'sec-ch-ua-mobile': '?0', 
        'sec-ch-ua-model': '""', 
        'sec-ch-ua-platform': '"macOS"', 
        'sec-ch-ua-platform-version': '"15.0.0"', 
        'sec-ch-ua-wow64': '?0', 
        'sec-fetch-dest': 'empty', 
        'sec-fetch-mode': 'cors', 
        'sec-fetch-site': 'same-origin', 
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', 


        'x-framework-xsrf-token': sdpc, 
        'x-gmail-btai': '[null,null,[null,null,null,null,null,null,null,null,null,1,null,null,1,null,0,1,1,0,1,null,null,1,1,1,1,1,1,1,0,1,1,1,1,1,0,1,"vi","Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",1,0,25,null,0,1,0,1,1,1,1,1,null,1,1,0,1,1,0,0,null,0,1,null,1,0,null,null,0,null,1,0,1,1,null,0,0,null,null,null,1,100,1,1,0,1,0,null,0,1,0,1,1,null,null,0,1,1,0,1,0,0,0,0],null,"'+GM_ID_KEY+'",null,25,"gmail.pinto-server_'+date_p+'",1,5,"",25200000,"+07:00",null,null,702735795,"","",1733821461030,null,1869458]', 
        
        'x-google-btd': '1'
    },
    data : body_post
    };


    const response = await axios.request(config);
   let data = await response.data;
    if(data.includes("thread-f:")){
        return true
    }
    
       
    } catch(e){
        console.log("error deleteOneEmail",e)
    }
    return false


}
export function getLocalIP() {
    try{
        const networkInterfaces = os.networkInterfaces();
        const ips = [];

        for (const interfaceName in networkInterfaces) {
            const interfaceInfo = networkInterfaces[interfaceName];

            if (interfaceInfo) {
                interfaceInfo.forEach((info) => {
                    if (info.family === 'IPv4' && !info.internal) {
                        ips.push(info.address);
                    }
                });
            }
        }
        if(ips.length) return ips[0];
    }catch(e){}
    return ""
}


export async function getNumberGmailNeedReg(){
    try {
        const response = await axios.get(`https://api.otp.cheap/stubs/action/accountneededtotal`);
        return response.data
        // if(response.data.count > 0){
        //     return response.data.count
        // }else if(response.data.count_sell > 0){
        //     return response.data.count_sell
        // }
        
    }catch(e){}
    return 0
}
export async function getEnableRegGmail(){
    try {
        const response = await axios.get(`http://amazingcpanel.com/api/cron/getconfig?authensone=mysonetrend&config=gmail_enable`);
        return response.data.data
        // if(response.data.count > 0){
        //     return response.data.count
        // }else if(response.data.count_sell > 0){
        //     return response.data.count_sell
        // }
        
    }catch(e){}
    return 0
}
export async function getEnableOTpSupper(){
    try {
        const response = await axios.get(`http://amazingcpanel.com/api/cron/getconfig?authensone=mysonetrend&config=otp_enable`);
        return response.data.data
        // if(response.data.count > 0){
        //     return response.data.count
        // }else if(response.data.count_sell > 0){
        //     return response.data.count_sell
        // }
        
    }catch(e){}
    return 0
}
export async function setEnableOTpSupper(value){
    try {
        const response = await axios.post('http://amazingcpanel.com/api/cron/setconfig?authensone=mysonetrend&config=otp_enable', {
                config: "otp_enable",
                data: value
        });
        // const response = await axios.get(`http://amazingcpanel.com/api/cron/getconfig?authensone=mysonetrend&config=otp_enable`);
        return response.data
        // if(response.data.count > 0){
        //     return response.data.count
        // }else if(response.data.count_sell > 0){
        //     return response.data.count_sell
        // }
        
    }catch(e){}
    return 0
}
export async function getAccountService(service){
    try {
        const response = await axios.get(`http://a1.amazingcpanel.com/api/accounts/countByCategoriesService?category=GMAIL_OTP&status=1&service=${service}`);
        return response.data
        // if(response.data.count > 0){
        //     return response.data.count
        // }else if(response.data.count_sell > 0){
        //     return response.data.count_sell
        // }
        
    }catch(e){}
    return 0
}

export async function getAccountGmail(category){
    try {
        const response = await axios.get(`http://a1.amazingcpanel.com/api/accounts/countByCategoriesService?category=${category}&status=1`);
        return response.data
        // if(response.data.count > 0){
        //     return response.data.count
        // }else if(response.data.count_sell > 0){
        //     return response.data.count_sell
        // }
        
    }catch(e){}
    return 0
}

export async function getNumberGmailNeedRegDodo(){
    const speedMap = {
        "slow": 10,
        "medium": 20,
        "fast": 30
    }

    try {
        const response = await axios.get(`https://api.otp.cheap/v2/stubs/action/status?email=dododoguyguyswag@pm.me`);
        const data = response.data;
        const enableReg = data.enableReg;
        const speed = data.speed;

        if (enableReg) {
            const count = data.remains >= speedMap[speed] ? speedMap[speed] : data.remains;
            return {"count_otp":0, "count_sell":0, "count_sell_no_cookies": count, "count_waiting_codes": 0}
        } else {
            return {"count_otp":0, "count_sell":0, "count_sell_no_cookies": 0, "count_waiting_codes": 0}
        }
        
    }catch(e){}
    return 0
}

export async function makeRequestFetch(url ,options){
    options.current = options.current || 0
    try {
        let data = await fetch (url, options);
        if(!data.status || !data.status >=400 ) {
            throw new Error("http status fail \n"+data.text )
        }
        let body = await data.text()
        // data.text = body
        return body;

    } catch(e){
        console.log("error makeFetch",e)
        if(options.current <=3){
            options.current++;
            await helper.delay(2000);
            return await makeRequestFetch(url,options)
        }
        return {text:()=>"", headers:{get:()=>""}}
    }

}
export async function getMailVerify(number,email){
    if(number > 100){
        return false;
    }
    let proxyUrl = ''
    let prefixes = await getProxyView();
    if (prefixes.length) {
        proxyUrl = prefixes[Math.floor(Math.random() * prefixes.length)]
    }
    // console.log('proxyUrl',proxyUrl)
    const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : null;
    
    let data_mail = email.split('@')
    let res_list_mail = await makeRequestFetch(`https://www.1secmail.com/api/v1/?action=getMessages&login=${data_mail[0]}&domain=${data_mail[1]}`, {
        agent,
        "body": null,
        "method": "GET"
    });
    try {
        // let response = await makeRequest({ url:`https://www.1secmail.com/api/v1/?action=getMessages&login=${data_mail[0]}&domain=${data_mail[1]}`, proxy:proxyUrl,timeout: 90000, retryTime: 0, retryAfter: 1000 })
        // const response = await axios.get(`https://www.1secmail.com/api/v1/?action=getMessages&login=${data_mail[0]}&domain=${data_mail[1]}`);
        // console.log('res_list_mail',res_list_mail)
        res_list_mail = JSON.parse(res_list_mail)
        // console.log('res_list_mail',res_list_mail)
        let id_mail = ''
        for (var i = 0; i < res_list_mail.length; i++) {
            // console.log(response.data[i].subject)
            if(res_list_mail[i].subject == "Google Verification Code"){
                id_mail = res_list_mail[i].id
                break;
            }
            
        }
            // console.log('id_mail',id_mail)
        if(id_mail){
            try {
                // let res_mail = await axios.get(`https://www.1secmail.com/api/v1/?action=readMessage&login=${data_mail[0]}&domain=${data_mail[1]}&id=${id_mail}`);
                // let res_mail = await makeRequest({ url:`https://www.1secmail.com/api/v1/?action=readMessage&login=${data_mail[0]}&domain=${data_mail[1]}&id=${id_mail}`, proxy:proxyUrl,timeout: 90000, retryTime: 0, retryAfter: 1000 })
                let res_mail = await makeRequestFetch(`https://www.1secmail.com/api/v1/?action=readMessage&login=${data_mail[0]}&domain=${data_mail[1]}&id=${id_mail}`, {
                    agent,
                    "body": null,
                    "method": "GET"
                });
                // console.log('res_mail',res_mail)
                res_mail = JSON.parse(res_mail)
                // console.log(res_mail.data.body)
                const match = res_mail.body.match(/<strong[^>]*>(\d{6})<\/strong>/);

                // Kiểm tra và hiển thị kết quả
                if (match) {
                    return match[1]
                } else {
                     number++
                     await helper.delay(3000)
                    return await getMailVerify(number,email)
                }
                // let id_mail = ''
                // for (var i = 0; i < response.data.length; i++) {
                //     if(response.data[i].subject == "Google Verification Cod"){
                //         id_mail = response.data[i].id
                //     }
                    
                // }
                // if(id){

                // }else{
                //     number++
                //     return await getMailVerify(number,email)
                // }
            } catch (error) {
                console.error('Error:', error);
                // return false;
                number++
                await helper.delay(3000)
                return await getMailVerify(number,email)
            }
        }else{
            number++
            await helper.delay(3000)
            return await getMailVerify(number,email)
        }
    } catch (error) {
        console.error('Error:', error, res_list_mail);
        number++
        await helper.delay(3000)
        return await getMailVerify(number,email)
    }
}



export function parseMessagesGmail(data){
    let messages = []
    try{
        let [grge, date_p] = /GM_TRACING_RESULTS_CHUNK_START(.*?)GM_TRACING_POST_RESULTS_CHUNK_END/.exec(data) || [];
        // console.log(grge, date_p)
            let [tr, da] = /top._GM_setData\({(.*?)}\);/.exec(date_p) || [];
        da = "{" + da + "}"
        if (da) {
          let json = (JSON.parse(da))
          // console.log(da)
          let data = JSON.parse(json.a6jdv[0][2])
          
          if (data) {
            try{
                // console.log(data)
              (data[0][0].map((i => {
                let [title, content, timstamp, threadid, author] = i[4]

                let [te, email, display] = author[0][1]
                let code = getcodeOther(title)
                if(display == "shareearn.net"){
                    code = getcodeOther(content)
                }
                if(content){
                  messages.push({ title, content,code, timstamp, email, display, threadid: i[1] })
                }
              })))
            
            }catch(e){

            }
            
          }

        }
    }catch(e){}
    if(true){
        try{
            let [grge, date_p] = /GM_TRACING_POST_RESULTS_CHUNK_START(.*?)GM_TRACING_POST_RESULTS_CHUNK_END/.exec(data) || [];
            let [tr, da] = /top._GM_setData\({(.*?)}\);/.exec(date_p) || [];
        da = "{" + da + "}"
            let json = {}
            if(da){
              
            json = (JSON.parse(da)) 

            }
            // console.log(json)
            if(json.VWNrn){
              let data = JSON.parse(json.VWNrn[1][2])
              if (data) {
                try{
                  (data[0][0].map((i => {
                    let [title, content, timstamp, threadid, author] = i[4]
          
                    let [te, email, display] = author[0][1]
                    let code = getcodeOther(title)
                    if(display == "shareearn.net"){
                        code = getcodeOther(content)
                    }
                    if(content){
                        let _index = messages.findIndex(i=>{
                            return  i.threadid == threadid
                        })
                        if(_index ==-1){
                            messages.push({ title, content,code, timstamp, email, display,threadid: i[1]  })

                        }
                    }
                  })))
                
                }catch(e){
          
                }
                
              }
            }
        }catch(e){}
    }
    return messages
}
export function filterCookiesForUrl(cookiesArray, url) {
  const { hostname, pathname, protocol } = new URL(url);

  return cookiesArray.filter(cookie => {
    const domainMatches = hostname.endsWith(cookie.domain.replace(/^\./, ''));
    const pathMatches = pathname.startsWith(cookie.path || '/');
    const secureMatches = !cookie.secure || protocol === 'https:';
    const now = Date.now() / 1000;
    const notExpired = !cookie.expires || cookie.expires > now;

    return domainMatches && pathMatches && secureMatches && notExpired;
  });
}
export function ensureDirectoryExists(directoryPath) {
    const fullPath = resolve(directoryPath); // Đảm bảo đường dẫn đầy đủ
    if (!existsSync(fullPath)) {
        mkdirSync(fullPath, { recursive: true }); // Tạo thư mục nếu chưa tồn tại
        // console.log(`Đã tạo thư mục: ${fullPath}`);
    } else {
        // console.log(`Thư mục đã tồn tại: ${fullPath}`);
    }
}
export async function writeToFile(filePath, content) {
    try {
        // Tạo thư mục nếu chưa tồn tại
        await mkdir(dirname(filePath), { recursive: true });

        // Ghi nội dung vào tệp
        await writeFile(filePath, content, 'utf8');
        // console.log(`Đã ghi nội dung vào tệp: ${filePath}`);
    } catch (error) {
        // console.error(`Lỗi khi ghi tệp: ${error.message}`);
    }
}

export function getcodeOther(text){
    const pattern = /\b\d{4,}\b/g;
    const match = text.match(pattern);
    let code = ''
    if(match){
        code = match[0]
    }
    if(isNumericString(code)){
        return code;
      }else{
        return ''
      }
  
}
function getcodeIns(text){
    const pattern = /\b\d{6}\b/;
    const match = text.match(pattern);
    let code = ''
    if(match){
        code = match[0]
    }
    if(isNumericString(code)){
        return code;
      }else{
        return ''
      }
  
}
function getcodeFb(text){
    const pattern = /\b\d{5}\b/;
    const match = text.match(pattern);
    let code = ''
    if(match){
        code = match[0]
    }
    if(isNumericString(code)){
        return code;
      }else{
        return ''
      }
  // var code = helper.getString(text,'FB-',' ');
  // var codes = text.match(/FB-(\d+)/);
  // if(codes && codes.length){
  //   code = codes[1]
  // }           
  // if(code == '' && text.indexOf('Facebook') > -1){
  //   code = helper.getString('FB-'+text,'FB-',' ');
  // }
  // if(isNumericString(code)){
  //   return code;
  // }else{
  //   return ''
  // }
  
}
function isNumericString(str) {
    return /^[0-9]+$/.test(str);
}
export async function getNewAccessToken(credentials){
    try {
        let { 
            client_id,
            client_secret,
            refresh_token
        } = credentials
    
        const url = "https://oauth2.googleapis.com/token";
    
        const params = new URLSearchParams({
            client_id,
            client_secret,
            refresh_token,
            grant_type: "refresh_token"
        });
    
       
        let res_messages = await makeRequestFetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params
        })
        try {   
            res_messages = JSON.parse(res_messages)
        } catch (error) {
            
        }
        return  res_messages.access_token
    } catch(e){
        console.log("error getNewAccessToken",e)
        return ""
    }
    

}
export async function getMesssageAuth2(credentials){
    try {
        let {client_id, client_secret,access_token, refesh_token, limit} = credentials;
        let res_messages = await makeRequestFetch(`https://www.googleapis.com/gmail/v1/users/me/messages?format=null`, {
            headers: {
                "Authorization": `Bearer ${access_token}`
            }
        }
        
        )
        let json =JSON.parse(res_messages);
        let messages = json.messages;
        if(!messages){
            let new_access_token = await getNewAccessToken(credentials)
            if(new_access_token){
                access_token = new_access_token
                res_messages = await makeRequestFetch(`https://www.googleapis.com/gmail/v1/users/me/messages`, {
                    headers: {
                        "Authorization": `Bearer ${access_token}`
                    }
                })
                json =JSON.parse(res_messages);
                messages = json.messages;
            }
        }
        let data = []   
         limit =  limit || 10 
        if(messages.length <limit){
            limit = messages.length
        }
        for (let i = 0; i <limit; i++) {
            let message = messages[i];
            let res_message = await makeRequestFetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${message.id}`, {
                headers: {
                    "Authorization": `Bearer ${access_token}`
                }
            })

            let json_message =JSON.parse(res_message);

            if(!json_message.payload){
                let new_access_token = await getNewAccessToken(credentials)
                if(new_access_token){
                    access_token = new_access_token
                    res_message = await makeRequestFetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${message.id}`, {
                        headers: {
                            "Authorization": `Bearer ${access_token}`
                        }
                    })
                }
                json_message =JSON.parse(res_message);
            }
            const payload = json_message.payload;
            const htmlPart = payload.parts?.find(part => part.mimeType === "text/html");
            let  htmlContent
            if (htmlPart) {
                htmlContent = Buffer.from(htmlPart.body.data, "base64").toString("utf8");
            } else {
                htmlContent = Buffer.from(payload.body.data, "base64").toString("utf8");          
            }
              json_message.content = htmlContent;
              payload.headers.forEach(item=>{
                if(item.name == "Subject"){
                    json_message.title = item.value
                }
                if(item.name == "From"){
                    json_message.from = item.value
                    let [display, email] = item.value.split("<")
                    email = email || ""
                    display = display || ""
                    email = email.replace(">","")
                    display = display.trim().replaceAll('"','')
                    json_message.email = email
                    json_message.display = display
                }
              })

              let code = getcodeOther(json_message.title)
              if(json_message.display == "shareearn.net"){
                  code = getcodeOther(json_message.snippet)
              }
            let mess = { title: json_message.title, content: json_message.snippet, data_html: htmlContent, code, timstamp: json_message.internalDate, email: json_message.email, display: json_message.display, threadid: json_message.id }
            data.push(mess)
            if(credentials.wait){
                await helper.delay(credentials.wait)
            }
        }

        
        return data


    } catch(e){
        console.log("error getMesssageAuth2",e)
    }

}