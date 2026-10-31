
import request from 'request';
import os from "os"
import net from 'net';
let os_type = os.type();
import { glob } from "glob"
import axios from 'axios';
import FormData from 'form-data';
import { humanMouseMove, humanClick, humanType } from './human_simulator.js';
import path from 'path';
import fs from "fs"
import { nameinfo } from './nameinfo.js'
import { getNameViet } from './name_viet.js'
import { getNameUS } from './name_us.js'
import { getNameJP } from './name_jp.js'
import { getNameBD } from './name_bd.js'
import { getNameID } from './name_id.js'
import { exec } from 'child_process';
import Outlook from "./Outlook.js"
import signreq from "./sign_tiktok.js"
import querystring from "querystring"
import { promisify } from "util";
import { spawn, execFile } from "child_process";
const execAsync = promisify(exec);
let delay = (time) => new Promise((resolve) => setTimeout(resolve, time))

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min);
}
function formatPath(_path) {
    if (os_type !== "Darwin") {

        _path = _path.replaceAll("/", "\\");
        _path = _path.replaceAll("\\\\", "\\");
        _path = _path.replaceAll("\\", "/");
    }
    console.log("path", _path)
    return _path
}
function formatUrlWindow(_path) {
    if (os_type !== "Darwin") {

        _path = _path.replaceAll("/", "//");

    }
    console.log("path", _path)
    return _path
}
async function getFile(file) {
    try {
        if (os_type !== "Darwin") {
            {
                file = file.replaceAll("/", "\\");
                file = file.replaceAll("\\\\", "\\");
                file = file.replaceAll("\\", "/");
            }
        }
        let _path = `${file}`;
        let results = await glob(_path);
        return results;
    } catch (e) {
        console.log("error getFile", e);
        return [];
    }
}
function parserProxyString(proxystring) {
    proxystring = proxystring || ""
    let authInfoI = ""
    let proxyAddressI = proxystring
    proxystring = proxystring.replace("https://", "").replace("http://", "")
    if ((proxystring || "").includes("@")) {
        const [authInfo, proxyAddress] = proxystring.split('@');
        proxyAddressI = proxyAddress;
        authInfoI = authInfo
    }
    const [username, password] = authInfoI.split(':');
    const [host, port] = proxyAddressI.split(':');
    if (port && host)
        return { "protocol": "http", username, password, host, port }
}
/**
* makeRequest
* @param {options: {url, headers, method, proxy,retryCount, body, timeout, proxy_list, form, isRetry, isGetBody, preCheckRetry, retryTime }}  options
* @return {{ body, stautus, bodyJson, headers}}
*/
async function makeRequest(options) {

    let { url, headers, method, proxy, retryCount, body, timeout, retryTime, proxy_list, form, preCheckRetry, name, retryAfter, formData } = options
    method = method || "get"
    retryTime = retryTime || 2;
    retryAfter = retryAfter || 1000
    let isGetBody = true;
    if (options.hasOwnProperty("isGetBody")) {
        isGetBody = options.isGetBody
    }
    let isRetry = true;
    if (options.hasOwnProperty("isRetry")) {
        isRetry = options.isRetry
    }
    let retry = retryCount || 0;
    let head = await new Promise(r => {
        const options = {
            url,
            method: method.toUpperCase(),
            headers: headers,
            body,
            timeout: timeout || 10000
        }
        if (body) options.body = body;
        if (form) options.form = form;
        if (formData) options.formData = formData;
        let done = false;
        setTimeout(() => {
            if (!done) {
                done = true;
                return r({ error: "Request timeout", body: "", headers: {}, status: null })
            }
        }, timeout || 10000)

        if (proxy) {
            let proxystr = ""
            if (typeof proxy == "string") {
                proxystr = proxy
                if (!proxy.includes("https" || !proxy.includes("http"))) {
                    let { protocol, host, port, username, password } = parserProxyString(proxy);
                    proxystr = `${protocol || "http"}://${username && password ? `${username}:${password}@` : ''}${host}:${port}`
                }
            } else {
                let { protocol, host, port, username, password } = proxy;
                proxystr = `${protocol || "http"}://${username && password ? `${username}:${password}@` : ''}${host}:${port}`
            }
            options.proxy = proxystr
        }
        request(options, (error, response, body) => {
            if (!done) {
                done = true;
                return r({ error, body, headers: response ? response.headers : {}, status: response ? response.statusCode : null })
            }
        })
    })
    let isRetryPreCheck = false
    if ("function" == typeof preCheckRetry) {
        try {
            isRetryPreCheck = await preCheckRetry(head.body || "", head)
            isRetryPreCheck
        } catch (e) {
            console.log("err pre", e)
        }
    }

    let bodyJson = {};
    try { bodyJson = JSON.parse(head.body) } catch (e) { }
    head.bodyJson = bodyJson
    if (isRetryPreCheck || head.error || (!head.body && isGetBody)) {
        if (retry < retryTime && isRetry) {
            // console.log("retry request:",name)
            if (proxy_list && proxy_list.length > 0) {
                options.proxy = proxy_list[Math.floor((Math.random() * proxy_list.length))]
            }
            retry++
            options.retryCount = retry
            await delay(retryAfter || 1000)
            return await makeRequest(options)
        }
        return head

    }

    return head
}
function base64_encode(file) {
    try {
        // read binary data
        var bitmap = fs.readFileSync(file);
        // convert binary data to base64 encoded string
        return new Buffer(bitmap).toString('base64');
    } catch (e) {
        console.log(e);
        return ""
    }

}
let saveImage = (url, pathName) => {
    if (!url) return Promise.reject(new Error("URL is required"));

    return axios({
        method: 'get',
        url: url,
        responseType: 'stream',
        proxy: false, // Set this as needed or remove if not using proxy
        timeout: 20000
    }).then(response => {
        return new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(pathName);
            response.data.pipe(writer);
            let error = null;
            writer.on('error', err => {
                error = err;
                writer.close();
                reject(err);
            });
            writer.on('close', () => {
                if (!error) {
                    resolve(true);
                }
            });
        });
    }).catch(error => {
        console.error(error);
        return false;
    });
}
let saveBlobImage = async (page, blobUrl, pathName) => {
    if (!blobUrl) return Promise.reject(new Error("Blob URL is required"));

    try {
        const data = await page.evaluate(async (blobUrl) => {
            const response = await fetch(blobUrl);
            const arrayBuffer = await response.arrayBuffer();
            return Array.from(new Uint8Array(arrayBuffer));
        }, blobUrl);

        return new Promise((resolve, reject) => {
            const buffer = Buffer.from(data);
            const writer = fs.createWriteStream(pathName);

            writer.on('error', (err) => {
                writer.close();
                console.error(err);
                reject(err);
            });

            writer.on('finish', () => {
                resolve(true);
            });

            writer.end(buffer);
        });
    } catch (error) {
        console.error(error);
        return false;
    }
};
async function getCapchaResouce(getPage) {
    try {
        let type = -1
        let results = await checkFunction({
            maxTime: 2, fn: async () => {
                let page = await getPage()
                if (!page) {
                    return null
                }

                let promies = [new Promise(async (r) => {
                    let [inputEl] = await page.$x("//img[@id='captcha-verify-image']");
                    return r(inputEl ? (await inputEl.getProperty("src")).jsonValue() : "")

                }), new Promise(async (r) => {
                    let [inputEl] = await page.$x("//img[@data-testid='whirl-inner-img']");
                    return r(inputEl ? (await inputEl.getProperty("src")).jsonValue() : "")

                }), new Promise(async (r) => {
                    let [inputEl] = await page.$x("//img[@data-testid='whirl-outer-img']");
                    return r(inputEl ? (await inputEl.getProperty("src")).jsonValue() : "")

                }), new Promise(async (r) => {
                    let [inputEl] = await page.$x("//img[contains(@class, 'captcha_verify_img_slide')]");
                    return r(inputEl ? (await inputEl.getProperty("src")).jsonValue() : "")

                }), new Promise(async (r) => {
                    let [inputEl] = await page.$x("//img[contains(@class, 'cap-rounded-lg')]");
                    return r(inputEl ? (await inputEl.getProperty("src")).jsonValue() : "")

                }), new Promise(async (r) => {
                    let [inputEl] = await page.$x("//*[contains(@class,'captcha-verify-container')]//img[contains(@class,'cap-h-')]");
                    return r(inputEl ? (await inputEl.getProperty("src")).jsonValue() : "")

                }),
                new Promise(async (r) => {
                    let [inputEl] = await page.$x("//*[contains(@class,'captcha-verify-container')]//img[contains(@class,'cap-absolute')]");
                    return r(inputEl ? (await inputEl.getProperty("src")).jsonValue() : "")

                }),]



                let results = await Promise.allSettled(promies)
                return results.findIndex(i => i.value) > -1 ? results : null

            }
        })
        let element_source, element_source_inner, element_source_outer, element_slide_src, element_source_chose_v2, element_source_inner_v2, element_source_outer_v2 = "";
        if (results) {
            let [chose, inner, outer, slide, chose_v2, outer_v2, inter_v2] = results;
            element_source = chose.value;
            element_source_inner = inner.value;
            element_source_outer = outer.value;
            element_slide_src = slide.value;
            element_source_chose_v2 = chose_v2.value
            element_source_outer_v2 = outer_v2.value;
            element_source_inner_v2 = inter_v2.value
        }
        let bodyText = ""
        try {
            let page = await getPage()
            bodyText = await page.evaluate(() => {
                return document.body.innerText
            })
        } catch (e) { }


        // if(bodyText && bodyText.includes("Kéo mảnh ghép vào đúng vị trí")){
        //     type=1
        // }
        // console.log("bodyText", bodyText)
        if (element_source || element_source_chose_v2) {
            if (bodyText && bodyText.includes("Kéo mảnh ghép vào đúng vị trí")) {
                type = 1
            } else if (!element_slide_src) {
                type = 2
            } else {
                type = 1
            }
        } else if ((element_source_inner && element_source_outer) || (element_source_outer_v2 && element_source_inner_v2)) {
            type = 0
        }
        // console.log("type type type", type)
        return { element_source, element_source_inner, element_source_outer, element_slide_src, element_source_chose_v2, type, element_source_inner_v2, element_source_outer_v2 }
    } catch (e) {
        console.log("error getCapchaResouce ", e)
        return {}
    }

}
async function createTask({ body, source }) {
    let taskId = ""

    if (source != "python") {
        let res = await makeRequest({
            'method': 'POST',
            'url': 'https://api.achicaptcha.com/createTask',
            'headers': {
                'Content-Type': 'application/json'
            }, body: JSON.stringify(body)
        })
        if (!res.bodyJson.taskId) {
            console.log("captcha res", res.body)
        }
        taskId = res.bodyJson.taskId
    } else {

        let [outer, inner] = body.task.image.split("|")
        //task_type:"rotate" if body.task.subType =0
        //task_type:"slider" if body.task.subType ==1
        //task_type:"match" if body.task.subType ==2

        let body_data = {
            task_type: body.task.subType == 0 ? "rotate" : body.task.subType == 1 ? "slider" : "match",
            image_outer_b64: outer,
        }
        if (body.task.subType == 0) {
            body_data.image_inner_b64 = inner
        }
        let res = await makeRequest({
            'method': 'POST',
            'url': `http://217.15.163.20:8000/api/v1/tasks/create`,
            // 'url': `http://localhost:8000/api/v1/tasks/create`,

            'headers': {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body_data),
            timeout: 30000
        })
        // console.log("res",res,JSON.stringify(body_data))
        if (!res.bodyJson.data.task_id) {
            console.log("captcha res", res.body)
        }
        taskId = res.bodyJson.data.task_id
    }


    return taskId

}
async function getTaskResult({ taskId, body, source }) {
    let solution = ""
    if (source != "python") {
        let result = await makeRequest({
            retryAfter: 3000,
            retryTime: 10,
            'method': 'POST',
            'url': 'https://api.achicaptcha.com/getTaskResult',
            'headers': {
                'Content-Type': 'application/json'
            }, body: JSON.stringify({
                "clientKey": "e8bd9c07fa57a35bb74ec9f54824d7ab",
                taskId: taskId
            }), preCheckRetry: (body) => {
                if (!body.includes("ready")) return true
            }
        })
        solution = result.bodyJson.solution
    } else {


        let res = await makeRequest({
            'method': 'GET',
            'url': `http://217.15.163.20:8000/api/v1/tasks/${taskId}`,
            // 'url': `http://localhost:8000/api/v1/tasks/${taskId}`,
            'headers': {
                'Content-Type': 'application/json'
            },
            retryAfter: 5000,
            retryTime: 10,
            preCheckRetry: (body) => {
                if (!body.includes("completed")) return true
            }
        })

        solution = res.bodyJson.data.solution
    }
    console.log("getTaskResult", solution)
    return solution
}
async function resolveCapcha(getPage, { isRetry, resouces }) {

    let name_rand = generateRandomName(10)
    // console.log("Start resolveCapcha")
    // check folder images , if not exits create it
    if (!fs.existsSync(path.resolve("./images"))) {
        fs.mkdirSync(path.resolve("./images"))
    }
    let page = await getPage()
    if (!page) {
        return false
    }
    let { element_source_inner, element_source_outer, element_source, type, element_source_chose_v2, element_source_outer_v2, element_source_inner_v2 } = resouces || await getCapchaResouce(getPage);

    // if (isRetry && type !== -1) {
    //     await delay(1000);
    //     let { type } = await getCapchaResouce(page);
    //     if (type == -1) return true
    // }
    let data = ""
    console.log("Type:", type)
    // if(type == 1){
    //     return false
    // }
    let source = "python"
    if (type !== -1) {
        if (type == 2 || type == 1) {
            let path_image = path.resolve("./images/" + name_rand + Date.now() + '_image.jpg');
            // await saveImage(element_source || element_source_chose_v2, path_image);
            await saveBlobImage(page, element_source || element_source_chose_v2, path_image);
            let b = await base64_encode(path_image);
            data += b
        }

        if (type == 0) {
            let path_image_o = path.resolve("./images/" + Date.now() + '_o.jpg');
            let path_image_i = path.resolve("./images/" + Date.now() + '_i.jpg');

            // await saveImage(element_source_outer || element_source_outer_v2, path_image_o);
            // await saveImage(element_source_inner || element_source_inner_v2, path_image_i);
            await saveBlobImage(page, element_source_outer || element_source_outer_v2, path_image_o);
            await saveBlobImage(page, element_source_inner || element_source_inner_v2, path_image_i);
            let b1 = await base64_encode(path_image_o);
            let b2 = "|" + await base64_encode(path_image_i);
            data += b1
            data += b2

        }

        let body = {
            "clientKey": "e8bd9c07fa57a35bb74ec9f54824d7ab",
            "task": {
                "type": "TiktokCaptchaTask",
                "image": data,
                "subType": type
            }
        }

        let taskId = await createTask({ body, source })
        await delay(1000)
        // console.log("Image capcha :", body.task.image.length)
        let solution_result = await getTaskResult({ taskId, body, source })
        if (solution_result == 0) {
            return false;
        }
        let [e] = await page.$$("#captcha-verify-image")
        if (!e) {
            let [b] = await page.$x("//*[contains(@class, 'cap-rounded-lg')]")
            e = b
        }
        async function getSize(element) {
            return await page.evaluate(element => {
                let { naturalWidth, naturalHeight, offsetWidth, offsetHeight, clientWidth, clientHeight } = element
                return { naturalWidth, naturalHeight, offsetWidth, offsetHeight, clientWidth, clientHeight }
            }, element);
        }


        if (e && type == 2 && solution_result) {
            let image_element = await getSize(e);

            let [x1, y1, x2, y2] = solution_result.split(",");
            let w_s = image_element.offsetWidth / image_element.naturalWidth;
            let h_s = image_element.offsetHeight / image_element.naturalHeight;

            if (x1) {
                let offset = { x: Number(w_s * x1), y: Number(h_s * y1) };
                await page.click(element_source_chose_v2 ? ".cap-rounded-lg" : "#captcha-verify-image", { offset })
            }
            if (x1) {
                let offset = { x: Number(w_s * x2), y: Number(h_s * y2) };
                await page.click(element_source_chose_v2 ? ".cap-rounded-lg" : "#captcha-verify-image", { offset })
            }
            // console.log("solution", { x: Number(w_s * x1), y: Number(h_s * y1) }, { x: Number(w_s * x2), y: Number(h_s * y2) })
            if (!element_source_chose_v2) {
                await clickXpath(getPage, '//*[contains(@class,"verify-captcha-submit-button")]')

            } else {
                await clickXpath(getPage, "//*[contains(@class,'captcha-verify-container')]//div[contains(text(),'Xác nhận')]")


            }

        } else if (type == 1 || type == 0 && solution_result) {
            let solution = 0
            let button_bar = await await checkFunction({
                fn: async () => (await page.$x('//*[contains(@class,"secsdk-captcha-drag-icon")]'))[0]
            })
            let bar = {}
            let btn = {};

            let L;
            if (button_bar) {
                btn = await getSize(button_bar)
            }
            if (type == 0) {
                let element_bar_width = await await checkFunction({ fn: async () => (await page.$x(element_source_inner ? '//*[contains(@class,"captcha_verify_slide--slidebar")]' : "//*[contains(@class,'captcha-verify-container')]//*[contains(@class,'cap-rounded-full')]"))[0] })

                if (element_bar_width) {
                    bar = await getSize(element_bar_width)
                }
                L = (Number(bar.clientWidth) - Number(btn.clientWidth)) / 1.526;
                if (source == "python") {
                    L = (Number(bar.clientWidth) - Number(btn.clientWidth)) / 1;

                }

                solution = Number(L / 180) * Number(solution_result)
                let bounding_box = await button_bar.boundingBox();
                let x = bounding_box.x + bounding_box.width / 2;
                let y = bounding_box.y + bounding_box.height / 2;
                solution = solution + x
                console.log("solution", solution, "solution_result", solution_result)
                await page.mouse.move(x, y);
                await page.mouse.down();

                await delay(377)
                await page.mouse.move(solution + getRandomInt(50, 80), y);
                await delay(588)
                await page.mouse.move(solution + getRandomInt(5, 10), y);
                await delay(200)
                await page.mouse.move(solution - getRandomInt(30, 60), y);
                await delay(200)
                await page.mouse.move(solution - getRandomInt(5, 10), y);
                await delay(200)
                await page.mouse.move(solution, y);
                await delay(677)
                await page.mouse.up();

                console.log("x", x, "solution", solution, "L", L)
            } else {
                let element_image_width = await await checkFunction({ fn: async () => (await page.$x('//*[contains(@id,"captcha-verify-image")]'))[0] })
                let img = {};
                if (element_image_width) {
                    img = await getSize(element_image_width)
                }
                // solution = (340 * Number(solution_result) / img.naturalWidth)
                let bounding_box_img = await element_image_width.boundingBox();
                // console.log(name_rand,"TEST CAPTCHA",bounding_box_img,img)
                solution = (bounding_box_img.width * Number(solution_result) / img.naturalWidth)
                let bounding_box = await button_bar.boundingBox();
                // console.log(name_rand,"bounding_box dau",bounding_box.x)
                let x = bounding_box.x + bounding_box.width / 2;
                let y = bounding_box.y + bounding_box.height / 2;
                solution = Math.floor(solution + bounding_box.x)
                // console.log(name_rand,"solution", solution,"solution_result",solution_result,"bounding_box.x",bounding_box.x,"bounding_box.width",bounding_box.width,"x",x)
                // await delay(500000)
                await dragSmooth(page, x, y, solution, name_rand)

                // await page.mouse.move(x, y);
                // await page.mouse.down();

                // await delay(377)
                // await page.mouse.move(solution + getRandomInt(50, 80), y);
                // await delay(588)
                // await page.mouse.move(solution + getRandomInt(5, 10), y);
                // await delay(200)
                // await page.mouse.move(solution - getRandomInt(30, 60), y);
                // await delay(200)
                // await page.mouse.move(solution - getRandomInt(5, 10), y);
                // await delay(400)
                // await page.mouse.move(solution, y);
                // await delay(677)
                // await page.mouse.up();

                // console.log("x", x, "solution", solution, "L", L)
            }



        }
        await delay(5000)
        // return await resolveCapcha(page, { isRetry: true })
    } else {
        console.log("capcha pass")
        return true
    }

}
async function dragSmooth(page, x, y, x1, name_rand) {
    const distance = Math.abs(x1 - x) + 10;
    await page.mouse.move(x, y);
    await page.mouse.down();
    let i = 0
    while (i < distance) {
        await page.mouse.move(x + i, y);
        await delay(50);
        let button_bar = await checkFunction({
            fn: async () => (await page.$x('//*[contains(@class,"secsdk-captcha-drag-icon")]'))[0]
        })
        let bounding_box = await button_bar.boundingBox();
        // console.log(name_rand,"bounding_box move",bounding_box.x)
        if (Math.abs(bounding_box.x - x1) < 2) {
            break;
        }
        if (x1 - bounding_box.x > 30) {
            // if(distance-i >30 ){
            i += getRandomInt(10, 20)
        } else {
            i++
        }
    }

    await delay(3000)
    // let button_bar = await checkFunction({
    //     fn: async () => (await page.$x('//*[contains(@class,"secsdk-captcha-drag-icon")]'))[0]
    // })
    // let bounding_box = await button_bar.boundingBox();
    // console.log(name_rand,"bounding_box move",bounding_box.x)
    await page.mouse.up();
}
async function dragSmoothngon(page, x, y, x1, name_rand) {
    const distance = Math.abs(x1 - x) + 10;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 0; i < distance; i++) {
        await page.mouse.move(x + i, y);
        await delay(50);
        let button_bar = await checkFunction({
            fn: async () => (await page.$x('//*[contains(@class,"secsdk-captcha-drag-icon")]'))[0]
        })
        let bounding_box = await button_bar.boundingBox();
        console.log(name_rand, "bounding_box move", bounding_box.x)
        if (Math.abs(bounding_box.x - x1) < 2) {
            break;
        }
    }
    await delay(1000)
    let button_bar = await checkFunction({
        fn: async () => (await page.$x('//*[contains(@class,"secsdk-captcha-drag-icon")]'))[0]
    })
    let bounding_box = await button_bar.boundingBox();
    console.log(name_rand, "bounding_box move", bounding_box.x)
    await page.mouse.up();
}
async function dragSmooth1(page, x, y, x1, name_rand) {
    // số bước phụ thuộc vào khoảng cách
    const distance = Math.abs(x1 - x);
    const steps = Math.max(5, Math.min(60, Math.floor(distance / 5)));
    const delay_time = 8;

    // tới điểm bắt đầu
    await page.mouse.move(x, y);
    await page.mouse.down();

    // đi từng bước mượt
    for (let i = 1; i < steps; i++) {
        const newX = x + Math.round(((x1 - x) * i) / steps);
        await page.mouse.move(newX, y);
        let button_bar = await await checkFunction({
            fn: async () => (await page.$x('//*[contains(@class,"secsdk-captcha-drag-icon")]'))[0]
        })
        let bounding_box = await button_bar.boundingBox();
        console.log(name_rand, "bounding_box move", bounding_box.x)
        await delay(delay_time);
    }
    await page.mouse.move(x1, y);

    // 🔑 chốt lại điểm cuối chính xác
    let count = 0;
    while (true) {
        await delay(100);
        let button_bar = await await checkFunction({
            fn: async () => (await page.$x('//*[contains(@class,"secsdk-captcha-drag-icon")]'))[0]
        })
        let bounding_box = await button_bar.boundingBox();
        let rec = (bounding_box.x - x1);
        console.log(name_rand, "bounding_box sau", bounding_box.x, rec, count)
        if (Math.abs(rec) < 1) {
            break;
        }
        if (rec < 0) {
            await page.mouse.move(bounding_box.x + Math.floor(rec), y);
        } else {
            await page.mouse.move(bounding_box.x - Math.floor(rec), y);
        }

        count++
        if (count >= 30) {
            break
        }
    }
    await page.mouse.up();
}
async function actionBeforeCapcha({ getPage, fn, timeout, name, time, maxTime }) {
    time = time || 0
    let page = await getPage()
    if (!page) {
        return false
    }
    try {

        let checked = await fn()
        await delay(1000)
        let rs = await getCapchaResouce(getPage);
        if (rs && rs.type != -1) {
            // console.log("rs",rs)
            // console.log("catched capcha")
            await resolveCapcha(getPage, { resouces: rs })
            // return checked

            throw new Error("got a capcha")
        }
        return checked
    } catch (err) {
        if (err.message !== "got a capcha")
            console.log("error actionBeforeCapcha", err)
        if (time >= (maxTime || 5)) {
            console.log("actionBeforeCapcha false", name, time + 1, new Date(Date.now()))
            return false;
        }
        await delay(timeout || 1000);
        return await actionBeforeCapcha({ getPage, page, fn, name, timeout, time: time + 1, maxTime });
    }
}
async function checkFunction({ fn, timeout, name, time, maxTime }) {
    time = time || 0
    try {

        let checked = await fn()
        if (!checked || checked.isRetry) throw new Error("error checkFromFunction")
        // console.log("checkFromFunction success", name, time + 1, new Date(Date.now()))
        return checked
    } catch (err) {

        if (err.message !== "error checkFromFunction") {
            // console.log("error checkFunction", err)
            if (err.message.includes("Requesting main frame too early")) {
                return false
            }
            if (err.message.includes("ProtocolError")) {
                return false
            }
        }
        if (time >= (maxTime || 5)) {
            // console.log("Check fucntion false", name, time + 1, new Date(Date.now()))
            return false

        }
        await delay(timeout || 3000);
        return await checkFunction({ fn, name, timeout, time: time + 1, maxTime });
    }
}
let clickXpath = async (getPage, xpath, index, maxTime, is_move = false) => {
    let page = await getPage()
    if (!page) return false;
    let button_c = await checkFunction({ name: xpath, maxTime, fn: async () => { let inputEls = await page.$x(xpath); return inputEls && inputEls.length ? inputEls[index || 0] : false } })
    try {
        if (button_c) {
            if (is_move) {
                await humanClick(page, button_c);
            } else {
                await button_c.click();
            }
            return button_c
        }
    } catch (e) {

    }
}
let clickSelector = async (getPage, xpath, index, maxTime, is_move = false) => {
    let page = await getPage();
    if (!page) {
        return false
    }
    let button_c = await checkFunction({
        name: xpath, maxTime, fn: async () => {
            let page = await getPage();
            if (!page) {
                return false
            }
            let inputEls = await page.$$(xpath); return inputEls[index || 0]
        }
    })
    if (button_c) {
        try {
            if (is_move) {
                await humanClick(page, button_c);
            } else {
                await button_c.click();
            }
            return button_c
        } catch (e) {

        }
    }
}
function trimStringToMaxLength(inputString, maxLength = 24) {
    // Kiểm tra nếu chuỗi dài hơn maxLength ký tự, trả về chuỗi cắt gọn
    if (inputString.length > maxLength) {
        return inputString.substring(0, maxLength);
    }
    // Nếu chuỗi ngắn hơn hoặc bằng maxLength ký tự, trả về nguyên vẹn
    return inputString;
}
function generateRandomName(length) {
    const characters = 'abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}
async function getRoomUser({ room_id, proxy, cookie_string, retryCount, proxy_list = [] }) {
    if (!room_id) {
        return { is_alive: false, room_id: false, err: true };
    }
    try {
        let retry = retryCount || 0;
        let random_de = getRandomInt(187248723442, 934782374123);
        let device_id = "7584943" + random_de;
        let random_an = getRandomInt(187248723442, 934782374123);
        let anchor_id = "7171925" + random_de;
        const options = {
            retryTime: 3,

            url: `https://webcast.tiktok.com/webcast/ranklist/online_audience/?aid=1988&anchor_id=${anchor_id}&app_language=en&app_name=tiktok_web&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=MacIntel&browser_version=5.0%20%28Macintosh%3B%20Intel%20Mac%20OS%20X%2010_15_7%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F134.0.0.0%20Safari%2F537.36&channel=tiktok_web&cookie_enabled=true&data_collection_enabled=true&device_id=${device_id}&device_platform=web_pc&focus_state=true&from_page=user&history_len=2&is_fullscreen=false&is_page_visible=true&os=mac&priority_region=&referer=&region=VN&room_id=${room_id}&screen_height=1117&screen_width=1728&tz_name=Asia%2FSaigon&user_is_login=true&verifyFp=&webcast_language=en&msToken=&X-Bogus=&_signature=`,
            method: 'GET',
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
                cookie: cookie_string
            },
            proxy,
            preCheckRetry: (body, json) => {
                return !body.includes('"user_id"');

            },
            proxy_list: proxy_list
        }
        let res = await makeRequest(options)
        let { body, bodyJson, status, headers, error } = res;
        let json = bodyJson;
        let data_user = [];
        try {
            data_user = json?.data?.ranks?.map(function (a) {
                return a?.user?.display_id
            })
        } catch (e) { }
        let total_user = json?.data?.total || 0;
        let status_code = json.status_code;
        return {
            data_user: data_user,
            room_id: room_id,
            err: false,
            total_user: total_user,
            status_code: status_code,
        }
    } catch (e) {
        return { data_user: [], room_id: room_id, err: true, error: e };
    }
}
async function checkInToRoom({ name, username, cookie_string, proxy, proxy_list = [] }) {
    let data_return = {
        status: false,
        is_join: false
    }
    let max_time = 4
    let time = 0
    while (!data_return.status) {
        let dataUser = await getRoomId3({ name, proxy, retryCount: 1 });
        if (dataUser && dataUser.data && dataUser.data.user && dataUser.data.user.roomId) {
            let roomId = dataUser.data.user.roomId;
            // console.log("roomId",roomId)
            // read cookie_string from file helper.acc.txt
            let cookie_strings = await strData(path.resolve("./helper.acc.txt"))
            cookie_strings = cookie_strings.split("\n")
            if (!cookie_string) {
                cookie_string = cookie_strings[Math.floor(Math.random() * cookie_strings.length)]
            }
            let dataUserRank = await getRoomUser({ room_id: roomId, proxy, cookie_string, retryCount: 1, proxy_list });
            // console.log(dataUserRank)
            if (dataUserRank && dataUserRank.data_user && dataUserRank.data_user.includes(username)) {
                data_return.status = true
                console.log("checkInToRoom success", name, username)
                data_return.is_join = true
            } else if (dataUserRank && !dataUserRank.err) {
                data_return.status = true
                console.log("checkInToRoom failed", name, username)
                data_return.is_join = false
            }
        }
        time++
        if (time >= max_time) {
            break
        } else {
            proxy = proxy_list[Math.floor(Math.random() * proxy_list.length)]
            await delay(1000)
        }
    }
    return data_return
}
async function getRoomId3({ name, proxy, retryCount, cookie_string }) {
    // console.log(proxy)
    // proxy = helper.getProxyX();
    if (!name) {
        return ""
    }
    // if (!name.includes("https://")) {
    //   name = `https://www.tiktok.com/@${name}/live`
    // };
    let url = `https://www.tiktok.com/api-live/user/room/?aid=1988&app_language=en-US&app_name=tiktok_web&browser_language=en&browser_name=Mozilla&browser_online=true&browser_platform=Win32&browser_version=5.0+%28Windows+NT+10.0%3B+Win64%3B+x64%29+AppleWebKit%2F537.36+%28KHTML%2C+like+Gecko%29+Chrome%2F106.0.0.0+Safari%2F537.36&cookie_enabled=true&cursor=&internal_ext=&device_platform=web&focus_state=true&from_page=user&history_len=0&is_fullscreen=false&is_page_visible=true&did_rule=3&fetch_rule=1&last_rtt=0&live_id=12&resp_content_type=protobuf&screen_height=1152&screen_width=2048&tz_name=Europe%2FBerlin&referer=https%3A%2F%2Fwww.tiktok.com%2F&root_referer=https%3A%2F%2Fwww.tiktok.com%2F&host=https%3A%2F%2Fwebcast.tiktok.com&webcast_sdk_version=1.3.0&update_version_code=1.3.0&uniqueId=${name}&sourceType=54`
    // console.log('name',name)
    let retry = retryCount || 0;
    let headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        'authority': 'www.tiktok.com',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'en-US,en;q=0.9,it-IT;q=0.8,it;q=0.7,ko;q=0.6,ja;q=0.5,zh;q=0.4,vi;q=0.3,vi-VN;q=0.2,zh-HK;q=0.1',
        'cache-control': 'no-cache',
        'dnt': '1',
        // 'referer': name,
        'pragma': 'no-cache',
        'sec-ch-ua': '"Chromium";v="116", "Not)A;Brand";v="24", "Google Chrome";v="116"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
    }
    return new Promise(r => {
        const options = {
            url: url,
            headers: headers,
            method: 'GET',
        }
        if (proxy) {
            let proxystr = ""
            if (typeof proxy == "string") {
                proxystr = proxy
            } else {
                let { protocol, host, port, username, password } = proxy;
                proxystr = `${protocol || "http"}://${username && password ? `${username}:${password}@` : ''}${host}:${port}`
            }
            options.proxy = proxystr
        }
        if (options.proxy && !options.proxy.includes("http://")) {
            options.proxy = "http://" + options.proxy
        }
        request(options, async (error, response, body) => {
            // console.log(body,proxy)
            if (error || !body) {
                if (retry < 5) {
                    retry++
                    console.log(error, body)
                    await delay(2000)
                    return r(await getRoomId3({ name, proxy, retryCount: retry }))
                } else {
                    return r("")
                }
            }
            try {
                body = JSON.parse(body);
                return r(body)
            } catch (e) {
                console.log(e)
                return r("")
            }

        })
    })
}
async function uploadImage1({ path_image, proxy, cookie_string, retryCount, proxy_list = [] }) {
    //day la data gui len copy curl
    //--data-raw $'------WebKitFormBoundaryK0pIrXTR1mBiVA7r\r\nContent-Disposition: form-data; name="file"; filename="blob"\r\nContent-Type: image/png\r\n\r\n\u0089PNG\r\n\u001a\n\u0000\u0000\u0000\rIHDR\u0000\u0000\u0000È\u0000\u0000\u0000È\u0008\u0006\u0000\u0000\u0000­X®\u009e\u0000\u0000\u0000\u0001sRGB\u0000®Î\u001cé\u0000\u0000 \u0000IDATx^\u008c½Y\u0093$Ùu&öyì\u0011¹gefe-Ý]ÝÕè&zC÷°\u001b\u0004\u0006\u0000\u001bÄÆe\u000cÀ\u0000C\u00195C\u008eé\u001fèA\u000fú\u0011ZÌ$3I\u000fc²±\u0091\u0019%3ÍË\u0098F\u001a\u0092 À\u0021\u0001\u0002 \u001a@ïÕµvUVeVå\u009e\u0019\u0091±»\u0087{¸ìl÷^ÏÊ"\u0099@uUfFx¸ß{Öï|çÜè\u009dë\u001by\u0009\u0011"<þ\u0095\u0003\u0098\u0096"äS \u009bN\u0091¥\u0019ÿ{\u009aO\u0091¡\u008ci\u009ec\u009ae ×EQ\u0084R\u0089®4\u0005¿\u0088¿r~\u008dþ\u0013È#D¥\u0008QTBn?\u0007P\u008aR\u0094Jô~º&0EÄ¿Ï§9r½3ú~:µëÒ\u008då\u0088"ùÜ)ÿ\u009b®KOÁwÍ÷B×\u0093ïåéèZ\u0011\u007f\u000f\u0094#ù[¾\u0097×ð«ø\u001a@¹TB¹LÏ\u0093£\\*óýÑ¿K\u0011­G\u0086I\u001ea\u0092¦HÒ\u0094>\rÓ\u009c\u009e<\u0092K¹/ºß\\\u009e-*¡\u00842²<Çd\u009añké\u0016èO9ÒçÊ§(\u0097"Ôª\u0015T«U\u0094èùry¶\u0012¦(\u0097Ë\u0088"y\u008a²Þçé]\u009b"\u0087-­¬\u0009d-s^~÷Å?£»Ë§È§þ\u0017ü\u001e·{Å«\u0087{F\u009fc_¶öô·|\u0096ÿ\u009dý\u009bÿÎKþ\u0082ºW²Ïôs]\u0003ÝSyNÙ}z+í}\u0014Ñ~ª8å\u0019ÿ.*\u0005×äM\u009eò\u001eU*eÞvÚG\u0096\u0085r\u008er\u009e¢R©"\u009f\u008c\u0091\u009eìb²¿\u008dû\u001f\u007f\u00824\u009abíù«\u0018¤eüø\u0007\u007f\u008dW\u009fy\u0016×¯½\u0087µ\u000bË\u0088LAN/´\u0008\u0014=\u0093*H\u0096\u0021Ëh1MADÈéæ½`ÉÂÈÒ»\'9µÊ*¯ÁKHA"\u0016B\u00124º¾n\u001e}£\u008bÍë\u001b,<o\u0006/\u009el\u0088Û$^Tú\u009e\u00IEND®B`\u0082\r\n------WebKitFormBoundaryK0pIrXTR1mBiVA7r\r\nContent-Disposition: form-data; name="source"\r\n\r\n0\r\n------WebKitFormBoundaryK0pIrXTR1mBiVA7r--\r\n'
    // hay tao ra data_send tu file path_image
    let data_send = fs.createReadStream(path_image);
    data_send = await base64_encode(path_image);
    try {
        let retry = retryCount || 0;
        let random_de = getRandomInt(187248723442, 934782374123);
        let device_id = "7540677231933228562";//"7584943" + random_de;
        let random_an = getRandomInt(187248723442, 934782374123);
        let anchor_id = "7171925" + random_de;
        let odinId = "7540677066308699154"//"7544943" + getRandomInt(187248723442, 934782374123);//"odinId":"
        let verifyFp = getString(cookie_string.replace(/ /g, '') + ';', 'verifyFp=', ';') || getString(cookie_string.replace(/ /g, '') + ';', 's_v_web_id=', ';')
        const options = {
            retryTime: 3,

            url: `https://www.tiktok.com/api/upload/image/?WebIdLastTime=1755700737&aid=1988&app_language=vi-VN&app_name=tiktok_web&browser_language=vi&browser_name=Mozilla&browser_online=true&browser_platform=MacIntel&browser_version=5.0%20%28Macintosh%3B%20Intel%20Mac%20OS%20X%2010_15_7%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F134.0.0.0%20Safari%2F537.36&channel=tiktok_web&cookie_enabled=true&data_collection_enabled=true&device_id=${device_id}&device_platform=web_pc&focus_state=true&from_page=user&history_len=8&is_fullscreen=false&is_page_visible=true&odinId=${odinId}&os=mac&priority_region=VN&referer=https%3A%2F%2Fwww.tiktok.com%2Fsignup%2Fcreate-username&region=VN&root_referer=https%3A%2F%2Fwww.tiktok.com%2Fsignup%2Fcreate-username&screen_height=982&screen_width=1512&tz_name=Asia%2FSaigon&user_is_login=true&verifyFp=${verifyFp}&webcast_language=vi-VN`,
            method: 'POST',
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
                cookie: cookie_string
            },
            formData: {
                file: data_send,
                source: 0
            },
            proxy,
            preCheckRetry: (body, json) => {
                return !body.includes('"user_id"');

            },
            proxy_list: proxy_list
        }
        let res = await makeRequest(options)
        let { body, bodyJson, status, headers, error } = res;
        let json = bodyJson;
        try {
        } catch (e) { }
        return json

    } catch (e) {
        return { err: true, error: e };
    }
}
async function uploadImage({ path_image, proxy, cookie_string, retryCount, proxy_list = [] }) {
    try {
        let retry = retryCount || 0;
        let wid = getString(cookie_string.replace(/ /g, '') + ';', ';wid=', ';')
        let multi_sids = getString(cookie_string.replace(/ /g, '') + ';', ';multi_sids=', '%')
        let tt_csrf_token = getString(cookie_string.replace(/ /g, '') + ';', 'tt_csrf_token=', ';');
        let random_de = getRandomInt(187248723442, 934782374123);
        let device_id = wid || "7584943" + random_de;
        let odinId = multi_sids || "7544943" + getRandomInt(187248723442, 934782374123);
        let msToken = getString(cookie_string.replace(/ /g, '') + ';', 'msToken=', ';')

        let verifyFp = getString(cookie_string.replace(/ /g, '') + ';', 'verifyFp=', ';')
            || getString(cookie_string.replace(/ /g, '') + ';', 's_v_web_id=', ';');

        // Tạo form-data để gửi file
        // const form = new FormData();
        // form.append('file', fs.createReadStream(path_image));
        // form.append('source', 0);

        // const url = `https://www.tiktok.com/api/upload/image/?WebIdLastTime=1755700737&aid=1988&app_language=vi-VN&app_name=tiktok_web&browser_language=vi&browser_name=Mozilla&browser_online=true&browser_platform=MacIntel&browser_version=5.0%20%28Macintosh%3B%20Intel%20Mac%20OS%20X%2010_15_7%29%20AppleWebKit%2F537.36%20%28KHTML,%20like%20Gecko%29%20Chrome%2F134.0.0.0%20Safari%2F537.36&channel=tiktok_web&cookie_enabled=true&data_collection_enabled=true&device_id=${device_id}&device_platform=web_pc&focus_state=true&from_page=user&history_len=8&is_fullscreen=false&is_page_visible=true&odinId=${odinId}&os=mac&priority_region=VN&referer=https%3A%2F%2Fwww.tiktok.com%2Fsignup%2Fcreate-username&region=VN&root_referer=https%3A%2F%2Fwww.tiktok.com%2Fsignup%2Fcreate-username&screen_height=982&screen_width=1512&tz_name=Asia%2FSaigon&user_is_login=true&verifyFp=${verifyFp}&webcast_language=vi-VN`;
        const formData = {
            file: fs.createReadStream(path_image),
            source: 0,
        };
        const headers = {
            "accept": "*/*",
            "accept-language": "en-US,en;q=0.9",
            "content-type": "application/x-www-form-urlencoded",
            'Cookie': cookie_string,
            "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
            'Origin': 'https://www.tiktok.com',
            'Referer': 'https://www.tiktok.com/',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "tt-csrf-token": tt_csrf_token,
            'sec-ch-ua': '"Google Chrome";v="134", "Chromium";v="134", "Not?A_Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'x-secsdk-csrf-token': 'DOWNGRADE',
        };
        const appVersionDefault = headers["User-Agent"].replace("Mozilla/", "")
        let url = `https://www.tiktok.com/api/upload/image/?WebIdLastTime=1757322143&aid=1988&app_language=en&app_name=tiktok_web&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=${encodeURIComponent("Linux x86_64")}&browser_version=${encodeRFC3986URIComponent(appVersionDefault)}&channel=tiktok_web&cookie_enabled=true&data_collection_enabled=true&device_id=${device_id}&device_platform=web_pc&focus_state=true&from_page=user&history_len=11&is_fullscreen=false&is_page_visible=true&odinId=${odinId}&os=mac&priority_region=VN&referer=&region=VN&root_referer=https%3A%2F%2Fwww.tiktok.com%2F&screen_height=1117&screen_width=1728&tz_name=Asia%2FSaigon&user_is_login=true&verifyFp=${verifyFp}&webcast_language=en&msToken=${msToken}`
        let bodyEncoded = querystring.stringify(formData);
        // let bodyEncoded = JSON.stringify(body)
        let bodyJson = JSON.stringify(formData)
        let res1 = await signreq({ url, bodyEncoded: bodyEncoded, bodyJson: bodyJson, msToken: msToken })
        // console.log("res",res1)
        url = res1.targetUrl
        // console.log(proxy)
        // process.exit(0)
        let res = await makeRequest({ url, headers, method: 'POST', proxy, formData })
        // console.log(res.bodyJson)
        // process.exit(0)
        return res.bodyJson;
        // const res = await axios.post(url, formData, {
        //   headers,
        //   proxy: proxy
        //     ? {
        //         host: proxy.split(':')[0],
        //         port: parseInt(proxy.split(':')[1]),
        //       }
        //     : false,
        //   timeout: 60000
        // });

        return res.data;
    } catch (e) {
        return { err: true, error: e.message };
    }
}
async function likeVideo({ aweme_id, proxy, cookie_string, retryCount, proxy_list = [] }) {
    try {
        let retry = retryCount || 0;
        let wid = getString(cookie_string.replace(/ /g, '') + ';', ';wid=', ';')
        let multi_sids = getString(cookie_string.replace(/ /g, '') + ';', ';multi_sids=', '%')
        let tt_csrf_token = getString(cookie_string.replace(/ /g, '') + ';', 'tt_csrf_token=', ';');
        let random_de = getRandomInt(187248723442, 934782374123);
        let device_id = wid || "7584943" + random_de;
        let odinId = multi_sids || "7544943" + getRandomInt(187248723442, 934782374123);
        let msToken = getString(cookie_string.replace(/ /g, '') + ';', 'msToken=', ';')

        let verifyFp = getString(cookie_string.replace(/ /g, '') + ';', 'verifyFp=', ';')
            || getString(cookie_string.replace(/ /g, '') + ';', 's_v_web_id=', ';');
        let webIdCreatedTime = getString(cookie_string.replace(/ /g, '') + ';', ';webIdCreatedTime=', ';')
        if (webIdCreatedTime == "") {
            let data_other = await getHome({ proxy, cookie_string, proxy_list: [proxy] })
            // console.log(data_other)
            if (data_other && data_other.webIdCreatedTime) {
                device_id = data_other.wid
                webIdCreatedTime = data_other.webIdCreatedTime
                odinId = data_other.odinId
            }
        }
        const formData = {};
        const headers = {
            "accept": "*/*",
            "accept-language": "en-US,en;q=0.9",
            "content-type": "application/x-www-form-urlencoded",
            'Cookie': cookie_string,
            "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
            'Origin': 'https://www.tiktok.com',
            'Referer': 'https://www.tiktok.com/',
            'save-data': 'on',
            'priority': 'u=1, i',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "tt-csrf-token": tt_csrf_token,
            'sec-ch-ua': '"Google Chrome";v="134", "Chromium";v="134", "Not?A_Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'x-secsdk-csrf-token': 'DOWNGRADE',
        };
        const appVersionDefault = headers["User-Agent"].replace("Mozilla/", "")
        let url1 = `https://www.tiktok.com/api/upload/image/?WebIdLastTime=1757322143&aid=1988&app_language=en&app_name=tiktok_web&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=${encodeURIComponent("Linux x86_64")}&browser_version=${encodeRFC3986URIComponent(appVersionDefault)}&channel=tiktok_web&cookie_enabled=true&data_collection_enabled=true&device_id=${device_id}&device_platform=web_pc&focus_state=true&from_page=user&history_len=11&is_fullscreen=false&is_page_visible=true&odinId=${odinId}&os=mac&priority_region=VN&referer=&region=VN&root_referer=https%3A%2F%2Fwww.tiktok.com%2F&screen_height=1117&screen_width=1728&tz_name=Asia%2FSaigon&user_is_login=true&verifyFp=${verifyFp}&webcast_language=en&msToken=${msToken}`
        let url = `https://www.tiktok.com/api/commit/item/digg/?WebIdLastTime=${webIdCreatedTime}&aid=1988&app_language=vi-VN&app_name=tiktok_web&aweme_id=${aweme_id}&browser_language=vi&browser_name=Mozilla&browser_online=true&browser_platform=${encodeURIComponent("Linux x86_64")}&browser_version=${encodeRFC3986URIComponent(appVersionDefault)}&channel=tiktok_web&cookie_enabled=true&data_collection_enabled=true&device_id=${device_id}&device_platform=web_pc&focus_state=true&from_page=video&history_len=10&is_fullscreen=false&is_page_visible=true&odinId=${odinId}&os=mac&priority_region=VN&referer=&region=VN&root_referer=https%3A%2F%2Fwww.tiktok.com%2Fforyou&screen_height=1107&screen_width=1710&type=1&tz_name=Asia%2FSaigon&user_is_login=true&verifyFp=${verifyFp}&webcast_language=vi-VN`
        let bodyEncoded = querystring.stringify(formData);
        // let bodyEncoded = JSON.stringify(body)
        let bodyJson = JSON.stringify(formData)
        let res1 = await signreq({ url, bodyEncoded: bodyEncoded, bodyJson: bodyJson, msToken: msToken })
        // console.log("res",res1)
        url = res1.targetUrl
        // console.log(proxy)
        // console.log(url, headers)
        // process.exit(0)
        let res = await makeRequest({ url, headers, method: 'POST', proxy, formData })
        // console.log(res.bodyJson)
        // process.exit(0)
        return res.bodyJson;
        // const res = await axios.post(url, formData, {
        //   headers,
        //   proxy: proxy
        //     ? {
        //         host: proxy.split(':')[0],
        //         port: parseInt(proxy.split(':')[1]),
        //       }
        //     : false,
        //   timeout: 60000
        // });

        return res.data;
    } catch (e) {
        return { err: true, error: e.message };
    }
}
async function getHome({ proxy, cookie_string, proxy_list }) {
    const options = {
        retryTime: 3,

        url: `https://www.tiktok.com/`,
        method: 'GET',
        headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
            cookie: cookie_string
        },
        proxy,
        preCheckRetry: (body, json) => {
            return !body.includes('"user_id"');

        },
        proxy_list: proxy_list
    }
    let res = await makeRequest(options)
    let { body, bodyJson, status, headers, error } = res;
    let wid = getString(body, '"wid":"', '"')
    let webIdCreatedTime = getString(body, '"webIdCreatedTime":"', '"')
    let odinId = getString(body, '"odinId":"', '"')
    return { wid, webIdCreatedTime, odinId }
}
function xorHexEncode(str, key = 0x05) {
    const buf = Buffer.from(str, 'utf8');
    for (let i = 0; i < buf.length; i++) buf[i] ^= key;
    return buf.toString('hex');
}
async function setCreateUsername({ username, proxy, cookie_string, retryCount, proxy_list = [] }) {
    try {
        //https://web-sg.tiktok.com/passport/web/account/set/?multi_login=1&did=7548747322751452690&locale=vi-VN&app_language=vi&aid=1459&account_sdk_source=web&sdk_version=2.1.11-tiktokbeta.3&language=vi&verifyFp=verify_mff5m6uu_U8kcrmSO_vo9T_4De4_8Fmh_EJZcH2WONmJy&target_aid=&standalone_aid=&shark_extra=%7B%22aid%22:1459,%22app_name%22:%22Tik_Tok_Login%22,%22channel%22:%22tiktok_web%22,%22device_platform%22:%22web_pc%22,%22device_id%22:%227548747322751452690%22,%22region%22:%22VN%22,%22priority_region%22:%22%22,%22os%22:%22mac%22,%22referer%22:%22%22,%22cookie_enabled%22:true,%22screen_width%22:4096,%22screen_height%22:2160,%22browser_language%22:%22vi%22,%22browser_platform%22:%22MacIntel%22,%22browser_name%22:%22Mozilla%22,%22browser_version%22:%225.0+(Macintosh%3B+Intel+Mac+OS+X+10_15_7)+AppleWebKit%2F537.36+(KHTML,+like+Gecko)+Chrome%2F139.0.0.0+Safari%2F537.36%22,%22browser_online%22:true,%22verifyFp%22:%22verify_mff5m6uu_U8kcrmSO_vo9T_4De4_8Fmh_EJZcH2WONmJy%22,%22app_language%22:%22vi-VN%22,%22webcast_language%22:%22vi-VN%22,%22tz_name%22:%22Asia%2FSaigon%22,%22is_page_visible%22:true,%22focus_state%22:true,%22is_fullscreen%22:false,%22history_len%22:6,%22user_is_login%22:false,%22data_collection_enabled%22:false%7D&msToken=8jbxcO9iaw46pNhoJjXBM7h93DYqEdyMjedgqk_J2_kNppiW2hdWO_Rcr17o_NIJ8LUjFfEY_pv27i4nx21DC036kkWNWEIHsVmsIIxkKl1uvC1CBNUfzq32ycyt7FOOxP84yC12Bf6pGQMOlmfoiHM=&X-Bogus=DFSzswVLb7G/lewrCH2//XhGbwJH&X-Gnarly=Mk-H3v3eV3TTAfE-UTBcFUupbhobukFGSu-dea9TFpyrKk3GjYjKMLbRSMNkaD2KrzYHhRkpaTPM2hzljW6Uk3iYBzvpupUelkYLRIIPP-fc4vfByGXP43b2-SYROIW/Iwzjy-IFjUi0m7ZM-vpKsvHoFFxZ8WR3b2-0D5G7g7RtwhEoK/dJ4zycy02Dn/aCTpdKyTZa/UGCha6S1ZIqemJE2dAfCneA53lsbVncykb7Nldub8tl6-iKO-SAFGFywzVakDcms46gmpDqloM3jz9OzOeAtvUnvG23V3GiA0mF body mix_mode=1&username=6d6a687c6e6c6070343d36343c3c32&aid=1459&is_sso=false&account_sdk_source=web&region=VN&language=vi&locale=vi-VN&did=7548747322751452690&fixed_mix_mode=1
        let retry = retryCount || 0;
        let wid = getString(cookie_string.replace(/ /g, '') + ';', ';wid=', ';')
        let multi_sids = getString(cookie_string.replace(/ /g, '') + ';', ';multi_sids=', '%')
        let tt_csrf_token = getString(cookie_string.replace(/ /g, '') + ';', 'tt_csrf_token=', ';');
        let random_de = getRandomInt(187248723442, 934782374123);
        let device_id = wid || "7584943" + random_de;
        let odinId = multi_sids || "7544943" + getRandomInt(187248723442, 934782374123);
        let msToken = getString(cookie_string.replace(/ /g, '') + ';', 'msToken=', ';')

        let verifyFp = getString(cookie_string.replace(/ /g, '') + ';', 'verifyFp=', ';')
            || getString(cookie_string.replace(/ /g, '') + ';', 's_v_web_id=', ';');
        const form = {
            mix_mode: 1,
            username: xorHexEncode(username),
            aid: 1459,
            is_sso: false,
            account_sdk_source: 'web',
            region: 'VN',
            language: 'vi',
            locale: 'vi-VN',
            did: device_id,
            fixed_mix_mode: 1,
        };
        const headers = {
            "accept": "*/*",
            "accept-language": "en-US,en;q=0.9",
            "content-type": "application/x-www-form-urlencoded",
            'Cookie': cookie_string,
            "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
            'Origin': 'https://www.tiktok.com',
            'Referer': 'https://www.tiktok.com/',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "tt-csrf-token": tt_csrf_token,
            'sec-ch-ua': '"Google Chrome";v="134", "Chromium";v="134", "Not?A_Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'x-secsdk-csrf-token': 'DOWNGRADE',
        };
        const appVersionDefault = headers["User-Agent"].replace("Mozilla/", "")
        // let url = `https://web-sg.tiktok.com/passport/web/account/set/?multi_login=1&did=${device_id}&locale=vi-VN&app_language=vi&aid=1459&account_sdk_source=web&sdk_version=2.1.11-tiktokbeta.3&language=vi&verifyFp=${verifyFp}&target_aid=&standalone_aid=&shark_extra=${encodeURIComponent('{"aid":1459,"app_name":"Tik_Tok_Login","channel":"tiktok_web","device_platform":"web_pc","device_id":"'+device_id+'","region":"VN","priority_region":"","os":"mac","referer":"","cookie_enabled":true,"screen_width":1728,"screen_height":1117,"browser_language":"vi","browser_platform":"Linux x86_64","browser_name":"Mozilla","browser_version":"'+appVersionDefault+'","browser_online":true,"verifyFp":"'+verifyFp+'","app_language":"vi-VN","webcast_language":"vi-VN","tz_name":"Asia/Saigon","is_page_visible":true,"focus_state":true,"is_fullscreen":false,"history_len":6,"user_is_login":false,"data_collection_enabled":false}')}&msToken=${msToken}`
        let shark_extra = {
            aid: 1459,
            app_name: "Tik_Tok_Login",
            channel: "tiktok_web",
            device_platform: "web_pc",
            device_id: device_id,
            region: "VN",
            priority_region: "",
            os: "mac",
            referer: "",
            cookie_enabled: true,
            screen_width: 1728,
            screen_height: 1117,
            browser_language: "vi",
            browser_platform: "Linux x86_64",
            browser_name: "Mozilla",
            browser_version: appVersionDefault,
            browser_online: true,
            verifyFp: verifyFp,
            app_language: "vi-VN",
            webcast_language: "vi-VN",
            tz_name: "Asia/Saigon",
            is_page_visible: true,
            focus_state: true,
            is_fullscreen: false,
            history_len: 6,
            user_is_login: false,
            data_collection_enabled: false
        };

        // encode JSON
        let shark_extra_encoded = encodeURIComponent(JSON.stringify(shark_extra));

        let url = `https://web-sg.tiktok.com/passport/web/account/set/?multi_login=1&did=${device_id}&locale=vi-VN&app_language=vi&aid=1459&account_sdk_source=web&sdk_version=2.1.11-tiktokbeta.3&language=vi&verifyFp=${verifyFp}&target_aid=&standalone_aid=&shark_extra=${shark_extra_encoded}&msToken=${msToken}`;
        //   console.log(url);
        //   process.exit(0)
        let bodyEncoded = querystring.stringify(form);
        let bodyJson = JSON.stringify(form)
        let res1 = await signreq({ url, bodyEncoded: bodyEncoded, bodyJson: bodyJson, msToken: msToken })
        url = res1.targetUrl
        console.log("url", url, form)
        // process.exit(0)
        let res = await makeRequest({ url, headers, method: 'POST', proxy, formData: form })
        return res.bodyJson;
    } catch (e) {
        return { err: true, error: e.message };
    }
}
function buildUpdateProfileUrl({ nickname, signature, avatar_uri, user_agent, cookie_string, webIdCreatedTime }) {
    let wid = getString(cookie_string.replace(/ /g, '') + ';', ';wid=', ';')
    let multi_sids = getString(cookie_string.replace(/ /g, '') + ';', ';multi_sids=', '%')
    let tt_csrf_token = getString(cookie_string.replace(/ /g, '') + ';', 'tt_csrf_token=', ';');
    let random_de = getRandomInt(187248723442, 934782374123);
    let device_id = wid || "7584943" + random_de;
    let odinId = multi_sids || "7544943" + getRandomInt(187248723442, 934782374123);
    let msToken = getString(cookie_string.replace(/ /g, '') + ';', 'msToken=', ';')

    let verifyFp = getString(cookie_string.replace(/ /g, '') + ';', 'verifyFp=', ';')
        || getString(cookie_string.replace(/ /g, '') + ';', 's_v_web_id=', ';');
    const appVersionDefault = user_agent.replace("Mozilla/", "")
    //take browser_platform from user_agent
    let string_req = `fetch("https://www.tiktok.com/api/update/profile/?WebIdLastTime=${webIdCreatedTime}&aid=1988&app_language=en&app_name=tiktok_web&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=MacIntel&browser_version=${encodeRFC3986URIComponent(appVersionDefault)}&channel=tiktok_web&cookie_enabled=true&data_collection_enabled=true&device_id=${device_id}&device_platform=web_pc&focus_state=true&from_page=user&history_len=11&is_fullscreen=false&is_page_visible=true&odinId=${odinId}&os=mac&priority_region=VN&referer=https%3A%2F%2Fwww.tiktok.com%2F&region=VN&root_referer=https%3A%2F%2Fwww.tiktok.com%2F&screen_height=1117&screen_width=1728&tz_name=Asia%2FSaigon&user_is_login=true&verifyFp=${verifyFp}&webcast_language=en", {
        "headers": {
          "accept": "*/*",
          "accept-language": "en-US,en;q=0.9",
          "content-type": "application/x-www-form-urlencoded",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "tt-csrf-token": "${tt_csrf_token}",
          "x-cthulhu-csrf": "1",
          'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'x-secsdk-csrf-token': 'DOWNGRADE',
        },
        "referrer": "https://www.tiktok.com/",
        "body": "avatar_uri=${avatar_uri}&nickname=${nickname}&tt_csrf_token=${tt_csrf_token}",
        "method": "POST",
        "mode": "cors",
        "credentials": "include"
      });`
    return string_req
}
/*
fetch("https://www.tiktok.com/api/uniqueid/check/?aid=1988&app_language=vi-VN&app_name=tiktok_web&browser_language=vi&browser_name=Mozilla&browser_online=true&browser_platform=MacIntel&browser_version=5.0%20%28Macintosh%3B%20Intel%20Mac%20OS%20X%2010_15_7%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F139.0.0.0%20Safari%2F537.36&channel=tiktok_web&cookie_enabled=true&data_collection_enabled=false&device_id=7548854055809533441&device_platform=web_pc&focus_state=true&fromWeb=1&from_page=&history_len=6&is_fullscreen=false&is_page_visible=true&os=mac&priority_region=&referer=&region=VN&screen_height=240&screen_width=320&tz_name=Asia%2FBangkok&unique_id=fsdfdsfds&user_is_login=false&verifyFp=verify_mffkeoux_jbEM5OcE_M0nh_4DQr_9uLh_qwcNMyclq69u&webcast_language=vi-VN&msToken=Jn1_nNM9w7X0ZlGKdL3maG8oY2rPT_JCYZm9IIzddYIprHo5AuFGvlJ8PGmzQI8Zq80g89s_s5WugPtKB9aeiL9kQRjEs7SnXQi4pdi3VFndMho-NkIa9-lsZbJ5aHvar8Ogjack3bAYor1l90GD_Ns=&X-Bogus=DFSzswVLwniANewrCHRFOxhGbwne&X-Gnarly=MwpXMSs5pv1l9qvkumuVe4FR99fqdjiP5mBwT5wprEgfsl-0Loufw7eCrazmCOmoFaQ5wRy594zgTF-ivzg8z3uoR4LKIfhm8gLzvHKmCqagbQzK7JUgZfGz/cYQr/R361-rtc3tRfPAkAQs03eV/3ftfnVFc4VnXz5fLFGeBfW4HgxsWboz2F3gziPEQOq2eaMxdlAgxMkXo3vyUBA7g8a42WRNOAefV/V7ycpXkXY54c1hRoGyV9mn7HyIFfMPB5N9iUFRuwgmsnvdc4VkVbcp4vXOVxQGLUz14/WD27pq", {
  "headers": {
    "accept": "",
    "accept-language": "vi,vi-VN;q=0.9,en-US;q=0.8,en;q=0.7",
    "priority": "u=1, i",
    "save-data": "on",
    "sec-ch-ua": "\"Not;A=Brand\";v=\"99\", \"Google Chrome\";v=\"139\", \"Chromium\";v=\"139\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "x-mssdk-info": "aS1Nax3w.ZMmGJEpLCFL6XiYwq0QD4R6eXatIKAAg5WUKQ1sFe6kZZNMKvq8ZEstQGlBdwQbfNXuFim7Wl9ZMaHzOMqC53EgxHEto3OEJAIo6DQX067-DCYFiDuSc.axQcBA3Q.RXABMoGcLdO7yldSc7KNDGBZOg5wJhAtaeXkcrA9Od9vyIkMpBDwJahBTnYdbfPn9qbf.mUeTyp6UZA.JwMj44pDNnercvSLrES0UZsLS2XTAyM0WrLtE6XAKPdpX4cSAysZeqBeyg8dmm5xqYmYHLe6a8.0EPzSHp5pNjY6ji9raN8aLKzm78GrA.0taE.hUR3bBfLWBJgsxiDX2HWjBPc608LxZUr3WzprVsFjuIeAwk4gDF.u9Vgx77KM3nqLvfhDSZ5PcxZQb7wT73oKtRuD8XpVKpwR7SRF1GxcW.dgTrNaUQ4zsTwX4g2ITDkjuqYN4Q3FqP71Bd1gP0Wpyogi5JfdOt35XHcoAtHgTMWIZxp8z6ge.QhubPo5VQf4gJ4MhIQW0XEQUp38.Lz2r3oeXsbnLq6mQJZiHuJIdpInv8QdBqgp7YHN745M10VdTc8QioDL5rx9NBwJFcXg2J5hMYK5E06zalBUGNLi.Sl4VjJA4eK1Om3GlUIZExtRvfBzdS-bMSa1S0XbedSs5khBe5KFt.U6haruusPc5dgML1Q6agpLHLKjvhO-PGZDqd4aaBXcMvvOM6eCs6D.R0J9jEZxDfP8BW4i8VfFKnzcNru8M.K06XjkWV3FQswLV6FolGnhGzYazOg7gxp0HHKPd-vvxiVFCCklMtaomDquD2U.pYeweljUKviBlS.G99NNZD8Od1c1vUcYjDe6b0-nGCHR6QlP7dEGTQwFws8gNeQjhSA9GolBsFOhzBfEKP1Wnmx2rHEEWbKcJ9Eb19xVSdkAP.EikQC7.5FBE8xDB.Fa5aDF146WkpZ4DmRkF0wagzwKGAnlYhIz0rTiBlTrsX17H82kqju8dqLfRlsWAjTXh0cFTvj.GATgb5YuWv0VJY9EcIAn9GiCif1.Kq0QpZCe.7si1bjh1TsYNT84FlNTCjNSvQ6sCLzgkX4Bq78UDeeP.wl27pnIS1jw7L5S2JiUfn0x6QHL.MdzHyCqiXK27B3dT98NAftjXBVr.OmvAUhekYnq0ktUCUtPkcc9Us-3dtSekQCrM1o-c8Lf4KXbbIDO8xPCfavDNb2jjk-A-CxRGUq.HtBAOoCgS1olcgqZRYpH-aWyRfMYbVDE2hyZ39WZ45UWoVtuAlNnHmzLyZIfZ9zV1kYW71xM6QNhuOF1PHOjpOO-06qjkEFYlDQi85MqjX4ZijTu3JacNogSlY6RAzVHhbe.4HH-INa-MKkVmoY8ZUW7U3oMkuYj9H2GxVdpjSG.M8qQ8LOSoyna9I.vKD3Df9ZunCoYwvV-gejEyGz40dG.xx23P-NoZf8coaJ8aGAui.QlJTYY2NYb1XS4FtHHR2vGlGk6YT0b..R8v4yVtMS5l3kOLcpmjIVXjHhgEkBe1tLS2QEbtEMgihHuzpoMz5U3G-AYjXwLQoaEARY3lUosWjawzdRMLm4rEz-Nv0dSVDkFDEHy5cJOjYIBwquktAGFS6FflypF87UELk-QZ9y0G3zTEm018b3ylSQpP2k75J4X9qGRQYajGBlF5xMHW913JopnIdYee2A.Da2h19F5DNAivb7lGcadIcCsYWWNiCFk4Vuu1YoVNzeuGmmG0dGDFpzPLhwpMfbCSpGIgIlMWXUqzbMMyQpafKfBZvpveMddTF3TdnzUR83k3g0Y5RafW8PigXIwiP.Y-Ifi4zsNaYTH9ycNk8ZuZNBixQRI6lct6xnkNgHXjBsDSAWxn-iypDaxuL08conlZeMIPDDe40G1mZ6XEEWcwECRWcRf4P.-UXqxtbCjczYF-zmjFsAPg0x40MommCYuEqbx3QzJiegAg8udsKR2jJ-yEPn2W1bvRzy42ozru0Ghz3Le2I6hoLpwas2oFrkW3zmSp07IrD0dBC0xbmb-8kM0DGrChceE0tC9JKk88a-Rxbs96gbo-h-6fkLXdvoUCbdBpPm8WhWBFGxQKpSHSDXHWfClAvJaQ366NQgFJPy7ORrk105xR4I-12xeMd4H9e6xL7vgM7cDvhVW1hK-NFsfflQrTD9yLQdAvxwKyIYZOfMCz4OX0MQ3gokjO.uRM8xYSeOHyDkwh6b0vUQUu75yHVHL0o7ZzsJ4v3jdEziRUEMXQwn.f8gzZNJIv6r8eaGSXWre9lN61bEVIWKj6fQ9wxXhhH10IUq-rqVdPiE91qq32PALx9nkgbRfv1wmfrIfU7IT8R4CGQZvCr8VlDkMgjBaaWyOlFzr9qFyfR96vsn7ouUdfSLoYOXn-Z7DjqO6efCNCuwt41-9nY-j5dzMKeYWRlTkunaGQSVIuCl2-1CGa2pNJ7.5E-z8t0Zfd49WfOLwZ3Y06MBEXxMlfVibqJ6c4cjtcv128QabCejaK01Xwxbi7Bjt9BL-8ecbllqC2TzikMPQLYmZ8beF9wxX8OFh-3vlyAGYjBUh.msjcUpDN6vRO2qRrg1vnLfmFrxf7beV8fKdmsCbrLwXZKDZ.cH9xyO3nc8uEk0gdTlFlt8-dzcAdnGWBCoP7FuPbLSVdzKBoLw4AiidDDUmagNKe9J5.5ukk3j0TyDBASzJuSxMdslHBHjDpCBkqrpNCdCH8fhTvPYHpmWVToLiYiLdauh8pf6sypfNF2eh8WSUqWAjbd07JAcyo7TldtXOJhlqjU5x2MWYngBI3xzgloFky5TJYh4z3P8D1mT07xFV8tW.YayWRpqRYaycyBVKscTR5U.uLA4G-tlIzYsO9SNsosdf.ys.W-YI2lDZDYNnL5ar9cD.-5H-6YigRPvFaWjrs-hliTuZ1A2ippaIMCIXkrb.2ct8IoLBjKXpWG3QtdhhGHFKQVLZ5blbuORm7RRC4..C6ftcbBBEciMsQWFfxSMggXXp.L-UOLGgzga4JYDbJfFhkCyxh5K.xe1xp-6MbCmlZaOWm4SjuKTFEj35PLwMewCVqN5AUkmzC1JNsNGPCZV47bdMUYY4wsCBVbbygTKCKJ5IiLQGY-4w6hRg4QOAu483C8MB.xrjcyf0TDqNuFMK8u3koECBPWKApCP5xjoZocyYdq0SR4v-GZGog8Hf1f1dEUtwIkUURaHNwqkG97cxn2Sq-JQ.-zmHioL8l4ofw-eNPrUE6IflNtDP.4E2uly1oh41R.-WZ28qxVZYBwAyc5li.1AiqvkOLCYtGl.AuXgT.M1gA6nUS3fMXMjsveLIA4P95OZqBUuPgJ3hIBEHElYkmeP3fc9Os7gsBFYjSvOR8skW4R-qLNid3hpA9bsXFYurE4F4QFod27Z8pQWeM5lFU5sii.gIFdMLDuPWOwer3sm.TtEfvmVAKgoDQ9ND7oqOmIIaOq-Skrh7.lGnKLAhhfhdBSK5VSQRmS96ULY6izasszRO8TKyT2kc8KoriFOD5sjDRLdANl9q9zwgzDYKs2UVdexv7mJ2nm257z2KtDPcUu5AAjhceYykfMzspALrv3Yv0BAJaK-Bxiqkkh6PseU0yVvSMYjVW2-Y99Us4YqwvXmRgR93nPXT2uJLLTa8sP2BNR.U6bZJO67BS4zYeUh3qZhZZD.aIdaO0m.y3KF8lxpy5qQtOnjXLah4fYFwzHOJoJHef0Ub5n-8Zs-Ew5LCvLCFumd7XPMNIKW3HVpP00LuEOw4q66klTDAGFVJJd0zsKl3dq3sqJLwtD2ME1hAO.vo1Zk13dgT4sjD02V3kCRzMPF-K4cnZpmSNoUdWHBO-brc8Gw8SvvSCuL-By6ubLQNLKGnOJ-F0SHR2sVcSN0Hcy4hXyGYr.Zm0wOihetUOLld0SPEMd7qTFP8xO-UJrBXsqMKalz3TsTGXPQ8GT9n4WaFAGCwQrgbr4GOeETezg90="
  },
  "referrer": "https://www.tiktok.com/signup/create-username",
  "body": null,
  "method": "GET",
  "mode": "cors",
  "credentials": "include"
});
*/
//

function buildUpdateProfileUrlJSON({ nickname, signature, username, avatar_uri, user_agent, cookie_string, webIdCreatedTime }) {
    let wid = getString(cookie_string.replace(/ /g, '') + ';', ';wid=', ';')
    let multi_sids = getString(cookie_string.replace(/ /g, '') + ';', ';multi_sids=', '%')
    let tt_csrf_token = getString(cookie_string.replace(/ /g, '') + ';', 'tt_csrf_token=', ';');
    let random_de = getRandomInt(187248723442, 934782374123);
    let device_id = wid || "7584943" + random_de;
    let odinId = multi_sids || "7544943" + getRandomInt(187248723442, 934782374123);
    let msToken = getString(cookie_string.replace(/ /g, '') + ';', 'msToken=', ';')

    let verifyFp = getString(cookie_string.replace(/ /g, '') + ';', 'verifyFp=', ';')
        || getString(cookie_string.replace(/ /g, '') + ';', 's_v_web_id=', ';');
    const appVersionDefault = user_agent.replace("Mozilla/", "")
    // let body = `avatar_uri=${encodeURIComponent(avatar_uri)}&nickname=${encodeURIComponent(nickname).replace(/'/g,"%27").replace(/"/g,"%22")}&tt_csrf_token=${encodeURIComponent(tt_csrf_token)}`
    // if(!avatar_uri){
    //     body = `nickname=${encodeURIComponent(nickname).replace(/'/g,"%27").replace(/"/g,"%22")}&tt_csrf_token=${encodeURIComponent(tt_csrf_token)}`
    // }
    let body = `tt_csrf_token=${encodeURIComponent(tt_csrf_token)}`
    if (nickname) {
        body = `nickname=${encodeURIComponent(nickname).replace(/'/g, "%27").replace(/"/g, "%22")}&${body}`
    }
    if (username) {
        body = `login_name=${encodeURIComponent(username)}&${body}`
    }
    if (avatar_uri) {
        body = `avatar_uri=${encodeURIComponent(avatar_uri)}&${body}`
    }
    // console.log(body)
    let browser_platform = "MacIntel"
    if (user_agent.includes("Linux")) {
        browser_platform = encodeURIComponent("Linux x86_64");
    }
    if (user_agent.includes("Windows")) {
        //Win32
        browser_platform = "Win32"
    }
    if (user_agent.includes("Android")) {
        browser_platform = encodeURIComponent("Linux armv81");
    }
    const data_json = {
        "url": `https://www.tiktok.com/api/update/profile/?WebIdLastTime=${webIdCreatedTime}&aid=1988&app_language=en&app_name=tiktok_web&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=${browser_platform}&browser_version=${encodeRFC3986URIComponent(appVersionDefault)}&channel=tiktok_web&cookie_enabled=true&data_collection_enabled=true&device_id=${device_id}&device_platform=web_pc&focus_state=true&from_page=user&history_len=11&is_fullscreen=false&is_page_visible=true&odinId=${odinId}&os=mac&priority_region=VN&referer=https%3A%2F%2Fwww.tiktok.com%2F&region=VN&root_referer=https%3A%2F%2Fwww.tiktok.com%2F&screen_height=1117&screen_width=1728&tz_name=Asia%2FSaigon&user_is_login=true&verifyFp=${verifyFp}&webcast_language=en`,
        "headers": {
            "accept": "*/*",
            "accept-language": "en-US,en;q=0.9",
            "content-type": "application/x-www-form-urlencoded",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "tt-csrf-token": `${tt_csrf_token}`,
            "x-cthulhu-csrf": "1",
            'sec-ch-ua-mobile': '?0',
            //   'sec-ch-ua-platform': '"macOS"',
            'x-secsdk-csrf-token': 'DOWNGRADE',
        },
        "referrer": "https://www.tiktok.com/",
        "body": body,
        "method": "POST",
        "mode": "cors",
        "credentials": "include"
    }
    return data_json
}
function buildUserDetailUrlJSON({ username, user_agent, cookie_string, webIdCreatedTime }) {
    cookie_string = cookie_string || '';
    user_agent = user_agent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36';
    let wid = getString(cookie_string.replace(/ /g, '') + ';', ';wid=', ';')
    let multi_sids = getString(cookie_string.replace(/ /g, '') + ';', ';multi_sids=', '%')
    let tt_csrf_token = getString(cookie_string.replace(/ /g, '') + ';', 'tt_csrf_token=', ';');
    let random_de = getRandomInt(187248723442, 934782374123);
    let device_id = wid || "7621542894663763463";
    let odinId = multi_sids || "7624152731981349896";
    let msToken = getString(cookie_string.replace(/ /g, '') + ';', 'msToken=', ';')
        || "KqPPxU8UNmdoerw80_XX6DtsvJW3wl8dEWvpPhnRBKprl8Zx-WuBdHuflhx1PurNXn2GWJVZicscEfxYxe3llLaru8v_1tGUsJGCzPodwwscpJF7eRgDEAvLLYd73AVJiya1swbb_LWjiFF3zI3jCQlWVw==";

    let verifyFp = getString(cookie_string.replace(/ /g, '') + ';', 'verifyFp=', ';')
        || getString(cookie_string.replace(/ /g, '') + ';', 's_v_web_id=', ';')
        || "verify_mmxlu2ay_Et9mVjSA_55K9_4aqL_8YVJ_fHCwXox1Xk1y";
    const appVersionDefault = user_agent.replace("Mozilla/", "")
    let browser_platform = "MacIntel"
    if (user_agent.includes("Linux")) {
        browser_platform = encodeURIComponent("Linux x86_64");
    }
    if (user_agent.includes("Windows")) {
        browser_platform = "Win32"
    }
    if (user_agent.includes("Android")) {
        browser_platform = encodeURIComponent("Linux armv81");
    }

    let match = user_agent.match(/Chrome\/([\d.]+)/);
    let chromeVersion = match ? match[1].split('.')[0] : '147';
    let sec_ch_ua = `"Google Chrome";v="${chromeVersion}", "Not.A/Brand";v="8", "Chromium";v="${chromeVersion}"`;

    let sec_ch_ua_platform = '"macOS"';
    if (user_agent.includes("Windows")) {
        sec_ch_ua_platform = '"Windows"';
    } else if (user_agent.includes("Linux")) {
        sec_ch_ua_platform = '"Linux"';
    }

    const data_json = {
        "url": `https://www.tiktok.com/api/user/detail/?WebIdLastTime=${webIdCreatedTime || 1774528743}&abTestVersion=%5Bobject%20Object%5D&aid=1988&appType=t&app_language=en&app_name=tiktok_web&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=${browser_platform}&browser_version=${encodeRFC3986URIComponent(appVersionDefault)}&channel=tiktok_web&cookie_enabled=true&data_collection_enabled=true&device_id=${device_id}&device_platform=web_pc&focus_state=true&from_page=user&history_len=17&is_fullscreen=false&is_page_visible=true&language=en&needAudienceControl=false&odinId=${odinId}&os=mac&priority_region=VN&referer=&region=VN&root_referer=https%3A%2F%2Fwww.tiktok.com%2F&screen_height=1117&screen_width=1728&secUid=&tz_name=Asia%2FSaigon&uniqueId=${username}&user=%5Bobject%20Object%5D&user_is_login=true&verifyFp=${verifyFp}&webcast_language=en&msToken=${msToken}`,
        "headers": {
            "accept": "*/*",
            "accept-language": "en-US,en;q=0.9,vi;q=0.8,ht;q=0.7",
            "cache-control": "no-cache",
            "pragma": "no-cache",
            "priority": "u=1, i",
            "sec-ch-ua": sec_ch_ua,
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": sec_ch_ua_platform,
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin"
        },
        "referrer": `https://www.tiktok.com/@${username}`,
        "body": null,
        "method": "GET",
        "mode": "cors",
        "credentials": "include"
    }
    return data_json
}
function buildUploadImageUrlJSON({ path_image, user_agent, cookie_string, webIdCreatedTime }) {
    let wid = getString(cookie_string.replace(/ /g, '') + ';', ';wid=', ';')
    let multi_sids = getString(cookie_string.replace(/ /g, '') + ';', ';multi_sids=', '%')
    let tt_csrf_token = getString(cookie_string.replace(/ /g, '') + ';', 'tt_csrf_token=', ';');
    let random_de = getRandomInt(187248723442, 934782374123);
    let device_id = wid || "7584943" + random_de;
    let odinId = multi_sids || "7544943" + getRandomInt(187248723442, 934782374123);
    let msToken = getString(cookie_string.replace(/ /g, '') + ';', 'msToken=', ';')

    let verifyFp = getString(cookie_string.replace(/ /g, '') + ';', 'verifyFp=', ';')
        || getString(cookie_string.replace(/ /g, '') + ';', 's_v_web_id=', ';');

    const appVersionDefault = user_agent.replace("Mozilla/", "")

    let browser_platform = "MacIntel"
    if (user_agent.includes("Linux")) {
        browser_platform = encodeURIComponent("Linux x86_64");
    }
    if (user_agent.includes("Windows")) {
        browser_platform = "Win32"
    }
    if (user_agent.includes("Android")) {
        browser_platform = encodeURIComponent("Linux armv81");
    }

    let webIdLastTime = webIdCreatedTime || 1757322143;

    let url = `https://www.tiktok.com/api/upload/image/?WebIdLastTime=${webIdLastTime}&aid=1988&app_language=en&app_name=tiktok_web&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=${browser_platform}&browser_version=${encodeRFC3986URIComponent(appVersionDefault)}&channel=tiktok_web&cookie_enabled=true&data_collection_enabled=true&device_id=${device_id}&device_platform=web_pc&focus_state=true&from_page=user&history_len=11&is_fullscreen=false&is_page_visible=true&odinId=${odinId}&os=mac&priority_region=VN&referer=&region=VN&root_referer=https%3A%2F%2Fwww.tiktok.com%2F&screen_height=1117&screen_width=1728&tz_name=Asia%2FSaigon&user_is_login=true&verifyFp=${verifyFp}&webcast_language=en&msToken=${msToken}`

    const base64Data = base64_encode(path_image);

    return {
        url: url,
        headers: {
            "accept": "*/*",
            "accept-language": "en-US,en;q=0.9",
            "tt-csrf-token": tt_csrf_token,
            "x-secsdk-csrf-token": "DOWNGRADE",
            "x-cthulhu-csrf": "1"
        },
        base64Data: base64Data
    };
}
function buildSetUsernameUrlJSON({ username, user_agent, cookie_string, webIdCreatedTime }) {
    let wid = getString(cookie_string.replace(/ /g, '') + ';', ';wid=', ';')
    let multi_sids = getString(cookie_string.replace(/ /g, '') + ';', ';multi_sids=', '%')
    let tt_csrf_token = getString(cookie_string.replace(/ /g, '') + ';', 'tt_csrf_token=', ';');
    let random_de = getRandomInt(187248723442, 934782374123);
    let device_id = wid || "7584943" + random_de;
    let odinId = multi_sids || "7544943" + getRandomInt(187248723442, 934782374123);
    let msToken = getString(cookie_string.replace(/ /g, '') + ';', 'msToken=', ';')

    let verifyFp = getString(cookie_string.replace(/ /g, '') + ';', 'verifyFp=', ';')
        || getString(cookie_string.replace(/ /g, '') + ';', 's_v_web_id=', ';');
    const appVersionDefault = user_agent.replace("Mozilla/", "")
    let shark_extra = {
        aid: 1459,
        app_name: "Tik_Tok_Login",
        channel: "tiktok_web",
        device_platform: "web_pc",
        device_id: device_id,
        region: "VN",
        priority_region: "",
        os: "mac",
        referer: "",
        cookie_enabled: true,
        screen_width: 1728,
        screen_height: 1117,
        browser_language: "vi",
        browser_platform: "MacIntel",
        browser_name: "Mozilla",
        browser_version: appVersionDefault,
        browser_online: true,
        verifyFp: verifyFp,
        app_language: "vi-VN",
        webcast_language: "vi-VN",
        tz_name: "Asia/Saigon",
        is_page_visible: true,
        focus_state: true,
        is_fullscreen: false,
        history_len: 6,
        user_is_login: false,
        data_collection_enabled: false
    };

    // encode JSON
    let shark_extra_encoded = encodeURIComponent(JSON.stringify(shark_extra));
    // like "139.0.0.0"
    const match = user_agent.match(/Chrome\/([\d.]+)/);
    let version_browser = match ? match[1] : null;
    const data_json = {
        // "url": `https://www.tiktok.com/api/update/profile/?WebIdLastTime=${webIdCreatedTime}&aid=1988&app_language=en&app_name=tiktok_web&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=MacIntel&browser_version=${encodeRFC3986URIComponent(appVersionDefault)}&channel=tiktok_web&cookie_enabled=true&data_collection_enabled=true&device_id=${device_id}&device_platform=web_pc&focus_state=true&from_page=user&history_len=11&is_fullscreen=false&is_page_visible=true&odinId=${odinId}&os=mac&priority_region=VN&referer=https%3A%2F%2Fwww.tiktok.com%2F&region=VN&root_referer=https%3A%2F%2Fwww.tiktok.com%2F&screen_height=1117&screen_width=1728&tz_name=Asia%2FSaigon&user_is_login=true&verifyFp=${verifyFp}&webcast_language=en`,
        // "url": `https://web-sg.tiktok.com/passport/web/account/set/?multi_login=1&did=${device_id}&locale=vi-VN&app_language=vi&aid=1459&account_sdk_source=web&sdk_version=2.1.11-tiktokbeta.3&language=vi&verifyFp=${verifyFp}&target_aid=&standalone_aid=&shark_extra=${shark_extra_encoded}`,
        "url": `https://web-sg.tiktok.com/passport/web/account/set/?multi_login=1&did=${device_id}&locale=vi-VN&app_language=vi&aid=1459&account_sdk_source=web&sdk_version=2.1.11-tiktokbeta.3&language=vi&verifyFp=${verifyFp}&target_aid=&standalone_aid=&shark_extra=%7B%22aid%22:1459,%22app_name%22:%22Tik_Tok_Login%22,%22channel%22:%22tiktok_web%22,%22device_platform%22:%22web_pc%22,%22device_id%22:%22${device_id}%22,%22region%22:%22VN%22,%22priority_region%22:%22%22,%22os%22:%22mac%22,%22referer%22:%22%22,%22cookie_enabled%22:true,%22screen_width%22:3440,%22screen_height%22:1440,%22browser_language%22:%22vi%22,%22browser_platform%22:%22MacIntel%22,%22browser_name%22:%22Mozilla%22,%22browser_version%22:%225.0+(Macintosh%3B+Intel+Mac+OS+X+10_15_7)+AppleWebKit%2F537.36+(KHTML,+like+Gecko)+Chrome%2F${version_browser}+Safari%2F537.36%22,%22browser_online%22:true,%22verifyFp%22:%22${verifyFp}%22,%22app_language%22:%22vi-VN%22,%22webcast_language%22:%22vi-VN%22,%22tz_name%22:%22Asia%2FBangkok%22,%22is_page_visible%22:true,%22focus_state%22:true,%22is_fullscreen%22:false,%22history_len%22:6,%22user_is_login%22:false,%22data_collection_enabled%22:false%7D`,
        "headers": {
            "accept": "application/json, text/javascript",
            "accept-language": "vi,vi-VN;q=0.9,en-US;q=0.8,en;q=0.7",
            "content-type": "application/x-www-form-urlencoded",
            "priority": "u=1, i",
            "save-data": "on",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"macOS\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
        },
        "referrer": "https://www.tiktok.com/",
        "body": `mix_mode=1&username=${xorHexEncode(username)}&aid=1459&is_sso=false&account_sdk_source=web&region=VN&language=vi&locale=vi-VN&did=${device_id}&fixed_mix_mode=1`,
        "method": "POST",
        "mode": "cors"
    }
    return data_json
}
function encodeRFC3986URIComponent(str) {
    return encodeURIComponent(str).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    );
}
async function updateProfile({ avatar_uri, proxy, cookie_string, retryCount, proxy_list = [], nickname }) {
    try {
        let retry = retryCount || 0;
        let random_de = getRandomInt(187248723442, 934782374123);
        let wid = getString(cookie_string.replace(/ /g, '') + ';', ';wid=', ';')
        let multi_sids = getString(cookie_string.replace(/ /g, '') + ';', ';multi_sids=', '%')
        let device_id = wid || ("7584943" + random_de);
        let odinId = multi_sids || "7544943" + getRandomInt(187248723442, 934782374123);

        let verifyFp = getString(cookie_string.replace(/ /g, '') + ';', 'verifyFp=', ';')
            || getString(cookie_string.replace(/ /g, '') + ';', 's_v_web_id=', ';');
        let tt_csrf_token = getString(cookie_string.replace(/ /g, '') + ';', 'tt_csrf_token=', ';')
        let msToken = getString(cookie_string.replace(/ /g, '') + ';', 'msToken=', ';')
        let webIdCreatedTime = getString(cookie_string.replace(/ /g, '') + ';', 'webIdCreatedTime=', ';')
        let body = {
            avatar_uri: avatar_uri,
            nickname: nickname,
            tt_csrf_token: tt_csrf_token
        }
        const headers = {
            "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
            cookie: cookie_string,
            "accept": "*/*",
            "accept-language": "en-US,en;q=0.9",
            "content-type": "application/x-www-form-urlencoded",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "tt-csrf-token": tt_csrf_token,
            "x-cthulhu-csrf": "1",
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'x-secsdk-csrf-token': 'DOWNGRADE',
        };
        const appVersionDefault = headers["User-Agent"].replace("Mozilla/", "")
        let url = `https://www.tiktok.com/api/update/profile/?WebIdLastTime=${webIdCreatedTime}&aid=1988&app_language=en&app_name=tiktok_web&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=${encodeURIComponent("Linux x86_64")}&browser_version=${encodeRFC3986URIComponent(appVersionDefault)}&channel=tiktok_web&cookie_enabled=true&data_collection_enabled=true&device_id=${device_id}&device_platform=web_pc&focus_state=true&from_page=user&history_len=11&is_fullscreen=false&is_page_visible=true&odinId=${odinId}&os=mac&priority_region=VN&referer=https%3A%2F%2Fwww.tiktok.com%2F&region=VN&root_referer=https%3A%2F%2Fwww.tiktok.com%2F&screen_height=1117&screen_width=1728&tz_name=Asia%2FSaigon&user_is_login=true&verifyFp=${verifyFp}&webcast_language=en&msToken=${msToken}`
        console.log("formData", body, url)
        let bodyEncoded = querystring.stringify(body);
        // let bodyEncoded = JSON.stringify(body)
        let bodyJson = JSON.stringify(body)
        let res1 = await signreq({ url, bodyEncoded: bodyEncoded, bodyJson: bodyJson, msToken: msToken })
        console.log("res", res1)
        url = res1.targetUrl
        // process.exit(1)
        let res = await makeRequest({ url, headers, method: 'POST', proxy, form: body })
        console.log("res", res)
        return res.bodyJson;
    } catch (e) {
        console.log(e)
    }
}
async function updateProfile1({ avatar_uri, proxy, cookie_string, retryCount, proxy_list = [], nickname }) {
    try {
        let retry = retryCount || 0;
        let random_de = getRandomInt(187248723442, 934782374123);
        let wid = getString(cookie_string.replace(/ /g, '') + ';', ';wid=', ';')
        let multi_sids = getString(cookie_string.replace(/ /g, '') + ';', ';multi_sids=', '%')
        let device_id = wid || ("7584943" + random_de);
        let odinId = multi_sids || "7544943" + getRandomInt(187248723442, 934782374123);

        let verifyFp = getString(cookie_string.replace(/ /g, '') + ';', 'verifyFp=', ';')
            || getString(cookie_string.replace(/ /g, '') + ';', 's_v_web_id=', ';');
        let tt_csrf_token = getString(cookie_string.replace(/ /g, '') + ';', 'tt_csrf_token=', ';')
        let msToken = getString(cookie_string.replace(/ /g, '') + ';', 'msToken=', ';')
        let body = {
            avatar_uri: avatar_uri,
            nickname: nickname,
            tt_csrf_token: tt_csrf_token
        }
        const headers = {
            "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
            cookie: cookie_string,
            'accept': '*/*',
            'accept-language': 'vi,vi-VN;q=0.9,en-US;q=0.8,en;q=0.7',
            'content-type': 'application/x-www-form-urlencoded',
            'origin': 'https://www.tiktok.com',
            'priority': 'u=1, i',
            'referer': 'https://www.tiktok.com/',
            'sec-ch-ua': '"Google Chrome";v="134", "Chromium";v="134", "Not/A)Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'tt-csrf-token': tt_csrf_token,
            'tt-ticket-guard-client-data': '',
            'tt-ticket-guard-iteration-version': '0',
            'tt-ticket-guard-public-key': '',
            'tt-ticket-guard-version': '2',
            'tt-ticket-guard-web-version': '1',
            'x-cthulhu-csrf': '1',
            'x-mssdk-info': '',
            'x-secsdk-csrf-token': '',
        };
        const appVersionDefault = headers["User-Agent"].replace("Mozilla/", "")
        let url = `https://www.tiktok.com/api/update/profile/?WebIdLastTime=1757054541&aid=1988&app_language=vi-VN&app_name=tiktok_web&browser_language=vi&browser_name=Mozilla&browser_online=true&browser_platform=${encodeURIComponent("Linux x86_64")}&browser_version=${encodeURIComponent(appVersionDefault)}&channel=tiktok_web&cookie_enabled=true&data_collection_enabled=true&device_id=${device_id}&device_platform=web_pc&focus_state=true&from_page=user&history_len=4&is_fullscreen=false&is_page_visible=true&odinId=${odinId}&os=linux&priority_region=VN&referer=https%3A%2F%2Fwww.tiktok.com%2Fexplore&region=VN&root_referer=https%3A%2F%2Fwww.tiktok.com%2Fexplore&screen_height=1107&screen_width=1710&tz_name=Asia%2FBangkok&user_is_login=true&verifyFp=${verifyFp}&webcast_language=vi-VN&msToken=${msToken}`
        console.log("formData", body, url)
        let bodyEncoded = querystring.stringify(body);
        // let bodyEncoded = JSON.stringify(body)
        let bodyJson = JSON.stringify(body)
        let res1 = await signreq({ url, bodyEncoded: bodyEncoded, bodyJson: bodyJson, msToken: msToken })
        console.log("res", res1)
        url = res1.targetUrl
        // process.exit(1)
        let res = await makeRequest({ url, headers, method: 'POST', proxy, form: body })
        console.log("res", res)
        return res.bodyJson;
    } catch (e) {
        console.log(e)
    }
}
async function checkUserExist({ username, proxy, proxy_list = [], cookie_string, retryCount = 0 }) {
    const data_return = {
        status: true,
        is_exist: true
    }
    if (proxy_list && proxy_list.length) {
        proxy = proxy_list[Math.floor(Math.random() * proxy_list.length)]
    }
    let url = `https://www.tiktok.com/@${username}?lang=vi-vn`
    let headers = {
        "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
        cookie: cookie_string
    }
    let res = await makeRequest({ url, headers, method: 'GET', proxy, proxy_list })
    // console.log("res",res)
    // return res.bodyJson;
    if (res.body && res.body.includes('"uniqueId":"')) {
        data_return.is_exist = true
        let data_user = getString(res.body, 'id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">', '</script>');
        try {
            data_user = JSON.parse(data_user)
            data_return.nickname = data_user.__DEFAULT_SCOPE__['webapp.user-detail'].userInfo.user.nickname;
            data_return.avatar = data_user.__DEFAULT_SCOPE__['webapp.user-detail'].userInfo.user?.avatarLarger || '';
            // data_return.odinId = data_user.__DEFAULT_SCOPE__['webapp.user-detail'].userInfo.user.nickname;
            // console.log(data_user)
        } catch (e) {
            // console.log('e',e)
        }
    } else if (res.body && res.body.includes('"err_user"')) {
        data_return.is_exist = false
    } else {
        data_return.status = false
        if (retryCount < 3) {
            retryCount++
            return await checkUserExist({ username, proxy, proxy_list, cookie_string, retryCount })
        }
    }
    return data_return
}
async function getInfo({ folder_avatar, alias_name = "VN" }) {
    let info_name = nameinfo;
    var alias_names = ["VN", "US", "HINDI", "CN"];
    // var alias_name = alias_names[Math.floor((Math.random() * alias_names.length))]
    // alias_name = "VN"
    let name_key = alias_name === "JP" ? "US" : alias_name;
    var list_first_name = info_name.first_name[name_key] || info_name.first_name["US"];
    var list_last_name = info_name.last_name[name_key] || info_name.last_name["US"];
    var last_name = list_last_name[Math.floor((Math.random() * list_last_name.length))].trim()
    var first_name = list_first_name[Math.floor((Math.random() * list_first_name.length))].trim()
    // if(first_name.includes(" ")){
    //     var first_name_array = first_name.split(" ");
    //     first_name = first_name_array[Math.floor((Math.random() * first_name_array.length))].trim();
    // } 
    //"VN" "US" or "JP" or "BD" or "ID"
    let nickname = alias_name == "VN" ? getNameViet() : alias_name == "JP" ? getNameJP() : alias_name == "BD" ? getNameBD() : alias_name == "ID" ? getNameID() : getNameUS();
    let info = {
        newUsername: function newUsername(_info) {
            let _username = ((_info.last_name + _info.first_name + getRandomInt(10, 31) + "" + getRandomInt(1, 12) + "" + getRandomInt(1970, 2007)).trim())
                // info.username = ((info.last_name+generateRandomName(12)+'amac'+generateRandomName(8)+getRandomInt(111111, 888888)+generateRandomName(1)).trim())
                .replace(/đ/g, 'd')
                .replace(/ð/g, 'd')
                .replace(/Đ/g, 'D')
                .replace(/ê/g, 'e')
                .replace(/Ê/g, 'E')
                .replace(/ô/g, 'o')
                .replace(/Ô/g, 'O')
                .replace(/ơ/g, 'o')
                .replace(/Ơ/g, 'O')
                .replace(/ă/g, 'a')
                .replace(/Ă/g, 'A')
                .replace(/â/g, 'a')
                .replace(/Â/g, 'A')
                .toLowerCase()
                .replace(/ð/g, 'd')
                .replace(/ /g, '')
            _username = trimStringToMaxLength(_username, 23)
            return _username
        },
        last_name: last_name,
        first_name: first_name,
        password: '@' + generateRandomPassword(8) + getRandomInt(1111, 9999).toString(),
        birthday_year: getRandomInt(1991, 2002),
        birthday_month: getRandomInt(1, 12),
        // birthday_day: getRandomInt(1, 28),
        // birthday_year: 1996,//getRandomInt(1991, 2006),
        // birthday_month: 3,
        birthday_day: 1,
        email: generateRandomName(12) + getRandomInt(111111, 888888).toString() + "@gmail.com",
        // email: '+84973'+getRandomInt(111111, 888888).toString(),
        sex: getRandomInt(1, 2),
        nickname: nickname,
    }
    info.username = ((info.last_name + info.first_name + getRandomInt(10, 31) + "" + getRandomInt(1, 12) + "" + getRandomInt(1970, 2007)).trim())
        // info.username = ((info.last_name+generateRandomName(12)+'amac'+generateRandomName(8)+getRandomInt(111111, 888888)+generateRandomName(1)).trim())
        .replace(/đ/g, 'd')
        .replace(/ð/g, 'd')
        .replace(/Đ/g, 'D')
        .replace(/ê/g, 'e')
        .replace(/Ê/g, 'E')
        .replace(/ô/g, 'o')
        .replace(/Ô/g, 'O')
        .replace(/ơ/g, 'o')
        .replace(/Ơ/g, 'O')
        .replace(/ă/g, 'a')
        .replace(/Ă/g, 'A')
        .replace(/â/g, 'a')
        .replace(/Â/g, 'A')
        .toLowerCase()
        .replace(/ð/g, 'd')
        .replace(/ /g, '')
    info.username = trimStringToMaxLength(info.username, 23)

    let images = await getFile(path.join(folder_avatar, "*.*"))
    images = images.filter(img => {
        try {
            return fs.statSync(img).size >= 50 * 1024;
        } catch (e) {
            return false;
        }
    })
    info.avatar = images[getRandomInt(0, images.length)]
    console.log(info)
    return info
}
async function strData(path) {
    return new Promise((r) => {
        try {
            fs.exists(path, (ex) => {
                if (!ex) return r("")
                let stream = fs.createReadStream(path)
                let str = ''
                stream.on('data', (chunk) => {
                    str += chunk
                })
                stream.on('end', (chunk) => {
                    r(str.trim())
                })
            })


        } catch (error) {
            console.log("error")
            r("")
        }

    })
}
async function closeAllOrbita(max_time = 10 * 60 * 1000) {
    try {
        let cmdCheck = "";
        const platform = process.platform;

        if (platform === "darwin") {
            // macOS
            cmdCheck = `ps aux | grep "Orbita-Browser.app/Contents/MacOS/Orbita"`;
        } else if (platform === "linux") {
            // Ubuntu/Linux
            cmdCheck = `ps aux | grep "orbita"`;
        } else {
            console.log("Hệ điều hành không hỗ trợ:", platform);
            return;
        }

        const { stdout } = await execAsync(cmdCheck);
        const lines = stdout
            .split("\n")
            .filter((line) => line && !line.includes("grep"));

        if (!lines.length) {
            console.log("Không tìm thấy Orbita, chờ 60s rồi thử lại...");
            await helper.delay(60000);
            return await closeAllOrbita(max_time);
        }

        for (const line of lines) {
            await closeProcessOrbita(line, max_time);
        }

        console.log("Đã xử lý Orbita, chờ 30s rồi thử lại...");
        await helper.delay(30000);
        return await closeAllOrbita(max_time);
    } catch (e) {
        console.error("Lỗi trong closeAllOrbita:", e);
        await helper.delay(30000);
        return await closeAllOrbita(max_time);
    }
}
async function closeAllOrbita1(max_time = 10 * 60 * 1000) {
    exec(`ps aux | grep "Orbita-Browser.app/Contents/MacOS/Orbita"`, async (err, sto, ste) => {
        try {
            let strs = []
            sto.split('\n').map(i => {
                if (!i.includes("grep") && i.includes("Orbita-Browser.app/Contents/MacOS/Orbita")) {
                    strs.push(i)
                }
            })
            if (!strs.length) {
                await helper.delay(60000)
                return await closeAllOrbita(max_time)
            }

            strs.map(i => {
                closeProcessOrbita(i, max_time)
            })
            await helper.delay(30000)
            return await closeAllOrbita(max_time)

        } catch (e) {
            console.log("error", e)
            await helper.delay(30000)
            return await closeAllOrbita(max_time)
        }

    })
}
async function ensureGoLoginRunning() {
    const port = 36912;
    const isPortReachable = (port) => {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            const onError = () => {
                socket.destroy();
                resolve(false);
            };
            socket.setTimeout(1000);
            socket.once('error', onError);
            socket.once('timeout', onError);
            socket.connect(port, '127.0.0.1', () => {
                socket.end();
                resolve(true);
            });
        });
    };

    const reachable = await isPortReachable(port);
    if (reachable) {
        return true;
    }

    console.log(`[DAEMON] Local daemon on port ${port} is not running. Starting gologin_daemon.js...`);
    const daemonScript = path.resolve("./gologin_daemon.js");

    try {
        const out = fs.openSync(path.resolve("./daemon.log"), "a");
        const err = fs.openSync(path.resolve("./daemon.log"), "a");

        const child = spawn("node", [daemonScript], {
            detached: true,
            stdio: ["ignore", out, err]
        });
        child.unref();

        // Wait a bit for the daemon to start listening
        for (let i = 0; i < 15; i++) {
            await new Promise(r => setTimeout(r, 400));
            if (await isPortReachable(port)) {
                console.log(`[DAEMON] Daemon started successfully.`);
                return true;
            }
        }
        console.warn(`[DAEMON] Started daemon process, but port ${port} did not become active in time.`);
    } catch (e) {
        console.error(`[DAEMON] Failed to start daemon:`, e);
    }
    return false;
}
async function stopGoLogin() {
    try {
        const { stdout } = await execAsync(`pgrep -a -f gologin || true`);
        if (stdout.trim()) {
            console.log("Đang chạy GoLogin trước khi kill:", stdout);
            await execAsync(`pkill -9 -f gologin || true`);
            console.log("stopGoLogin success");
        } else {
            console.log("Không tìm thấy process GoLogin để kill.");
        }
        return true;
    } catch (err) {
        console.error("stopGoLogin error:", err.message);
        return false;
    }
}
async function startGoLogin() {
    const candidates = [
        "~/Documents/gologin/GoLogin-3.4.4",
        "/home/sammy/gologin/GoLogin-3.4.5",
        "/home/sammy/Downloads/GoLogin-3.4.5",
        "/home/sammy/GoLogin-3.4.5",
        "~/Documents/gologin/GoLogin-3.4.6",
        "/home/sammy/gologin/GoLogin-3.4.6",
        "/home/sammy/Downloads/GoLogin-3.4.6",
        "/home/sammy/GoLogin-3.4.6",
        "~/Documents/gologin/GoLogin-3.4.7",
        "/home/sammy/gologin/GoLogin-3.4.7",
        "/home/sammy/Downloads/GoLogin-3.4.7",
        "/home/sammy/GoLogin-3.4.7",
        "~/Documents/gologin/GoLogin-3.4.8",
        "/home/sammy/gologin/GoLogin-3.4.8",
        "/home/sammy/Downloads/GoLogin-3.4.8",
        "/home/sammy/GoLogin-3.5.0",
        "/home/sammy/GoLogin-3.5.1",
        "/home/sammy/GoLogin-3.4.8",
        "/home/sammy/GoLogin-3.4.9",
        "/home/sammy/GoLogin-3.4.13",
        "~/Documents/gologin/update.AppImage",
        "/home/sammy/gologin/update.AppImage",
        "/home/sammy/Downloads/update.AppImage",
        "/home/sammy/update.AppImage",
        "/home/hi/GoLogin-3.4.7",
        "/home/hi/GoLogin-3.4.8",
        "/home/hi/update.AppImage",
    ];
    let status_run = await startGoLogin1();
    if (!status_run) {
        return;
    }
    await delay(20000)
    const tokens = `
        eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RpZCI6IjY5NDQwZjViMTRhY2IxMTA0NzJhYjY1MSIsInR5cGUiOiJ1c2VyIiwic3ViIjoiNjg4ZGM5YTBlZDdjNjBjMzRkMmNjMDBmIn0.nraG8lSf9o_akvuPSpDwTf7hu69c-FGVWhAzS0TrE-g
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RpZCI6IjY5NDQwZmE0ZDJlODk1OTZkNTJlN2VjMiIsInR5cGUiOiJ1c2VyIiwic3ViIjoiNjg4ZGM5YTBlZDdjNjBjMzRkMmNjMDBmIn0.-5abGvECs_e_IlE4K4B0IRiUQ1rlhHK5Ey9tYHfBmas
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RpZCI6IjY5NDQwZmJlMzc0ZmIyODk4NzVlMjEzOCIsInR5cGUiOiJ1c2VyIiwic3ViIjoiNjg4ZGM5YTBlZDdjNjBjMzRkMmNjMDBmIn0.SYKxdUoli8q3aYU1JgTM-l23wjeYLAEFjpb9MloXQ9E
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RpZCI6IjY5NDQwZmQ2ZjQ5OTRiMTUwZDFhYjc4OCIsInR5cGUiOiJ1c2VyIiwic3ViIjoiNjg4ZGM5YTBlZDdjNjBjMzRkMmNjMDBmIn0.-n77Wgf0h4fJpIbWdlcY__qdN6k2pK3b1c-D7x4JJXc
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RpZCI6IjY5NDQwZmVmNDc2NGU3YzQ3ZDFjYzg4MSIsInR5cGUiOiJ1c2VyIiwic3ViIjoiNjg4ZGM5YTBlZDdjNjBjMzRkMmNjMDBmIn0.UhL4-GqPdVHQqqKB-u4yJdodZWaxd7MKSNREUyXjnJs
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RpZCI6IjY5NDQxMDAxNjE2NzRlY2VhY2E5ODE4YiIsInR5cGUiOiJ1c2VyIiwic3ViIjoiNjg4ZGM5YTBlZDdjNjBjMzRkMmNjMDBmIn0.8Xe-a3-wwDSni9OpblrintbLFK0UWWKVo0QrkHx6lqo
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RpZCI6IjY5NDQxMDIyYTdlZDNlYmY0M2M0NTEzYyIsInR5cGUiOiJ1c2VyIiwic3ViIjoiNjg4ZGM5YTBlZDdjNjBjMzRkMmNjMDBmIn0.sQdzAj4Ibcp3jtJ1eb-FMVvNVZOWzGRQ6uKqsujE1ww
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RpZCI6IjY5NDQxMDMzYTdlZDNlYmY0M2M0N2MwMSIsInR5cGUiOiJ1c2VyIiwic3ViIjoiNjg4ZGM5YTBlZDdjNjBjMzRkMmNjMDBmIn0.1Es-iAo-XB0V7DrpdlPmRyruLrdKTshJ3y_g5rZzcuA
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RpZCI6IjY5NDQxMDRhYTdlZDNlYmY0M2M0YWY4NiIsInR5cGUiOiJ1c2VyIiwic3ViIjoiNjg4ZGM5YTBlZDdjNjBjMzRkMmNjMDBmIn0.zO-3pT5nNezthPZBGt1MpHFUE015lJaDmAxADHVk7p8
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RpZCI6IjY5NDQxMDVmOWIwZjRlYjQyMThlY2RlNyIsInR5cGUiOiJ1c2VyIiwic3ViIjoiNjg4ZGM5YTBlZDdjNjBjMzRkMmNjMDBmIn0.cderKPAuf9ykj34sALS16rT7jc47P1v2hAnCCSLSdwA
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RpZCI6IjY5NDQxMDc5OWIwZjRlYjQyMThmMDA3NiIsInR5cGUiOiJ1c2VyIiwic3ViIjoiNjg4ZGM5YTBlZDdjNjBjMzRkMmNjMDBmIn0.KZIBq8ASc4lLhDR5tzaacY_H4scb1-bLJUG4Cmo7PV4
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RpZCI6IjY5NDQxMDkxYTgzNGM3MWQ2MDQxM2NjMCIsInR5cGUiOiJ1c2VyIiwic3ViIjoiNjg4ZGM5YTBlZDdjNjBjMzRkMmNjMDBmIn0.SatKeS7MN0GCIbga9wxsXIAAm7MmqSLN15e4f4oRjq0
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RpZCI6IjY5NDQxMGFiOWIwZjRlYjQyMThmM2VmNCIsInR5cGUiOiJ1c2VyIiwic3ViIjoiNjg4ZGM5YTBlZDdjNjBjMzRkMmNjMDBmIn0.QRdkiaDQ8RoglBz2QhhtTVVTBi94xlJRixCdTtl9ajI
`.trim().split('\n')
    // https://accounts.google.com/o/oauth2/v2/auth/oauthchooseaccount?client_id=713507725115-sfv5mksf4jjsrccnmaut7rhdmtavk2d5.apps.googleusercontent.com&redirect_uri=https%3A%2F%2Fapp.gologin.com%2Fredirect-to-desktop%3Fprovider%3Dgoogle&scope=profile%20email&response_type=code&access_type=offline&prompt=select_account&state=%257B%2522gologinMetaHeader%2522%253A%25223.4.12%2520Jupiter-mac-25.0.0%2522%252C%2522appId%2522%253A%2522962287317353923975%2522%257D&service=lso&o2v=2&flowName=GeneralOAuthFlow
    const token = tokens[Math.floor(Math.random() * tokens.length)].trim()
    const deeplink =
        "gologin://o-auth?accessToken=" + token;

    for (let rawPath of candidates) {
        let path = rawPath.replace("~", process.env.HOME);

        if (fs.existsSync(path)) {
            console.log("Thử chạy:", path);

            // chạy lần 1 (mồi AppImage unpack)
            const child1 = execFile(path, [], {
                detached: true,
                stdio: "ignore",
            });
            child1.unref();

            // chạy lần 2 sau 2 giây với deep link
            setTimeout(() => {
                const child2 = execFile(path, [deeplink], {
                    detached: true,
                    stdio: "ignore",
                });
                child2.unref();
                console.log("Đã gửi deeplink vào GoLogin.");
            }, 2000);

            return true;
        }
    }

    console.error("Không tìm thấy GoLogin AppImage.");
    return false;
}

async function startGoLogin1() {
    // Các đường dẫn có thể
    //./update.AppImage "gologin://o-auth?accessToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RpZCI6IjY4YjdmZTE0ZTQxN2Q2OWZkMzkwMzdmNiIsInR5cGUiOiJ1c2VyIiwic3ViIjoiNjg4ZGM5YTBlZDdjNjBjMzRkMmNjMDBmIn0.rQNhWQKODuzTr8Vyx-DNcrRcoxkElKv_r2n2VEXWDPY"
    const candidates = [
        "~/Documents/gologin/GoLogin-3.4.4",
        "/home/sammy/gologin/GoLogin-3.4.5",
        "/home/sammy/Downloads/GoLogin-3.4.5",
        "/home/sammy/GoLogin-3.4.5",
        "~/Documents/gologin/GoLogin-3.4.6",
        "/home/sammy/gologin/GoLogin-3.4.6",
        "/home/sammy/Downloads/GoLogin-3.4.6",
        "/home/sammy/GoLogin-3.4.6",
        "~/Documents/gologin/GoLogin-3.4.7",
        "/home/sammy/gologin/GoLogin-3.4.7",
        "/home/sammy/Downloads/GoLogin-3.4.7",
        "/home/sammy/GoLogin-3.4.7",
        "~/Documents/gologin/GoLogin-3.4.8",
        "/home/sammy/gologin/GoLogin-3.4.8",
        "/home/sammy/Downloads/GoLogin-3.4.8",
        "/home/sammy/GoLogin-3.5.0",
        "/home/sammy/GoLogin-3.5.1",
        "/home/sammy/GoLogin-3.4.8",
        "/home/sammy/GoLogin-3.4.9",
        "/home/sammy/GoLogin-3.4.13",
        "~/Documents/gologin/update.AppImage",
        "/home/sammy/gologin/update.AppImage",
        "/home/sammy/Downloads/update.AppImage",
        "/home/sammy/update.AppImage",
        "/home/hi/GoLogin-3.4.7",
        "/home/hi/GoLogin-3.4.8",
        "/home/hi/update.AppImage",
    ];

    for (let path of candidates) {
        // Mở rộng dấu ~ thành home
        if (path.startsWith("~")) {
            path = path.replace("~", process.env.HOME);
        }

        // Kiểm tra file có tồn tại không
        if (fs.existsSync(path)) {
            try {
                await execAsync(`DISPLAY=:1 setsid ${path} >/dev/null 2>&1 &`);
                console.log(`Đã chạy GoLogin: ${path}`);
                return true; // chạy thành công thì thoát
            } catch (err) {
                console.error(`Lỗi khi chạy ${path}:`, err.message);
            }
        }
    }

    console.error("Không tìm thấy GoLogin ở các đường dẫn đã thử.");
    return false;
}
async function startDeeplink() {
    const candidates = [
        "/home/sammy/GoLogin-3.5.1",
        "/home/sammy/update.AppImage",
    ];
    const tokens = `
        eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RpZCI6IjY5NDQwZjViMTRhY2IxMTA0NzJhYjY1MSIsInR5cGUiOiJ1c2VyIiwic3ViIjoiNjg4ZGM5YTBlZDdjNjBjMzRkMmNjMDBmIn0.nraG8lSf9o_akvuPSpDwTf7hu69c-FGVWhAzS0TrE-g
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RpZCI6IjY5NDQwZmE0ZDJlODk1OTZkNTJlN2VjMiIsInR5cGUiOiJ1c2VyIiwic3ViIjoiNjg4ZGM5YTBlZDdjNjBjMzRkMmNjMDBmIn0.-5abGvECs_e_IlE4K4B0IRiUQ1rlhHK5Ey9tYHfBmas
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RpZCI6IjY5NDQwZmJlMzc0ZmIyODk4NzVlMjEzOCIsInR5cGUiOiJ1c2VyIiwic3ViIjoiNjg4ZGM5YTBlZDdjNjBjMzRkMmNjMDBmIn0.SYKxdUoli8q3aYU1JgTM-l23wjeYLAEFjpb9MloXQ9E
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RpZCI6IjY5NDQwZmQ2ZjQ5OTRiMTUwZDFhYjc4OCIsInR5cGUiOiJ1c2VyIiwic3ViIjoiNjg4ZGM5YTBlZDdjNjBjMzRkMmNjMDBmIn0.-n77Wgf0h4fJpIbWdlcY__qdN6k2pK3b1c-D7x4JJXc
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RpZCI6IjY5NDQwZmVmNDc2NGU3YzQ3ZDFjYzg4MSIsInR5cGUiOiJ1c2VyIiwic3ViIjoiNjg4ZGM5YTBlZDdjNjBjMzRkMmNjMDBmIn0.UhL4-GqPdVHQqqKB-u4yJdodZWaxd7MKSNREUyXjnJs
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RpZCI6IjY5NDQxMDAxNjE2NzRlY2VhY2E5ODE4YiIsInR5cGUiOiJ1c2VyIiwic3ViIjoiNjg4ZGM5YTBlZDdjNjBjMzRkMmNjMDBmIn0.8Xe-a3-wwDSni9OpblrintbLFK0UWWKVo0QrkHx6lqo
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RpZCI6IjY5NDQxMDIyYTdlZDNlYmY0M2M0NTEzYyIsInR5cGUiOiJ1c2VyIiwic3ViIjoiNjg4ZGM5YTBlZDdjNjBjMzRkMmNjMDBmIn0.sQdzAj4Ibcp3jtJ1eb-FMVvNVZOWzGRQ6uKqsujE1ww
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RpZCI6IjY5NDQxMDMzYTdlZDNlYmY0M2M0N2MwMSIsInR5cGUiOiJ1c2VyIiwic3ViIjoiNjg4ZGM5YTBlZDdjNjBjMzRkMmNjMDBmIn0.1Es-iAo-XB0V7DrpdlPmRyruLrdKTshJ3y_g5rZzcuA
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RpZCI6IjY5NDQxMDRhYTdlZDNlYmY0M2M0YWY4NiIsInR5cGUiOiJ1c2VyIiwic3ViIjoiNjg4ZGM5YTBlZDdjNjBjMzRkMmNjMDBmIn0.zO-3pT5nNezthPZBGt1MpHFUE015lJaDmAxADHVk7p8
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RpZCI6IjY5NDQxMDVmOWIwZjRlYjQyMThlY2RlNyIsInR5cGUiOiJ1c2VyIiwic3ViIjoiNjg4ZGM5YTBlZDdjNjBjMzRkMmNjMDBmIn0.cderKPAuf9ykj34sALS16rT7jc47P1v2hAnCCSLSdwA
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RpZCI6IjY5NDQxMDc5OWIwZjRlYjQyMThmMDA3NiIsInR5cGUiOiJ1c2VyIiwic3ViIjoiNjg4ZGM5YTBlZDdjNjBjMzRkMmNjMDBmIn0.KZIBq8ASc4lLhDR5tzaacY_H4scb1-bLJUG4Cmo7PV4
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RpZCI6IjY5NDQxMDkxYTgzNGM3MWQ2MDQxM2NjMCIsInR5cGUiOiJ1c2VyIiwic3ViIjoiNjg4ZGM5YTBlZDdjNjBjMzRkMmNjMDBmIn0.SatKeS7MN0GCIbga9wxsXIAAm7MmqSLN15e4f4oRjq0
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RpZCI6IjY5NDQxMGFiOWIwZjRlYjQyMThmM2VmNCIsInR5cGUiOiJ1c2VyIiwic3ViIjoiNjg4ZGM5YTBlZDdjNjBjMzRkMmNjMDBmIn0.QRdkiaDQ8RoglBz2QhhtTVVTBi94xlJRixCdTtl9ajI
`.trim().split('\n')
    // https://accounts.google.com/o/oauth2/v2/auth/oauthchooseaccount?client_id=713507725115-sfv5mksf4jjsrccnmaut7rhdmtavk2d5.apps.googleusercontent.com&redirect_uri=https%3A%2F%2Fapp.gologin.com%2Fredirect-to-desktop%3Fprovider%3Dgoogle&scope=profile%20email&response_type=code&access_type=offline&prompt=select_account&state=%257B%2522gologinMetaHeader%2522%253A%25223.4.12%2520Jupiter-mac-25.0.0%2522%252C%2522appId%2522%253A%2522962287317353923975%2522%257D&service=lso&o2v=2&flowName=GeneralOAuthFlow
    const token = tokens[Math.floor(Math.random() * tokens.length)].trim()
    const deeplink =
        "gologin://o-auth?accessToken=" + token;

    for (let rawPath of candidates) {
        let path = rawPath.replace("~", process.env.HOME);

        if (fs.existsSync(path)) {
            console.log("Thử chạy:", path);

            // chạy lần 1 (mồi AppImage unpack)
            const child1 = execFile(path, [], {
                detached: true,
                stdio: "ignore",
            });
            child1.unref();

            // chạy lần 2 sau 2 giây với deep link
            setTimeout(() => {
                const child2 = execFile(path, [deeplink], {
                    detached: true,
                    stdio: "ignore",
                });
                child2.unref();
                console.log("Đã gửi deeplink vào GoLogin.");
            }, 2000);

            return true;
        }
    }

    console.error("Không tìm thấy GoLogin AppImage.");
    return false;
}
async function checkandopenGologin(timeout = 60000) {
    await ensureGoLoginRunning();
    await delay(timeout);
    return await checkandopenGologin(timeout);
}
function closeProcessOrbita(str, max_time = 10 * 60 * 1000) {
    let arr = str.split(" ").filter(i => i && i.trim())
    let startTime = arr[8]
    const currentDate = new Date();
    const formattedTime = startTime.replace(/([APM]{2})$/, ' $1');
    // Tạo chuỗi thời gian đầy đủ với ngày hiện tại
    const fullDateString = `${currentDate.toDateString()} ${formattedTime}`;

    // Chuyển đổi thành đối tượng Date
    const startDate = new Date(fullDateString);
    let process_time = Date.now() - startDate
    if (process_time > max_time) {
        console.log("process id", arr[1], "time:", process_time)
        console.log("process ", str)
        exec(`kill -9 ${arr[1]}`, (err, sto, ste) => {
            console.log(sto)

        })
    }
}
async function getConfigSite(minutes = 2) {
    // get request to url and save file with time, if time less than 1 hour, return data
    const data_default = { "user_agent": "137", "active": true, "OS_TYPE": "mac", "autoconfig": false, "command": "" }
    const path_file = path.resolve("./info_tiktok_data_all.txt");
    if (fs.existsSync(path_file)) {
        const data = await strData(path_file);
        if (data) {
            const data_json = JSON.parse(data);
            if (data_json.time && data_json.time && Date.now() - data_json.time < minutes * 60 * 1000) {
                return data_json;
            }
        }
    }
    const url = 'http://217.15.163.20:8549/api/cron/getconfig?authensone=mysonetrend&config=info_tiktok_data_all';
    //{"data":"{\"user_agent\":\"139\",\"active\":true,\"OS_TYPE\":\"mac\",\"autoconfig\":false,\"command\":\"\"}"}
    const response = await makeRequest({ url, timeout: 20000 });
    let data = response.bodyJson;
    data = JSON.parse(data.data);
    data.time = Date.now();
    await writeFile({ data: JSON.stringify(data), path: path_file });
    return data;
}
async function runCmd(cmd, callback, callbackResult) {
    return new Promise((r) => {
        const child = exec(cmd, (error, stdout, stderr) => {
            if (typeof callbackResult == "function") callbackResult({ error, stdout, stderr })
            // error ? console.log("error childprocess", error): null;
            // stdout ?  console.log(" stdout", stdout): null;
            // stderr ?  console.log(" stderr", stderr): null;

            return r({ error, success: error ? false : true, stdout, stderr });
        });

        const cleanup = () => {
            if (child) {
                // console.log('Killing child process...');
                child.kill("SIGINT");
                try {
                    // console.log("kill process", child.pid)
                    if (os_type !== "Darwin") {
                        exec('taskkill -F -T -PID ' + child.pid, () => { });

                    } else {
                        exec("kill -9 " + child.pid, () => { })

                    }
                } catch (e) {

                }
            }
        };
        if (typeof callback == "function")
            callback(child, cleanup)
        // Handle parent process exit
        process.on('exit', cleanup);

        // Handle SIGINT (Ctrl+C)
        process.on('SIGINT', () => {
            cleanup();
            process.exit();
        });

        // Handle SIGTERM
        process.on('SIGTERM', () => {
            cleanup();
            process.exit();
        });

        // Optionally handle other termination signals if needed
        process.on('SIGUSR1', () => {
            cleanup();
            process.exit();
        });

        process.on('SIGUSR2', () => {
            cleanup();
            process.exit();
        });

        // Handle uncaught exceptions to ensure cleanup
        process.on('uncaughtException', (err) => {
            console.error('Uncaught exception:', err);
            cleanup();
            process.exit(1);
        });
    });
}
async function getEmail({ length, pathFile, process_running, child_process, clean_process, type, cron_name, id_service, cate_name }) {
    let id_s = id_service || "48"
    child_process = child_process || null;
    clean_process = clean_process || null;
    // type [ "DONGVAN","UNLIMIT", "REG_NO_CAPTCHA","REG_CAPTCHA"]
    if (pathFile && !["DONGVAN", "UNLIMIT", "LOCAL", "LOCAL2", "UNLIMIT_GMAIL_EDU", "UNLIMIT_GMAIL_EDU_MAIL3979"].includes(type)) {
        let acc_string = await strData(pathFile);
        let data_write = ""
        let accounts = helper.parserAccounts({
            acc_string, getIndex: 0, number_slice: length, key: "\n", number_ignore: 0, format: "email|password|status", key_format: "|", item_return_type: "object", preReturn: (object, cookie_string, item) => {
                return object.email && object.password && !object.status
            }
        })
        if (accounts.length >= length) {
            accounts.forEach((item, index) => {
                // acc_string = acc_string.replace(`${item.email}|${item.password}`,`${item.email}|${item.password}|running${(index == (accounts.length-1)) ? "\n": ""}`)
                data_write += `${item.email}|${item.password}\n`
            })
            await writeFile({ data: "", path: pathFile })
            await writeFile({ data: data_write, path: path.resolve("./ran_hotmail.txt") })

            if (clean_process) {
                clean_process()
            }
            return accounts
        } else {
            if (!process_running) {
                process_running = true
                //pip3 install -r requirements.txt --break-system-packages
                let cmd = (process.env.CMD_PY || "python3") + " multi.py"
                if (type == "REG_NO_CAPTCHA") {
                    cmd = (process.env.CMD_PY || "python3") + " hotmail_source/main_hotmail.py"
                }
                runCmd(cmd, (child, clean) => {
                    clean_process = clean;
                    child_process = child
                    console.log("start process py", child.pid, cmd)
                })
            }
            console.log("Waiting reg hot mail")
            await helper.delay(5000)
            return await getEmail({ length, pathFile, process_running, child_process, clean_process })
        }

    }
    if (type == "LOCAL") {
        return await getEmailFileLOCAL({ length, pathFile, process_running, child_process, clean_process, type, cron_name })
    }
    if (type == "LOCAL2") {
        return await getEmailFileLOCAL2({ length, pathFile, process_running, child_process, clean_process, type, cron_name })
    }
    if (type == "UNLIMIT") {
        return await getEmailFileUnlimit({ length, pathFile, process_running, child_process, clean_process, type, cron_name })
    }
    if (type == "UNLIMIT_GMAIL_EDU") {
        return await getEmailFileUnlimitGmailEdu({ length, pathFile, process_running, child_process, clean_process, type, cron_name })
    }

    if (type == "UNLIMIT_GMAIL_EDU_MAIL3979") {
        return await getEmailFileUnlimitGmailEduMail3979({ length, pathFile, process_running, child_process, clean_process, type, cron_name, id_service: id_s, cate_name })
    }
    if (type == "UNLIMIT BACKUP") {
        let data = {
            "quantity": length,
            "token": "hffkqp7uto1kb1atyedxyhr1t1uan9lgcl8pr5qdp8jnsgclmjqfw53cijf6xkn4hbzfb11744685697",
            "product_id": "5"
        }
        const config_count = {
            // proxy: "amac~ala:Sonetrend817@bupview.ddns.net:5003",
            timeout: 60000,
            method: 'GET',
            url: `https://unlimitmail.com/api/quantity?token=hffkqp7uto1kb1atyedxyhr1t1uan9lgcl8pr5qdp8jnsgclmjqfw53cijf6xkn4hbzfb11744685697&product_id=5`,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data),

        };
        let response_count = await makeRequest(config_count);
        console.log("Email avaiable: ", response_count.bodyJson.data)

        if (!response_count.bodyJson.data || !response_count.bodyJson.data[0] || !response_count.bodyJson.data[0].quantity) {
            console.log("Waiting for buy email...", response_count.body)
            await delay(5000)
            return await getEmail({ length, pathFile, process_running, child_process, clean_process, type })
        }
        response_count.bodyJson.data[0].quantity = parseInt(response_count.bodyJson.data[0].quantity)
        if (length > response_count.bodyJson.data[0].quantity) {
            // console.log("hi",length,response_count.bodyJson.data[0].quantity)
            data.quantity = response_count.bodyJson.data[0].quantity
        }
        const config = {
            // proxy: "amac~ala:Sonetrend817@bupview.ddns.net:5003",
            timeout: 60000,
            method: 'POST',
            url: 'https://unlimitmail.com/api/buyHotMailUd',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data),
            preCheckRetry: (body) => {
                if (!body.includes("password")) return true
            }
        };

        // console.log('length',config)
        // process.exit(1)
        try {
            let email_data = []
            const response = await makeRequest(config);
            if (!response.bodyJson.data || !response.bodyJson.data.length) {

                console.log("Waiting for buy email...", response.body)
                await delay(5000)
                return await getEmail({ length, pathFile, process_running, child_process, clean_process, type })
            }
            email_data = response.bodyJson.data
            return email_data

        } catch (e) {
            console.log("error get emails", e)
        }
    }
    if (type == "REG") {
        return await getHotMails({ length })
    }
    if (type == "DONGVAN") {
        return await getEmailFileDongVan({ length, pathFile, process_running, child_process, clean_process, type })
    }
    if (type = "DONGVAN BACKUP") {
        let res = await makeRequest({ url: `https://api.farmfb.net/user/buy?apikey=wvw9RM21nBYREAIHwrf11E6rr&account_type=1&quality=${length}&type=full` })
        let { data } = res.bodyJson;
        let emails = []
        if (data && data.list_data) {
            data.list_data.forEach(str => {

                let [email, password, refresh_token, client_id] = str.split("|");
                emails.push({ email, password, refresh_token, client_id })
            })

        } else {
            console.log("Waiting for buy email...", res.body)
            await delay(5000)
            return await getEmail({ length, pathFile, process_running, child_process, clean_process, type })
        }
        return emails
    }
    return []

}
async function setup(params) {
    let account = await getAccountLogout({ category: "tiktok_reg_vn_edu", category_to: "tiktok_reg_vn_no_avatar", status: "3", limit: 20000, page: 1, sort: "created", account_fields: "email,email_pass,uId", time_created: "0.1" })
    return account
}
async function countCate({ category }) {
    let url = `http://217.15.163.20:3002/api/accounts/countByCategory?category=tiktok_reg_vn_edu2&status=3`
    let res = await makeRequest({ url })
    let count = res.bodyJson.count;
    return count || -1;
}
async function getCookies({ email, cron_name }) {
    let url = `http://217.15.163.20:3002/api/accounts/getcookies?email=${email}`
    // console.log(url)
    let res = await makeRequest({ url })
    try {
        let cookies = res.bodyJson.account.meta.cookies
        return cookies
    } catch (e) {
        return []
    }

}
async function getCookiesRepair({ email, cron_name }) {
    let url = `http://217.15.163.20:3002/api/accounts/getcookies?email=${email}`
    // console.log(url)
    let res = await makeRequest({ url })
    try {
        // console.log(res.bodyJson.account.meta.cookies)
        let account = res.bodyJson.account;
        let sessionid = ''
        let cookies = getCookieByName(res.bodyJson.account.meta.cookies, "sessionid")
        if (!cookies) {
            sessionid = getString(res.bodyJson.account.cookie, 'sessionid=', ';')
            cookies = [{
                "name": "sessionid",
                "value": sessionid,
                "domain": ".tiktok.com",
                "path": "/",
                "expires": (Date.now() / 1000 + 365 * 24 * 60 * 60),
                "size": 41,
                "httpOnly": true,
                "secure": true,
                "session": false,
                "priority": "Medium",
                "sameParty": false,
                "sourceScheme": "Secure",
                "sourcePort": 443
            }]
        } else {
            sessionid = cookies.value
            cookies = [cookies]
        }
        let created = (new Date(account.created)).getTime()
        console.log("sessionid", sessionid, (new Date(account.created)).getTime())
        let data_check = await checkCookie(sessionid)
        console.log(data_check)
        if (data_check.status && !data_check.is_live && (Date.now() - created) > 48 * 60 * 60 * 1000) {
            console.log("should move", account.uId)
            await moveRemoveAccount([account.uId])
            return []
        }
        return cookies
    } catch (e) {
        console.log(e)
        return []
    }

}
async function getMstokenLike({ email, cron_name }) {
    let url = `http://217.15.163.20:3002/api/accounts/getcookies?email=${email}`
    // console.log(url)
    let res = await makeRequest({ url })
    try {
        // console.log(res.bodyJson.account.meta.cookies)
        let account = res.bodyJson.account;
        let msToken = ''
        let cookies = getCookieByNameDomain(res.bodyJson.account.meta.cookies, "msToken", ".tiktokw.us")
        if (!cookies) {
            // msToken = getString(res.bodyJson.account.cookie, 'msToken=', ';')
            return msToken;
        }
        msToken = cookies.value
        return msToken
    } catch (e) {
        console.log(e)
        return ""
    }

}
async function getMstokenLikeLive({ email, cron_name }) {
    let url = `http://217.15.163.20:3002/api/accounts/getcookies?email=${email}`
    // console.log(url)
    let res = await makeRequest({ url })
    try {
        // console.log(res.bodyJson.account.meta.cookies)
        let account = res.bodyJson.account;
        let msToken = ''
        let cookies = getCookieByNameDomain(res.bodyJson.account.meta.cookies, "msToken", ".tiktok.com")
        if (!cookies) {
            // msToken = getString(res.bodyJson.account.cookie, 'msToken=', ';')
            return msToken;
        }
        msToken = cookies.value
        return msToken
    } catch (e) {
        console.log(e)
        return ""
    }

}
async function moveRemoveAccount(accounts) {
    let config_move = {
        "method": "POST",
        url: `http://217.15.163.20:3002/api/accounts/move-to-category`,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "accounts": accounts,
            "category_to": "tiktok_too_much2"
        }),
    }
    let res_move = await makeRequest(config_move)
    return res_move;
}
async function checkCookie(sessionid) {
    let cookie_string = `sessionid=${sessionid};`
    let proxies = await getProxySite(120)
    let proxy = proxies[Math.floor(Math.random() * proxies.length)]
    let data = await checkCookieLive({ cookie_string, proxy: proxy, proxy_list: proxies });
    try {
        let data_account = JSON.parse(data.body)
        console.log(data_account)
        return {
            is_live: (data_account.data.username && data_account.data.user_id) ? true : false,
            status: true
        }
    } catch (e) {
        return {
            is_live: true,
            status: false
        }
    }
}
function getCookieByName(cookies, name) {
    return cookies.find(c => c.name === name) || null;
}
function getCookieByNameDomain(cookies, name, domain) {
    return cookies.find(c => c.name === name && c.domain === domain) || null;
}
async function getAccountLogout({ category, category_to, status, limit, page, sort, account_fields, time_created, cron_name, time_check = 24 * 7 }) {
    category = category || "tiktok_reg_vn_edu"
    category_to = category_to || "tiktok_reg_vn_no_avatar"
    status = status || "3"
    limit = limit || 20000
    page = page || 1
    sort = sort || "created"
    account_fields = account_fields || "email,email_pass,uId,created"
    time_created = time_created || "0.1"
    let url = `http://217.15.163.20:3002/api/accounts/getByCategoryV2?category=${category}&category_to=${category_to}&status=${status}&limit=${limit}&page=${page}&sort=${sort}&account_fields=${account_fields}&time_created=${time_created}`
    // console.log(url)
    let res = await makeRequest({ url })
    let file_name = cron_name || ""
    let path_done = path.resolve(`./mails_done${file_name}.txt`)
    let path_mails = path.resolve(`./mails${file_name}.txt`)

    let done_accounts_str = await strData(path_done);
    let mails_accounts_str = await strData(path_mails);
    let done_accounts = helper.parserAccounts({
        acc_string: done_accounts_str, getIndex: 0, number_slice: 0, key: "\n", number_ignore: 0, format: "email|password|access_token|refresh_token|client_id|runtime", key_format: "|", item_return_type: "object", preReturn: (object, cookie_string, item) => {
            return object.email
        }
    })
    let mails_accounts = helper.parserAccounts({
        acc_string: mails_accounts_str, getIndex: 0, number_slice: 0, key: "\n", number_ignore: 0, format: "email|password|access_token|refresh_token|client_id|runtime", key_format: "|", item_return_type: "object", preReturn: (object, cookie_string, item) => {
            return object.email
        }
    })
    done_accounts = done_accounts || []
    mails_accounts = mails_accounts || []
    let email_exists = []
    mails_accounts = mails_accounts.filter(i => {
        let email = i.email;
        let index = done_accounts.findIndex(j => j.email == email)
        email_exists.push(email)
        return index == -1
    })
    let account_logout = []
    account_logout = account_logout.concat(mails_accounts)
    let count_more = 0
    let account_over_24h = []
    res.bodyJson.forEach(i => {
        let email = i.email;
        let index = email_exists.findIndex(j => j == email)
        let time_created = (new Date(i.created)).getTime()
        // console.log(email,(Date.now()-time_created)/1000/60/60,time_created,i)
        let time_from_create = (Date.now() - time_created) / 1000 / 60 / 60
        // let time_check = 24*7
        if (time_from_create > time_check && time_check != 0) {
            account_over_24h.push(i.uId)
        }
        if (index == -1 && (time_from_create < time_check || time_check == 0)) {
            let client_id = ''
            if (i.meta && i.meta.cookies) {
                client_id = JSON.stringify(i.meta.cookies)
            }
            account_logout.push({ email, password: i.email_pass, access_token: i.uId, client_id: client_id, runtime: 0 })
            count_more++
        }
    })
    if (account_over_24h.length > 0) {
        let config_move = {
            "method": "POST",
            url: `http://217.15.163.20:3002/api/accounts/move-to-category`,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "accounts": account_over_24h,
                "category_to": "tiktok_too_much"
            }),


        }
        console.log(account_over_24h.length)
        let res_move = await makeRequest(config_move)
        console.log("res_move", res_move.bodyJson)
    }
    // console.log(account_logout,account_logout.length,res.bodyJson.length,mails_accounts.length)
    // save mails.txt with account_logout
    console.log("Thêm ", count_more, "email vào mails.txt")
    if (count_more > 0) {
        await writeFile({ data: account_logout.map(i => `${i.email}|${i.password}|${i.access_token}|${i.client_id}|${i.runtime}`).join('\n') + '\n', path: path_mails })
    }
    // return res.bodyJson
    return account_logout
}
async function getAccountLogout2({ category, category_to, status, limit, page, sort, account_fields, time_created, cron_name, time_check = 24 * 7 }) {
    category = category || "tiktok_reg_vn_edu"
    category_to = category_to || "tiktok_reg_vn_no_avatar"
    status = status || "3"
    limit = limit || 20000
    page = page || 1
    sort = sort || "created"
    account_fields = account_fields || "email,email_pass,uId,created"
    time_created = time_created || "0.1"
    let url = `http://217.15.163.20:3001/api/accounts/getByCategoryRepair?category=${category}&category_to=${category_to}&status=${status}&limit=${limit}&page=${page}&sort=${sort}&account_fields=${account_fields}&time_created=${time_created}`
    console.log(url)
    let res = await makeRequest({ url })
    let file_name = cron_name || ""
    let path_done = path.resolve(`./mails_done${file_name}.txt`)
    let path_mails = path.resolve(`./mails${file_name}.txt`)

    let done_accounts_str = await strData(path_done);
    let mails_accounts_str = await strData(path_mails);
    let done_accounts = helper.parserAccounts({
        acc_string: done_accounts_str, getIndex: 0, number_slice: 0, key: "\n", number_ignore: 0, format: "email|password|access_token|refresh_token|client_id|runtime", key_format: "|", item_return_type: "object", preReturn: (object, cookie_string, item) => {
            return object.email
        }
    })
    let mails_accounts = helper.parserAccounts({
        acc_string: mails_accounts_str, getIndex: 0, number_slice: 0, key: "\n", number_ignore: 0, format: "email|password|access_token|refresh_token|client_id|runtime", key_format: "|", item_return_type: "object", preReturn: (object, cookie_string, item) => {
            return object.email
        }
    })
    done_accounts = done_accounts || []
    mails_accounts = mails_accounts || []
    let email_exists = []
    mails_accounts = mails_accounts.filter(i => {
        let email = i.email;
        let index = done_accounts.findIndex(j => j.email == email)
        email_exists.push(email)
        return index == -1
    })
    let account_logout = []
    account_logout = account_logout.concat(mails_accounts)
    let count_more = 0
    let account_over_24h = []
    res.bodyJson.forEach(i => {
        let email = i.email;
        let index = email_exists.findIndex(j => j == email)
        let time_created = (new Date(i.created)).getTime()
        // console.log(email,(Date.now()-time_created)/1000/60/60,time_created,i)
        let time_from_create = (Date.now() - time_created) / 1000 / 60 / 60
        // let time_check = 24*7
        if (time_from_create > time_check && time_check != 0) {
            // account_over_24h.push(i.uId)
        }
        if (index == -1 && (time_from_create < time_check || time_check == 0)) {
            let client_id = ''
            if (i.meta && i.meta.cookies) {
                client_id = JSON.stringify(i.meta.cookies)
            }
            account_logout.push({ email, password: i.email_pass, access_token: i.uId, client_id: client_id, runtime: 0 })
            count_more++
        }
    })
    if (account_over_24h.length > 0) {
        let config_move = {
            "method": "POST",
            url: `http://217.15.163.20:3002/api/accounts/move-to-category`,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "accounts": account_over_24h,
                "category_to": "tiktok_too_much"
            }),


        }
        console.log(account_over_24h.length)
        let res_move = await makeRequest(config_move)
        console.log("res_move", res_move.bodyJson)
    }
    // console.log(account_logout,account_logout.length,res.bodyJson.length,mails_accounts.length)
    // save mails.txt with account_logout
    console.log("Thêm ", count_more, "email vào mails.txt")
    if (count_more > 0) {
        await writeFile({ data: account_logout.map(i => `${i.email}|${i.password}|${i.access_token}|${i.client_id}|${i.runtime}`).join('\n') + '\n', path: path_mails })
    }
    // return res.bodyJson
    return account_logout
}
async function getEmailFileLOCAL({ length, pathFile, process_running, child_process, clean_process, type, cron_name }) {
    let file_name = cron_name || ""
    let path_done = path.resolve(`./mails_done${file_name}.txt`)
    let path_mails = path.resolve(`./mails${file_name}.txt`)

    let done_accounts_str = await strData(path_done);
    let mails_accounts_str = await strData(path_mails);
    let done_accounts = helper.parserAccounts({
        acc_string: done_accounts_str, getIndex: 0, number_slice: 0, key: "\n", number_ignore: 0, format: "email|password|access_token|refresh_token|client_id|runtime", key_format: "|", item_return_type: "object", preReturn: (object, cookie_string, item) => {
            return object.email
        }
    })
    let mails_accounts = helper.parserAccounts({
        acc_string: mails_accounts_str, getIndex: 0, number_slice: 0, key: "\n", number_ignore: 0, format: "email|password|access_token|refresh_token|client_id|runtime", key_format: "|", item_return_type: "object", preReturn: (object, cookie_string, item) => {
            return object.email
        }
    })
    done_accounts = done_accounts || []
    mails_accounts = mails_accounts || []
    mails_accounts = mails_accounts.filter(i => {
        let email = i.email;
        let index = done_accounts.findIndex(j => j.email == email)
        return index == -1
    })
    length = Number(length)

    let data = {
        "quantity": length,
        "token": "hffkqp7uto1kb1atyedxyhr1t1uan9lgcl8pr5qdp8jnsgclmjqfw53cijf6xkn4hbzfb11744685697",
        "product_id": "5"
    }

    mails_accounts = mails_accounts.filter(i => !i.runtime || i.runtime < 3)
    // mails_accounts = mails_accounts.slice(0,length)
    data.quantity = length - mails_accounts.length
    console.log("Còn dư ", mails_accounts.length, "email")





    try {


        let data_write = ""
        mails_accounts.forEach((item, index) => {
            let { email, password, access_token, refresh_token, client_id, runtime } = item
            runtime = Number(runtime) || 0
            if (index < length) {
                data_write += `${email}|${password}|${access_token}|${refresh_token}|${client_id}|${runtime + 1}\n`
            } else {
                data_write += `${email}|${password}|${access_token}|${refresh_token}|${client_id}|${runtime}\n`
            }
        })
        if (mails_accounts.length > length) {
            mails_accounts = mails_accounts.slice(0, length)
        }
        await writeFile({ data: data_write, path: path_mails })
        await writeFile({ data: "", path: path_done })
        if (!mails_accounts.length) {
            // console.log("Waiting for buy email...")
            // await delay(5000)
            // return await getEmailFileLOCAL({ length, pathFile, process_running, child_process, clean_process, type })
        }
        return mails_accounts

    } catch (e) {
        console.log("error get emails", e)
    }




}
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
async function getEmailFileLOCAL2({ length, pathFile, process_running, child_process, clean_process, type, cron_name }) {
    let file_name = cron_name || ""
    let path_done = path.resolve(`./mails_done${file_name}.txt`)
    let path_mails = path.resolve(`./mails${file_name}.txt`)


    let done_accounts_str = await strData(path_done);
    let mails_accounts_str = await strData(path_mails);
    let done_accounts = helper.parserAccounts({
        acc_string: done_accounts_str, getIndex: 0, number_slice: 0, key: "\n", number_ignore: 0, format: "email|password|access_token|refresh_token|client_id|runtime", key_format: "|", item_return_type: "object", preReturn: (object, cookie_string, item) => {
            return object.email
        }
    })
    let mails_accounts = helper.parserAccounts({
        acc_string: mails_accounts_str, getIndex: 0, number_slice: 0, key: "\n", number_ignore: 0, format: "email|password|access_token|refresh_token|client_id|runtime", key_format: "|", item_return_type: "object", preReturn: (object, cookie_string, item) => {
            return object.email
        }
    })
    done_accounts = done_accounts || []
    mails_accounts = mails_accounts || []
    mails_accounts = mails_accounts.filter(i => {
        let email = i.email;
        let index = done_accounts.findIndex(j => j.email == email)
        return index == -1
    })
    length = Number(length)

    let data = {
        "quantity": length,
        "token": "hffkqp7uto1kb1atyedxyhr1t1uan9lgcl8pr5qdp8jnsgclmjqfw53cijf6xkn4hbzfb11744685697",
        "product_id": "5"
    }

    mails_accounts = mails_accounts.filter(i => !i.runtime || i.runtime < 3)
    if (mails_accounts.length < 1) {
        return []
    }
    mails_accounts = shuffle(mails_accounts)
    console.log(mails_accounts.length)

    // mails_accounts = mails_accounts.slice(0,length)
    data.quantity = length - mails_accounts.length
    console.log("Còn dư ", mails_accounts.length, "email")





    try {


        let data_write = ""
        mails_accounts.forEach((item, index) => {
            let { email, password, access_token, refresh_token, client_id, runtime } = item
            runtime = Number(runtime) || 0
            if (index < length) {
                data_write += `${email}|${password}|${access_token}|${refresh_token}|${client_id}|${runtime + 1}\n`
            } else {
                data_write += `${email}|${password}|${access_token}|${refresh_token}|${client_id}|${runtime}\n`
            }
        })
        if (mails_accounts.length > length) {
            mails_accounts = mails_accounts.slice(0, length)
        }
        // await writeFile({ data: data_write, path: path_mails })
        // await writeFile({ data: "", path: path_done })
        await writeFile({ data: "", path: path_mails })
        await writeFile({ data: "", path: path_done })
        if (!mails_accounts.length) {
            // console.log("Waiting for buy email...")
            // await delay(5000)
            // return await getEmailFileLOCAL({ length, pathFile, process_running, child_process, clean_process, type })
        }
        //     console.log(mails_accounts)
        // process.exit(1)
        return mails_accounts

    } catch (e) {
        console.log("error get emails", e)
    }
}
async function getEmailFileUnlimit({ length, pathFile, process_running, child_process, clean_process, type }) {
    let path_done = path.resolve("./mails_done.txt")
    let path_mails = path.resolve("./mails.txt")

    let done_accounts_str = await strData(path_done);
    let mails_accounts_str = await strData(path_mails);
    let done_accounts = helper.parserAccounts({
        acc_string: done_accounts_str, getIndex: 0, number_slice: 0, key: "\n", number_ignore: 0, format: "email|password|access_token|refresh_token|client_id|runtime", key_format: "|", item_return_type: "object", preReturn: (object, cookie_string, item) => {
            return object.email
        }
    })
    let mails_accounts = helper.parserAccounts({
        acc_string: mails_accounts_str, getIndex: 0, number_slice: 0, key: "\n", number_ignore: 0, format: "email|password|access_token|refresh_token|client_id|runtime", key_format: "|", item_return_type: "object", preReturn: (object, cookie_string, item) => {
            return object.email
        }
    })
    done_accounts = done_accounts || []
    mails_accounts = mails_accounts || []
    mails_accounts = mails_accounts.filter(i => {
        let email = i.email;
        let index = done_accounts.findIndex(j => j.email == email)
        return index == -1
    })
    length = Number(length)

    let data = {
        "quantity": length,
        "token": "hffkqp7uto1kb1atyedxyhr1t1uan9lgcl8pr5qdp8jnsgclmjqfw53cijf6xkn4hbzfb11744685697",
        "product_id": "5"
    }

    mails_accounts = mails_accounts.filter(i => !i.runtime || i.runtime < 3)
    // mails_accounts = mails_accounts.slice(0,length)
    data.quantity = length - mails_accounts.length
    console.log("Còn dư ", mails_accounts.length, "email")
    if (mails_accounts.length < length) {

        const config_count = {
            // proxy: "amac~ala:Sonetrend817@bupview.ddns.net:5003",
            timeout: 60000,
            method: 'GET',
            url: `https://unlimitmail.com/api/quantity?token=hffkqp7uto1kb1atyedxyhr1t1uan9lgcl8pr5qdp8jnsgclmjqfw53cijf6xkn4hbzfb11744685697&product_id=5`,
            headers: {
                'Content-Type': 'application/json'
            },

        };

        const response_count = await makeRequest(config_count);
        console.log("Email avaiable: ", response_count.bodyJson.data)

        if (!mails_accounts.length && (!response_count.bodyJson.data || !response_count.bodyJson.data[0] || !response_count.bodyJson.data[0].quantity)) {
            console.log("Waiting for buy email...", response_count.body)
            await delay(5000)
            return await getEmailFileUnlimit({ length, pathFile, process_running, child_process, clean_process, type })
        }
        if (data.quantity > Number(response_count.bodyJson.data[0].quantity)) {
            data.quantity = response_count.bodyJson.data[0].quantity
        }
    }



    const config = {
        // proxy: "amac~ala:Sonetrend817@bupview.ddns.net:5003",
        timeout: 60000,
        method: 'POST',
        url: 'https://unlimitmail.com/api/buyHotMailUd',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
        preCheckRetry: (body) => {
            if (!body.includes("password")) return true
        }
    };

    try {
        let email_data = []



        if (data.quantity > 0) {
            console.log("Mua thêm ", data.quantity, "email")

            const response = await makeRequest(config);
            if (!mails_accounts.length && (!response.bodyJson.data || !response.bodyJson.data.length)) {

                console.log("Waiting for buy email...", response.body)
                await delay(5000)
                return await getEmail({ length, pathFile, process_running, child_process, clean_process, type })
            }
            email_data = response.bodyJson.data || []
            mails_accounts = [...mails_accounts, ...email_data];

        }


        let data_write = ""
        mails_accounts.forEach((item, index) => {
            let { email, password, access_token, refresh_token, client_id, runtime } = item
            runtime = Number(runtime) || 0
            if (index < length) {
                data_write += `${email}|${password}|${access_token}|${refresh_token}|${client_id}|${runtime + 1}\n`
            } else {
                data_write += `${email}|${password}|${access_token}|${refresh_token}|${client_id}|${runtime}\n`
            }
        })
        if (mails_accounts.length > length) {
            mails_accounts = mails_accounts.slice(0, length)
        }
        await writeFile({ data: data_write, path: path_mails })
        await writeFile({ data: "", path: path_done })
        if (!mails_accounts.length) {
            console.log("Waiting for buy email...")
            await delay(5000)
            return await getEmail({ length, pathFile, process_running, child_process, clean_process, type })
        }
        return mails_accounts

    } catch (e) {
        console.log("error get emails", e)
    }




}
async function getEmailFileUnlimitEdu({ length, pathFile, process_running, child_process, clean_process, type }) {
    let path_done = path.resolve("./edu_mails_done.txt")
    let path_mails = path.resolve("./edu_mails.txt")

    let done_accounts_str = await strData(path_done);
    let mails_accounts_str = await strData(path_mails);
    mails_accounts_str = ""
    let done_accounts = helper.parserAccounts({
        acc_string: done_accounts_str, getIndex: 0, number_slice: 0, key: "\n", number_ignore: 0, format: "email|password|access_token|refresh_token|client_id|runtime", key_format: "|", item_return_type: "object", preReturn: (object, cookie_string, item) => {
            return object.email
        }
    })
    let mails_accounts = helper.parserAccounts({
        acc_string: mails_accounts_str, getIndex: 0, number_slice: 0, key: "\n", number_ignore: 0, format: "email|password|access_token|refresh_token|client_id|runtime", key_format: "|", item_return_type: "object", preReturn: (object, cookie_string, item) => {
            return object.email
        }
    })
    done_accounts = done_accounts || []
    mails_accounts = mails_accounts || []
    mails_accounts = mails_accounts.filter(i => {
        let email = i.email;
        let index = done_accounts.findIndex(j => j.email == email)
        return index == -1
    })
    length = Number(length)

    let data = {
        "quantity": length,
        "token": "hffkqp7uto1kb1atyedxyhr1t1uan9lgcl8pr5qdp8jnsgclmjqfw53cijf6xkn4hbzfb11744685697",
        "product_id": "30"
    }

    mails_accounts = mails_accounts.filter(i => !i.runtime || i.runtime < 3)
    // mails_accounts = mails_accounts.slice(0,length)
    data.quantity = length - mails_accounts.length
    console.log("Còn dư ", mails_accounts.length, "email")
    if (mails_accounts.length < length) {

        const config_count = {
            // proxy: "amac~ala:Sonetrend817@bupview.ddns.net:5003",
            timeout: 60000,
            method: 'GET',
            url: `https://unlimitmail.com/api/quantity?token=hffkqp7uto1kb1atyedxyhr1t1uan9lgcl8pr5qdp8jnsgclmjqfw53cijf6xkn4hbzfb11744685697&product_id=30`,
            headers: {
                'Content-Type': 'application/json'
            },

        };

        const response_count = await makeRequest(config_count);
        console.log("Email avaiable: ", response_count.bodyJson.data)

        if (!mails_accounts.length && (!response_count.bodyJson.data || !response_count.bodyJson.data[0] || !response_count.bodyJson.data[0].quantity)) {
            console.log("Waiting for buy email...", response_count.body)
            await delay(5000)
            return await getEmailFileUnlimitEdu({ length, pathFile, process_running, child_process, clean_process, type })
        }
        if (data.quantity > Number(response_count.bodyJson.data[0].quantity)) {
            data.quantity = response_count.bodyJson.data[0].quantity
        }
    }



    const config = {
        // proxy: "amac~ala:Sonetrend817@bupview.ddns.net:5003",
        timeout: 60000,
        method: 'POST',
        url: 'https://unlimitmail.com/api/buyHotMailUd',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
        preCheckRetry: (body) => {
            if (!body.includes("password")) return true
        }
    };

    try {
        let email_data = []



        if (data.quantity > 0) {
            console.log("Mua thêm ", data.quantity, "email")

            const response = await makeRequest(config);
            if (!mails_accounts.length && (!response.bodyJson.data || !response.bodyJson.data.length)) {

                console.log("Waiting for buy email...", response.body)
                await delay(5000)
                return await getEmailFileUnlimitEdu({ length, pathFile, process_running, child_process, clean_process, type })
            }
            email_data = response.bodyJson.data || []
            mails_accounts = [...mails_accounts, ...email_data];

        }


        let data_write = ""
        mails_accounts.forEach((item, index) => {
            let { email, password, access_token, refresh_token, client_id, runtime } = item
            runtime = Number(runtime) || 0
            if (index < length) {
                data_write += `${email}|${password}|${access_token}|${refresh_token}|${client_id}|${runtime + 1}\n`
            } else {
                data_write += `${email}|${password}|${access_token}|${refresh_token}|${client_id}|${runtime}\n`
            }
        })
        if (mails_accounts.length > length) {
            mails_accounts = mails_accounts.slice(0, length)
        }
        await writeFile({ data: data_write, path: path_mails })
        await writeFile({ data: "", path: path_done })
        if (!mails_accounts.length) {
            console.log("Waiting for buy email...")
            await delay(5000)
            return await getEmail({ length, pathFile, process_running, child_process, clean_process, type })
        }
        return mails_accounts

    } catch (e) {
        console.log("error get emails", e)
    }




}
async function getEmailFileUnlimitGmailEdu({ length, pathFile, process_running, child_process, clean_process, type }) {
    let path_done = path.resolve("./mails_done.txt")
    let path_mails = path.resolve("./mails.txt")

    let done_accounts_str = await strData(path_done);
    let mails_accounts_str = await strData(path_mails);
    let done_accounts = helper.parserAccounts({
        acc_string: done_accounts_str, getIndex: 0, number_slice: 0, key: "\n", number_ignore: 0, format: "email|password|access_token|refresh_token|client_id|runtime", key_format: "|", item_return_type: "object", preReturn: (object, cookie_string, item) => {
            return object.email
        }
    })
    let mails_accounts = helper.parserAccounts({
        acc_string: mails_accounts_str, getIndex: 0, number_slice: 0, key: "\n", number_ignore: 0, format: "email|password|access_token|refresh_token|client_id|runtime", key_format: "|", item_return_type: "object", preReturn: (object, cookie_string, item) => {
            return object.email
        }
    })
    done_accounts = done_accounts || []
    mails_accounts = mails_accounts || []
    mails_accounts = mails_accounts.filter(i => {
        let email = i.email;
        let index = done_accounts.findIndex(j => j.email == email)
        return index == -1
    })
    length = Number(length)

    let data = {
        "quantity": length,
        "token": "hffkqp7uto1kb1atyedxyhr1t1uan9lgcl8pr5qdp8jnsgclmjqfw53cijf6xkn4hbzfb11744685697",
        "product_id": "30"
    }

    mails_accounts = mails_accounts.filter(i => !i.runtime || i.runtime < 10)
    // mails_accounts = mails_accounts.slice(0,length)
    data.quantity = length - mails_accounts.length
    console.log("Còn dư ", mails_accounts.length, "email")
    if (mails_accounts.length < length) {

        const config_count = {
            // proxy: "amac~ala:Sonetrend817@bupview.ddns.net:5003",
            timeout: 60000,
            method: 'GET',
            url: `https://unlimitmail.com/api/quantity?token=hffkqp7uto1kb1atyedxyhr1t1uan9lgcl8pr5qdp8jnsgclmjqfw53cijf6xkn4hbzfb11744685697&product_id=30`,
            headers: {
                'Content-Type': 'application/json'
            },

        };

        const response_count = await makeRequest(config_count);
        console.log("Email avaiable: ", response_count.bodyJson.data)

        if (!mails_accounts.length && (!response_count.bodyJson.data || !response_count.bodyJson.data[0] || !response_count.bodyJson.data[0].quantity)) {
            console.log("Waiting for buy email...", response_count.body)
            await delay(5000)
            return await getEmailFileUnlimitGmailEdu({ length, pathFile, process_running, child_process, clean_process, type })
        }
        if (data.quantity > Number(response_count.bodyJson.data[0].quantity)) {
            data.quantity = response_count.bodyJson.data[0].quantity
        }
    }



    const config = {
        // proxy: "amac~ala:Sonetrend817@bupview.ddns.net:5003",
        timeout: 60000,
        method: 'POST',
        url: 'https://unlimitmail.com/api/buyHotMailUd',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
        preCheckRetry: (body) => {
            if (!body.includes("password")) return true
        }
    };

    try {
        let email_data = []



        if (data.quantity > 0) {
            console.log("Mua thêm ", data.quantity, "email")

            const response = await makeRequest(config);
            if (!mails_accounts.length && (!response.bodyJson.data || !response.bodyJson.data.length)) {

                console.log("Waiting for buy email...", response.body)
                await delay(5000)
                return await getEmailFileUnlimitGmailEdu({ length, pathFile, process_running, child_process, clean_process, type })
            }
            email_data = response.bodyJson.data || []
            mails_accounts = [...mails_accounts, ...email_data];

        }


        let data_write = ""
        for (let i = 0; i < mails_accounts.length; i++) {
            mails_accounts[i].email = mails_accounts[i].email.toLowerCase()
        }
        mails_accounts.forEach((item, index) => {
            let { email, password, access_token, refresh_token, client_id, runtime } = item
            runtime = Number(runtime) || 0
            if (index < length) {
                data_write += `${email}|${password}|${access_token}|${refresh_token}|${client_id}|${runtime + 1}\n`
            } else {
                data_write += `${email}|${password}|${access_token}|${refresh_token}|${client_id}|${runtime}\n`
            }
        })
        if (mails_accounts.length > length) {
            mails_accounts = mails_accounts.slice(0, length)
        }
        await writeFile({ data: data_write, path: path_mails })
        await writeFile({ data: "", path: path_done })
        if (!mails_accounts.length) {
            console.log("Waiting for buy email...")
            await delay(5000)
            return await getEmailFileUnlimitGmailEdu({ length, pathFile, process_running, child_process, clean_process, type })
        }
        return mails_accounts

    } catch (e) {
        console.log("error get emails", e)
    }
}
async function getEmailFileUnlimitGmailEduMail3979({ length, pathFile, process_running, child_process, clean_process, type, cron_name, id_service, cate_name }) {
    let file_name = cron_name || ""
    let category = cate_name || "tiktok_reg_vn_edu2"
    let path_done = path.resolve(`./mails_done${file_name}.txt`)
    let path_mails = path.resolve(`./mails${file_name}.txt`)

    let done_accounts_str = await strData(path_done);
    let mails_accounts_str = await strData(path_mails);
    let done_accounts = helper.parserAccounts({
        acc_string: done_accounts_str, getIndex: 0, number_slice: 0, key: "\n", number_ignore: 0, format: "email|password|access_token|refresh_token|client_id|runtime", key_format: "|", item_return_type: "object", preReturn: (object, cookie_string, item) => {
            return object.email
        }
    })
    let mails_accounts = helper.parserAccounts({
        acc_string: mails_accounts_str, getIndex: 0, number_slice: 0, key: "\n", number_ignore: 0, format: "email|password|access_token|refresh_token|client_id|runtime", key_format: "|", item_return_type: "object", preReturn: (object, cookie_string, item) => {
            return object.email
        }
    })
    done_accounts = done_accounts || []
    mails_accounts = mails_accounts || []
    mails_accounts = mails_accounts.filter(i => {
        let email = i.email;
        let index = done_accounts.findIndex(j => j.email == email)
        return index == -1
    })
    length = Number(length)

    let data = {
        "quantity": length,
        "token": "hffkqp7uto1kb1atyedxyhr1t1uan9lgcl8pr5qdp8jnsgclmjqfw53cijf6xkn4hbzfb11744685697",
        "product_id": "30"
    }

    mails_accounts = mails_accounts.filter(i => !i.runtime || i.runtime < 10)
    // mails_accounts = mails_accounts.slice(0,length)
    data.quantity = length - mails_accounts.length
    console.log("Còn dư ", mails_accounts.length, "email")
    if (mails_accounts.length < length) {

        const config_count = {
            // proxy: "amac~ala:Sonetrend817@bupview.ddns.net:5003",
            timeout: 60000,
            method: 'GET',
            url: `https://tmail12.com/api/product.php?api_key=91f2001fabefa6ddd5f96ae4b36acbb4N8UBst9cXl6nY3POjiE0zgAw2ouFZWMH&product=${id_service}`,
            headers: {
                'Content-Type': 'application/json'
            },

        };

        const response_count = await makeRequest(config_count);
        let product = response_count.bodyJson.product[0]
        console.log("Email avaiable: ", product.amount)

        // console.log("Email avaiable: ", response_count.bodyJson)
        // process.exit(1)
        if (!mails_accounts.length && (!product || !product.amount)) {
            console.log("Waiting for buy email...", response_count.body)
            return []
            await delay(5000)
            return await getEmail({ length, pathFile, process_running, child_process, clean_process, type })
        }
        if (data.quantity > Number(product.amount)) {
            data.quantity = product.amount
        }
    }

    let ip_address = "";
    try {
        ip_address = await helper.getIpAddress();
    } catch (e) {
        console.log("Could not get IP address:", e.message);
    }

    const config = {
        // proxy: "amac~ala:Sonetrend817@bupview.ddns.net:5003",
        timeout: 60000,
        method: 'GET',
        url: 'http://217.15.163.20:3002/api/accounts/buyemail?amount=' + data.quantity + '&category=' + category + '&ip=' + ip_address + '&id=' + id_service,
        // url: 'https://tmail12.com/api/buy_product.php?api_key=248796cda732398bff0da50df1951a58jL9gOVfKzMxs54pFyuSDtQvZqk1G7l8E&id=50&action=buyProduct&amount='+data.quantity,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    try {
        let email_data = []



        if (data.quantity > 0) {
            console.log("Mua thêm ", data.quantity, "email")

            const response = await makeRequest(config);
            // {"status":"success","msg":"T\u1ea1o \u0111\u01a1n h\u00e0ng th\u00e0nh c\u00f4ng!","trans_id":"UT1468fb21be4a9e1","data":["SeanFitzpatricky0lee@choos.us|Nxnt3979","CherritaHoytwmkk5@choos.us|Nxnt3979"]}
            console.log("response", response)
            if (!mails_accounts.length && (!response.bodyJson.data || !response.bodyJson.data.length)) {

                console.log("Waiting for buy email...", response.body)
                return []
                await delay(5000)
                return await getEmailFileUnlimitGmailEduMail3979({ length, pathFile, process_running, child_process, clean_process, type })
            }
            try {
                for (let i = 0; i < response.bodyJson.data.length; i++) {
                    let account = response.bodyJson.data[i]
                    let [email, password] = account.split("|")
                    email_data.push({ email, password })
                }
            } catch (e) {
                console.log("eee", e)
            }
            mails_accounts = [...mails_accounts, ...email_data];

        }


        let data_write = ""
        for (let i = 0; i < mails_accounts.length; i++) {
            mails_accounts[i].email = mails_accounts[i].email.toLowerCase()
        }
        mails_accounts.forEach((item, index) => {
            let { email, password, access_token, refresh_token, client_id, runtime } = item
            runtime = Number(runtime) || 0
            if (index < length) {
                data_write += `${email}|${password}|${access_token}|${refresh_token}|${client_id}|${runtime + 1}\n`
            } else {
                data_write += `${email}|${password}|${access_token}|${refresh_token}|${client_id}|${runtime}\n`
            }
        })
        if (mails_accounts.length > length) {
            mails_accounts = mails_accounts.slice(0, length)
        }
        await writeFile({ data: data_write, path: path_mails })
        await writeFile({ data: "", path: path_done })
        if (!mails_accounts.length) {
            console.log("Waiting for buy email...")
            await delay(5000)
            return await getEmail({ length, pathFile, process_running, child_process, clean_process, type })
        }
        return mails_accounts

    } catch (e) {
        console.log("error get emails", e)
    }
}
async function getEmailFileUnlimitGmailEduMail39791({ length, pathFile, process_running, child_process, clean_process, type, cron_name }) {
    let file_name = cron_name || ""
    let path_done = path.resolve(`./mails_done${file_name}.txt`)
    let path_mails = path.resolve(`./mails${file_name}.txt`)

    let done_accounts_str = await strData(path_done);
    let mails_accounts_str = await strData(path_mails);
    let done_accounts = helper.parserAccounts({
        acc_string: done_accounts_str, getIndex: 0, number_slice: 0, key: "\n", number_ignore: 0, format: "email|password|access_token|refresh_token|client_id|runtime", key_format: "|", item_return_type: "object", preReturn: (object, cookie_string, item) => {
            return object.email
        }
    })
    let mails_accounts = helper.parserAccounts({
        acc_string: mails_accounts_str, getIndex: 0, number_slice: 0, key: "\n", number_ignore: 0, format: "email|password|access_token|refresh_token|client_id|runtime", key_format: "|", item_return_type: "object", preReturn: (object, cookie_string, item) => {
            return object.email
        }
    })
    done_accounts = done_accounts || []
    mails_accounts = mails_accounts || []
    mails_accounts = mails_accounts.filter(i => {
        let email = i.email;
        let index = done_accounts.findIndex(j => j.email == email)
        return index == -1
    })
    length = Number(length)

    let data = {
        "quantity": length,
        "token": "hffkqp7uto1kb1atyedxyhr1t1uan9lgcl8pr5qdp8jnsgclmjqfw53cijf6xkn4hbzfb11744685697",
        "product_id": "30"
    }

    mails_accounts = mails_accounts.filter(i => !i.runtime || i.runtime < 10)
    // mails_accounts = mails_accounts.slice(0,length)
    data.quantity = length - mails_accounts.length
    console.log("Còn dư ", mails_accounts.length, "email")
    if (mails_accounts.length < length) {

        const config_count = {
            // proxy: "amac~ala:Sonetrend817@bupview.ddns.net:5003",
            timeout: 60000,
            method: 'GET',
            url: `https://mail3979.com/api/InfoResource.php?username=alibaba&password=alibaba123&id=46`,
            headers: {
                'Content-Type': 'application/json'
            },

        };

        const response_count = await makeRequest(config_count);
        console.log("Email avaiable: ", response_count.bodyJson.data)

        if (!mails_accounts.length && (!response_count.bodyJson.data || !response_count.bodyJson.data.amount)) {
            console.log("Waiting for buy email...", response_count.body)
            return []
            await delay(5000)
            return await getEmail({ length, pathFile, process_running, child_process, clean_process, type })
        }
        if (data.quantity > Number(response_count.bodyJson.data.amount)) {
            data.quantity = response_count.bodyJson.data.amount
        }
    }



    const config = {
        // proxy: "amac~ala:Sonetrend817@bupview.ddns.net:5003",
        timeout: 60000,
        method: 'GET',
        url: 'https://mail3979.com/api/BResource.php?username=amac&password=@Vanthinh129&id=46&amount=' + data.quantity,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    try {
        let email_data = []



        if (data.quantity > 0) {
            console.log("Mua thêm ", data.quantity, "email")

            const response = await makeRequest(config);
            console.log("response", response)
            if (!mails_accounts.length && (!response.bodyJson.data || !response.bodyJson.data.lists || !response.bodyJson.data.lists.length)) {

                console.log("Waiting for buy email...", response.body)
                return []
                await delay(5000)
                return await getEmailFileUnlimitGmailEduMail3979({ length, pathFile, process_running, child_process, clean_process, type })
            }
            try {
                for (let i = 0; i < response.bodyJson.data.lists.length; i++) {
                    let { account } = response.bodyJson.data.lists[i]
                    let [email, password] = account.split("|")
                    email_data.push({ email, password })
                }
            } catch (e) { }
            mails_accounts = [...mails_accounts, ...email_data];

        }


        let data_write = ""
        for (let i = 0; i < mails_accounts.length; i++) {
            mails_accounts[i].email = mails_accounts[i].email.toLowerCase()
        }
        mails_accounts.forEach((item, index) => {
            let { email, password, access_token, refresh_token, client_id, runtime } = item
            runtime = Number(runtime) || 0
            if (index < length) {
                data_write += `${email}|${password}|${access_token}|${refresh_token}|${client_id}|${runtime + 1}\n`
            } else {
                data_write += `${email}|${password}|${access_token}|${refresh_token}|${client_id}|${runtime}\n`
            }
        })
        if (mails_accounts.length > length) {
            mails_accounts = mails_accounts.slice(0, length)
        }
        await writeFile({ data: data_write, path: path_mails })
        await writeFile({ data: "", path: path_done })
        if (!mails_accounts.length) {
            console.log("Waiting for buy email...")
            await delay(5000)
            return await getEmail({ length, pathFile, process_running, child_process, clean_process, type })
        }
        return mails_accounts

    } catch (e) {
        console.log("error get emails", e)
    }
}
async function getEmailFileDongVan({ length, pathFile, process_running, child_process, clean_process, type }) {
    let path_done = path.resolve("./mails_done.txt")
    let path_mails = path.resolve("./mails.txt")

    let done_accounts_str = await strData(path_done);
    let mails_accounts_str = await strData(path_mails);
    let done_accounts = helper.parserAccounts({
        acc_string: done_accounts_str, getIndex: 0, number_slice: 0, key: "\n", number_ignore: 0, format: "email|password|access_token|refresh_token|client_id|runtime", key_format: "|", item_return_type: "object", preReturn: (object, cookie_string, item) => {
            return object.email
        }
    })
    let mails_accounts = helper.parserAccounts({
        acc_string: mails_accounts_str, getIndex: 0, number_slice: 0, key: "\n", number_ignore: 0, format: "email|password|access_token|refresh_token|client_id|runtime", key_format: "|", item_return_type: "object", preReturn: (object, cookie_string, item) => {
            return object.email
        }
    })
    done_accounts = done_accounts || []
    mails_accounts = mails_accounts || []
    mails_accounts = mails_accounts.filter(i => {
        let email = i.email;
        let index = done_accounts.findIndex(j => j.email == email)
        return index == -1
    })



    try {

        let email_data = []
        mails_accounts = mails_accounts.filter(i => !i.runtime || i.runtime < 3)

        length = length - mails_accounts.length

        let res = await makeRequest({ url: `https://api.dongvanfb.net/user/buy?apikey=wvw9RM21nBYREAIHwrf11E6rr&account_type=1&quality=${length}&type=full` })
        let { data } = res.bodyJson;
        let emails = []
        if (data && data.list_data) {
            data.list_data.forEach(str => {

                let [email, password, refresh_token, client_id] = str.split("|");
                emails.push({ email, password, refresh_token, client_id })
            })

        }



        if (!mails_accounts.length && !emails.length) {

            console.log("Waiting for buy email...", res.body)
            await delay(5000)
            return await getEmailFileDongVan({ length, pathFile, process_running, child_process, clean_process, type })
        }
        mails_accounts = [...mails_accounts, ...emails];




        let data_write = ""
        mails_accounts.forEach((item, index) => {
            let { email, password, access_token, refresh_token, client_id, runtime } = item
            runtime = Number(runtime) || 0

            data_write += `${email}|${password || ""}|${access_token || ""}|${refresh_token || ""}|${client_id || ""}|${runtime + 1}\n`
        })
        await writeFile({ data: data_write, path: path_mails })
        await writeFile({ data: "", path: path_done })

        return mails_accounts

    } catch (e) {
        console.log("error get emails", e)
    }
}
async function getEmailGmailEdu({ length, pathFile, process_running, child_process, clean_process, type }) {
    let path_done = path.resolve("./mails_done.txt")
    let path_mails = path.resolve("./mails.txt")

    let done_accounts_str = await strData(path_done);
    let mails_accounts_str = await strData(path_mails);
    let done_accounts = helper.parserAccounts({
        acc_string: done_accounts_str, getIndex: 0, number_slice: 0, key: "\n", number_ignore: 0, format: "email|password|access_token|refresh_token|client_id|runtime", key_format: "|", item_return_type: "object", preReturn: (object, cookie_string, item) => {
            return object.email
        }
    })
    let mails_accounts = helper.parserAccounts({
        acc_string: mails_accounts_str, getIndex: 0, number_slice: 0, key: "\n", number_ignore: 0, format: "email|password|access_token|refresh_token|client_id|runtime", key_format: "|", item_return_type: "object", preReturn: (object, cookie_string, item) => {
            return object.email
        }
    })
    done_accounts = done_accounts || []
    mails_accounts = mails_accounts || []
    mails_accounts = mails_accounts.filter(i => {
        let email = i.email;
        let index = done_accounts.findIndex(j => j.email == email)
        return index == -1
    })
    length = Number(length)

    let data = {
        "quantity": length
    }

    mails_accounts = mails_accounts.filter(i => !i.runtime || i.runtime < 10)
    // mails_accounts = mails_accounts.slice(0,length)
    data.quantity = length - mails_accounts.length
    console.log("Còn dư ", mails_accounts.length, "email")
    if (mails_accounts.length < length) {

        const config_count = {
            // proxy: "amac~ala:Sonetrend817@bupview.ddns.net:5003",
            timeout: 60000,
            method: 'GET',
            url: `http://143.198.82.202:3000/api/users/count`,
            headers: {
                'Content-Type': 'application/json'
            },

        };

        const response_count = await makeRequest(config_count);
        console.log("Email avaiable: ", response_count.bodyJson)

        if (!mails_accounts.length && (!response_count.bodyJson || !response_count.bodyJson.maxUsers || !response_count.bodyJson.canCreateMore)) {
            console.log("Waiting for buy email edu...", response_count.body)
            await delay(5000)
            return await getEmailGmailEdu({ length, pathFile, process_running, child_process, clean_process, type })
        }
        let quantity = response_count.bodyJson.maxUsers - response_count.bodyJson.count
        if (data.quantity > Number(quantity)) {
            data.quantity = quantity
        }
    }





    try {
        let email_data = []
        // each post to http://143.198.82.202:3000/api/users will get 1 email
        // body : {"email":}

        if (data.quantity > 0) {
            console.log("Mua thêm ", data.quantity, "email")
            for (let i = 0; i < data.quantity; i++) {
                const domain_email = "gen-image.xyz"
                const username = generateRandomName(getRandomInt(10, 15)) + getRandomInt(111, 999)
                const email = username + '@' + domain_email;
                console.log("email", email)
                const password = "@Amacservice12121"
                const data_post = {
                    "email": email,
                    "firstName": generateRandomName(getRandomInt(10, 15)),
                    "lastName": generateRandomName(getRandomInt(10, 15)),
                    "password": password
                }
                // console.log(data_post)
                const response = await makeRequest({
                    method: 'POST',
                    url: 'http://143.198.82.202:3000/api/users',
                    body: JSON.stringify(data_post),
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 120000
                });
                // console.log("response",response)
                if (response.bodyJson.user && response.bodyJson.user.email) {
                    mails_accounts.push({
                        email: response.bodyJson.user.email,
                        password: password,
                        runtime: 0,
                        access_token: "",
                        refresh_token: "",
                        client_id: ""
                    })
                }

            }
            // const response = await makeRequest(config);
            // if (!mails_accounts.length && (!response.bodyJson.data || !response.bodyJson.data.length)) {

            //     console.log("Waiting for buy email...", response.body)
            //     await delay(5000)
            //     return await getEmailFileUnlimitGmailEdu({ length, pathFile, process_running, child_process, clean_process, type })
            // }
            // email_data = response.bodyJson.data || []
            // mails_accounts = [...mails_accounts, ...email_data];

        }


        let data_write = ""
        for (let i = 0; i < mails_accounts.length; i++) {
            mails_accounts[i].email = mails_accounts[i].email.toLowerCase()
        }
        mails_accounts.forEach((item, index) => {
            let { email, password, access_token, refresh_token, client_id, runtime } = item
            runtime = Number(runtime) || 0
            if (index < length) {
                data_write += `${email}|${password}|${access_token}|${refresh_token}|${client_id}|${runtime + 1}\n`
            } else {
                data_write += `${email}|${password}|${access_token}|${refresh_token}|${client_id}|${runtime}\n`
            }
        })
        if (mails_accounts.length > length) {
            mails_accounts = mails_accounts.slice(0, length)
        }
        await writeFile({ data: data_write, path: path_mails })
        await writeFile({ data: "", path: path_done })
        if (!mails_accounts.length) {
            console.log("Waiting for buy email...")
            await delay(5000)
            return await getEmailGmailEdu({ length, pathFile, process_running, child_process, clean_process, type })
        }
        return mails_accounts

    } catch (e) {
        console.log("error get emails", e)
    }
}
async function deleteEmailEdu({ email }) {
    if (!email.includes("gen-image.xyz")) {
        return false
    }
    try {
        let res = await makeRequest({
            url: `http://143.198.82.202:3000/api/users/${email}`,
            method: "DELETE"
        })
        return res.bodyJson
    } catch (e) {
        console.log("error deleteEmailEdu", e)
        return false
    }
}
async function getProxySite2(time = 360) {
    // return ["user25177:1765375294@103.179.188.215:25177","user25177:1765375294@103.179.188.215:25177","user25177:1765375294@103.179.188.215:25177","user25177:1765375294@103.179.188.215:25177","user25177:1765375294@103.179.188.215:25177"]
    let proxies = []
    try {
        let res = await makeRequest({ url: `http://217.15.163.20:11001/proxies` })
        proxies = res.bodyJson.proxies
        // console.log("proxies",proxies)
    } catch (e) { }
    return proxies
}
async function getProxySite(time = 360) {
    // return getProxyFile(time);
    let res = await makeRequest({
        url: `http://217.15.163.20:8549/api/cron/getliveproxies?authensone=mysonetrend&time=${time}
  `})
    let proxies = res.bodyJson.proxies
    return proxies
}
async function getProxyFile(time = 360) {
    const path_file = "./proxies.txt"
    const data = await strData(path_file);
    let proxies = data.split('\n')
    let proxies_return = proxies.map(i => parseProxyString(i))
    return proxies_return
}
function parseProxyString(proxy_string) {
    var proxy_data = {
        proxy: {
            host: '',
            port: ''
        }
    }
    var proxy_array = proxy_string.replace('http://', '').replace('@', ':').split(':');
    if (proxy_array.length == 4) {
        if (proxy_string.includes('@')) {
            proxy_data = {
                proxy: {
                    host: proxy_array[2],
                    port: parseInt(proxy_array[3]),
                    proxyAuth: `${proxy_array[0]}:${proxy_array[1]}`
                }
            };
        } else {
            proxy_data = {
                proxy: {
                    host: proxy_array[0],
                    port: parseInt(proxy_array[1]),
                    proxyAuth: `${proxy_array[2]}:${proxy_array[3]}`
                }
            };
        }
    } else if (proxy_array.length == 2) {
        proxy_data = {
            proxy: {
                host: proxy_array[0],
                port: parseInt(proxy_array[1])
            }
        };
    }
    if (proxy_data.proxy.proxyAuth) {
        return `${proxy_data.proxy.proxyAuth}@${proxy_data.proxy.host}:${proxy_data.proxy.port}`
    } else {
        return `${proxy_data.proxy.host}:${proxy_data.proxy.port}`
    }

}
async function getEmailFVIA({ length, pathFile, type, proxies }) {
    let token = 'af2b556e5e719052ca9193bace296b4fe9015bdc6c2c6ec28447d57c56187941'
    let emails = [];
    let domains = ["fviainboxes.com", "fviadropinbox.com", "fviamail.work", "dropinboxes.com"]
    for (let i = 0; i < length; i++) {
        let domain = domains[Math.floor(Math.random() * domains.length)];
        let username = generateRandomName(getRandomInt(10, 15)) + getRandomInt(111, 999)
        let email = username + '@' + domain;
        emails.push({ email, username, domain, token })
    }
    return emails;
}
async function getMessageFVIA({ email, token, proxy_list = null }) {
    let data_email = email.split('@')
    let username = data_email[0]
    let domain = data_email[1]
    let url = `https://fviainboxes.com/messages?username=${username}&domain=${domain}`
    try {
        let proxy = "";
        if (proxy_list && proxy_list.length) {
            proxy = proxy_list[Math.floor(Math.random() * proxy_list.length)];
        }
        // console.log(url)
        let res = await makeRequest({
            url, headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }, method: "GET", proxy: proxy, proxy_list: proxy_list
        })
        let { body, bodyJson, status, headers, error } = res;
        /**
     * bodyJson = {
    "result": [
        {
            "id": "46d86780-327e-4ecb-ae3c-36153dfc18f4",
            "subject": "236745 is your code",
            "from": "vanthinh291@gmail.com",
            "seenAt": 0
        }
    ]
}
     */
        if (!body) return [];
        let messages = bodyJson.result;
        if (!messages || !messages.length) return [];
        let messages_new = messages.map(i => {
            let { id, from, subject } = i;
            return { id, from, subject }
        })
        return messages_new;

    } catch (e) {
        console.log("error getMessageFVIA", e)
        return []
    }
}
async function getTiktokCodeFVIA({ email, token, proxy_list }) {
    let code = ""
    let current = 0;
    while (current < 5) {
        try {
            let messages = await getMessageFVIA({ email, token, proxy_list })
            if (messages && messages.length) {
                let message = messages[0];
                let { subject } = message;
                // lay so tu string subject
                code = subject.match(/\d+/)[0];
                break;
            }
        } catch (e) {
            console.log("error getTiktokCodeFVIA", e)
        }
        await delay(5000);
        current++;
    }

    return code;
}
async function getEmailINBOXES({ length, pathFile, type, proxies }) {
    let token = 'af2b556e5e719052ca9193bace296b4fe9015bdc6c2c6ec28447d57c56187941'
    let emails = [];
    let domains_data = { "domains": [{ "qdn": "blondmail.com" }, { "qdn": "chapsmail.com" }, { "qdn": "clowmail.com" }, { "qdn": "dropjar.com" }, { "qdn": "fivermail.com" }, { "qdn": "getairmail.com" }, { "qdn": "getmule.com" }, { "qdn": "getnada.com" }, { "qdn": "gimpmail.com" }, { "qdn": "givmail.com" }, { "qdn": "guysmail.com" }, { "qdn": "inboxbear.com" }, { "qdn": "replyloop.com" }, { "qdn": "robot-mail.com" }, { "qdn": "spicysoda.com" }, { "qdn": "tafmail.com" }, { "qdn": "temptami.com" }, { "qdn": "tupmail.com" }, { "qdn": "vomoto.com" }] }

    let domains = domains_data.domains.map(i => i.qdn);
    for (let i = 0; i < length; i++) {
        let domain = domains[Math.floor(Math.random() * domains.length)];
        let username = generateRandomName(getRandomInt(10, 15)) + getRandomInt(111, 999)
        let email = username + '@' + domain;
        let messages = await getMessageINBOXES({ email, token, proxy_list: proxies })
        // console.log("messages",messages)
        emails.push({ email, username, domain, token })
    }
    return emails;
}
async function getMessageINBOXES({ email, token, proxy_list = null }) {
    // let data_email = email.split('@')
    // let username = data_email[0]
    // let domain = data_email[1]
    let url = `https://inboxes.com/api/v2/inbox/${email}`
    try {
        let proxy = "";
        if (proxy_list && proxy_list.length) {
            proxy = proxy_list[Math.floor(Math.random() * proxy_list.length)];
        }
        // console.log(url)
        let res = await makeRequest({
            url, headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }, method: "GET", proxy: proxy, proxy_list: proxy_list
        })
        let { body, bodyJson, status, headers, error } = res;
        /**
     * bodyJson = {
  "msgs": [
    {
      "uid": "O4Z4sXFLhMPln8E7bfipg016P5sDMY",
      "f": "TikTok",
      "s": "444285 là mã xác minh của bạn",
      "d": false,
      "at": [],
      "cr": "2025-09-14T11:01:49.178Z",
      "r": 1757847709,
      "ru": true,
      "ph": "Để xác minh tài khoản của bạn, hãy nh...",
      "rr": "3 mins ago",
      "ib": "tunyge849@robot-mail.com"
    }
  ]
}
     */
        if (!body) return [];
        let messages = bodyJson.msgs;
        if (!messages || !messages.length) return [];
        let messages_new = messages.map(i => {
            let { uid, f, s, d, at, cr, r, ru, ph, rr, ib } = i;
            return { uid, f, s, d, at, cr, r, ru, ph, rr, ib }
        })
        return messages_new;

    } catch (e) {
        console.log("error getMessageINBOXES", e)
        return []
    }
}
async function getTiktokCodeINBOXES({ email, token, proxy_list }) {
    let code = ""
    let current = 0;
    while (current < 10) {
        try {
            let messages = await getMessageINBOXES({ email, token, proxy_list })
            if (messages && messages.length) {
                let message = messages[0];
                let { s } = message;
                // lay so tu string s
                code = s.match(/\d+/)[0];
                break;
            }
        } catch (e) {
            console.log("error getTiktokCodeINBOXES", e)
        }
        await delay(5000);
        current++;
    }

    return code;
}
async function getEmailTemp({ length, pathFile, type, proxies }) {
    let emails = [];
    let proxy_list = proxies || [];
    // dung promise all
    let promises = [];
    for (let i = 0; i < length; i++) {
        promises.push(getEmailTempIO(proxy_list));
    }
    let results = await Promise.all(promises);
    results.forEach(i => {
        if (i) {
            emails.push(i);
        }
    })
    return emails;
}

async function getEmailTempIO(proxy_list = null) {
    let all_domain = `vwhins.com,jxpomup.com,ibolinva.com,wyoxafp.com,osxofulk.com,jkotypc.com,cmhvzylmfc.com,zudpck.com,daouse.com,illubd.com,mkzaso.com,mrotzis.com,xkxkud.com,wnbaldwy.com,bwmyga.com`.split(',')
    all_domain = `zudpck.com,daouse.com,illubd.com,mkzaso.com,mrotzis.com,xkxkud.com,wnbaldwy.com,bwmyga.com`.split(',')
    let email_input = generateRandomName(12) + getRandomInt(111111, 888888).toString() + "@" + all_domain[Math.floor(Math.random() * all_domain.length)];
    return await getEmailTempIOExist(email_input, proxy_list)
    try {
        let proxy = "";
        if (proxy_list && proxy_list.length) {
            proxy = proxy_list[Math.floor(Math.random() * proxy_list.length)];
        }
        let url = `https://api.internal.temp-mail.io/api/v3/email/new`

        let res = await makeRequest({
            url,
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
                "Content-Type": "application/json"
            },
            method: "POST",
            proxy: proxy,
            proxy_list: proxy_list
        })
        let { body, bodyJson, status, headers, error } = res;
        //{"email":"ebpzwdc8sy@wnbaldwy.com","token":"aktXZvXHgLynvfF7VyH4"}
        if (!body) return false;
        let { email, token } = bodyJson;
        return { email, token, status: true }
    } catch (e) {
        console.log("error getEmailTempIO", e)
        return false
    }
}
async function getEmailTempIOExist(email_input, proxy_list = null) {
    try {
        let proxy = "";
        let data_email = email_input.split('@')
        let name_email = data_email[0]
        let domain_email = data_email[1]
        if (proxy_list && proxy_list.length) {
            proxy = proxy_list[Math.floor(Math.random() * proxy_list.length)];
        }
        let url = `https://api.internal.temp-mail.io/api/v3/email/new`
        let data_post = { "name": name_email, "domain": domain_email }
        let res = await makeRequest({
            url,
            headers: {
                "Application-Name": "web",
                "sec-ch-ua-platform": "macOS",
                "Application-Version": "4.0.0",
                "Referer": "https://temp-mail.io/",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
                "Content-Type": "application/json"
            },
            method: "POST",
            body: JSON.stringify(data_post),
            proxy: proxy,
            proxy_list: proxy_list
        })
        let { body, bodyJson, status, headers, error } = res;
        //{"email":"ebpzwdc8sy@wnbaldwy.com","token":"aktXZvXHgLynvfF7VyH4"}
        if (!body) return false;
        let { email, token } = bodyJson;
        return { email, token, status: true }
    } catch (e) {
        console.log("error getEmailTempIOExist", e)
        return false
    }
}
async function getMessageTempIO({ email, token, proxy_list = null }) {

    try {
        let proxy = "";
        if (proxy_list && proxy_list.length) {
            proxy = proxy_list[Math.floor(Math.random() * proxy_list.length)];
        }
        let url = `https://api.internal.temp-mail.io/api/v3/email/${email}/messages`
        // console.log(url)
        let res = await makeRequest({
            url, headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }, method: "GET", proxy: proxy, proxy_list: proxy_list
        })
        let { body, bodyJson, status, headers, error } = res;
        /**
     * bodyJson = [
    {
        "id": "bf80b590-c1ca-433a-8321-be467c5c1037",
        "from": "\"TikTok\" \u003cnoreply@account.tiktok.com\u003e",
        "to": "wwx0pxgwl1@ibolinva.com",
        "cc": null,
        "subject": "642531 là mã xác minh của bạn",
        "body_text": "Mã xác minh\n\nĐể xác minh tài khoản của bạn, hãy nhập mã này vào TikTok:\n\n642531\n\nMã xác minh hết hạn sau 48 giờ.\n\nNếu bạn không yêu cầu mã, bạn có thể bỏ qua tin nhắn này.\n\nNhóm Hỗ trợ TikTok\n\nTrung tâm Trợ giúp TikTok: https://support.tiktok.com/\n\nBạn có câu hỏi?\nHãy xem mục trung tâm trợ giúp hoặc liên hệ với chúng tôi trong ứng dụng bằng cách sử dụng Cài đặt \u003e Báo cáo Vấn đề.\nĐây là email được tạo tự động. Thư trả lời gửi đến địa chỉ email này không được giám sát.\n\nChính sách Quyền riêng tư ( https://www.tiktok.com/en/privacy-policy?lang=vi )\nTikTok, 10100 Venice Bivd, Culver City, CA 90232",
        "body_html": "\u003chtml class=\"vi\"\u003e\n\n\u003chead\u003e\n  \u003cmeta http-equiv=\"Content-Type\" content=\"text/html; charset=UTF-8\"\u003e\n  \u003cmeta name=\"viewport\"\n    content=\"width-device-width,initial-scale=1.0,maximum-scale=1.0, minimum-scale=1.0,user-scalable=no, minimal-ui\"\u003e\n  \u003cstyle\u003e\n    * {\n      margin: 0;\n      font-family: Helvetica;\n      box-sizing: border-box;\n    }\n\n    a {\n      text-decoration: none;\n      background-color: transparent;\n      outline: none;\n      cursor: pointer;\n    }\n\n    html.ar {\n      direction: rtl;\n    }\n\n    html.ar input {\n      text-align: right;\n    }\n  \u003c/style\u003e\n\u003c/head\u003e\n\n\u003cbody style=\"display: flex; justify-content: center;\"\u003e\n  \u003cdiv style=\"width:100%;max-width: 440px; padding: 0 20px;\"\u003e\n    \u003cdiv style=\"width: 100%; padding: 40px 7px;\"\u003e\n      \u003cimg style=\"width: 150px;\"\n        src=\"http://p16-tiktokcdn-com.akamaized.net/obj/tiktok-obj/f70f9d0dc867d6c71ce2cd684a0ffff0\"\n        style=\"margin: 40px 12px 40px 12px; width: 150px; height: 40px;\"\u003e\n    \u003c/div\u003e\n    \u003cdiv\n      style=\"max-width:100%;background-color: #f1f1f1; padding: 20px 16px; font-weight: bold;font-size: 20px;color: rgb(22,24, 35)\"\u003e\n      Mã xác minh\n    \u003c/div\u003e\n    \u003cdiv\n      style=\"max-width:100%;background-color: #f8f8f8; padding: 24px 16px;font-size: 17px;color: rgba(22,24, 35, 0.75);line-height: 20px;\"\u003e\n      \u003cp style=\"margin-bottom:20px;\"\u003eĐể xác minh tài khoản của bạn, hãy nhập mã này vào TikTok:\u003c/p\u003e\n      \u003cp style=\"margin-bottom:20px;color: rgb(22,24,35);font-weight: bold;\"\u003e642531\u003c/p\u003e\n      \u003cp style=\"margin-bottom:20px;\"\u003eMã xác minh hết hạn sau 48 giờ.\u003c/p\u003e\n      \u003cp style=\"margin-bottom:20px;\"\u003eNếu bạn không yêu cầu mã, bạn có thể bỏ qua tin nhắn này.\u003c/p\u003e\n\n      \u003cp\u003eNhóm Hỗ trợ TikTok\u003c/p\u003e\n      \u003cp style=\"word-break: break-all;\"\u003e\n        Trung tâm Trợ giúp TikTok: \n        \u003ca style=\"color: rgb(0, 91, 158);\" href=\"https://support.tiktok.com/\"\u003ehttps://support.tiktok.com/\u003c/a\u003e\n      \u003c/p\u003e\n    \u003c/div\u003e\n\n    \u003cdiv style=\"max-width:100%;padding: 40px 16px 20px;font-size: 15px;color: rgba(22, 24, 35, 0.5);line-height:18px;\"\u003e\n      \u003cdiv\u003eBạn có câu hỏi?\u003c/div\u003e\n      \u003cdiv style=\"margin-bottom:20px;\"\u003eHãy xem mục trung tâm trợ giúp hoặc liên hệ với chúng tôi trong ứng dụng bằng cách sử dụng\n        \u003cspan style=\"color: rgb(0, 91, 158);font-weight: bold;\"\u003eCài đặt \u0026gt; Báo cáo Vấn đề.\u003c/span\u003e\u003c/div\u003e\n      \u003cdiv\u003eĐây là email được tạo tự động. Thư trả lời gửi đến địa chỉ email này không được giám sát.\u003c/div\u003e\n    \u003c/div\u003e\n    \u003cdiv style=\"border: 0; background-color: rgba(0, 0, 0, 0.12); height: 1px;margin-bottom:16px;\"\u003e\u003c/div\u003e\n    \u003cdiv style=\"color: rgba(22, 24, 35, 0.5); margin: 20px 16px 40px 16px;font-size: 12px;line-height:18px;\"\u003e\n      \u003cdiv style=\"word-break: break-all;\"\u003e\n        \u003ca style=\"color: rgba(22, 24, 35, 0.5);text-decoration:underline;\"\n          href=\"https://www.tiktok.com/en/privacy-policy?lang=vi\"\u003eChính sách Quyền riêng tư\n        \u003c/a\u003e\n      \u003c/div\u003e\n      \u003cdiv\u003eTikTok, 10100 Venice Bivd, Culver City, CA 90232\u003c/div\u003e\n    \u003c/div\u003e\n  \u003c/div\u003e\n  \u003c/div\u003e\n\u003cimg src=\"http://url7709.account.tiktok.com/wf/open?upn=u001.Tmk6aTS-2B7KoyOfOJyjlmlA6IJA1GE6Lb3a1v86GeasKdxPtoKsqRVKDzSIsxDkJA-2F-2FrQKZdhmPYdlNbFTsNd4GWUHxDbwyArU-2Bcvj7jHLiuv6grhp2RWRHZfxqU8d2VVDk392ji09-2F8VF7hgoDrARdlEzq8uQK4pNe-2Frnnlouorzs1RVDj56tp4JZcNKteI46G9tWmydtOOTrdqmLqqbGDRQmsLgYRbH8Jya43jL90duc0cFYhCNKeih5nc1x8SMusJUjfmldflr-2BJSW-2BfGtMp9imowQsNno5LuZ7TStvuYuQfPPGOJp9BymroeElOZ3FN-2B02GwmrX5DPlPmA8VcshUQeP3UcPZWkvzXzeLGqxgxKgn1k4Z7x6Z3MEx3OlQuknYLG1PGqlj8hJDSGciAlA-3D-3D\" alt=\"\" width=\"1\" height=\"1\" border=\"0\" style=\"height:1px !important;width:1px !important;border-width:0 !important;margin-top:0 !important;margin-bottom:0 !important;margin-right:0 !important;margin-left:0 !important;padding-top:0 !important;padding-bottom:0 !important;padding-right:0 !important;padding-left:0 !important;\"/\u003e\u003c/body\u003e\n\n\u003c/html\u003e\n",
        "created_at": "2025-08-15T08:47:52.909773Z",
        "attachments": []
    }
]
     */
        if (!body) return [];
        let messages = bodyJson;
        if (!messages || !messages.length) return [];
        let messages_new = messages.map(i => {
            let { id, from, to, cc, subject, body_text, body_html, created_at, attachments } = i;
            return { id, from, to, cc, subject, created_at, attachments }
        })
        return messages_new;

    } catch (e) {
        console.log("error getMessageTempIO", e)
        return []
    }
}
async function getTiktokCodeTempIO({ email, token, proxy_list }) {
    let code = ""
    let current = 0;
    while (current < 7) {
        try {
            let messages = await getMessageTempIO({ email, token, proxy_list })
            if (messages && messages.length) {
                let message = messages[0];
                let { subject } = message;
                // lay so tu string subject
                code = subject.match(/\d+/)[0];
                break;
            }
        } catch (e) {
            console.log("error getTiktokCodeTempIO", e)
        }
        await delay(5000);
        current++;
    }

    return code;
}
async function getHotMails({ length, emails }) {
    try {
        emails = emails || [];
        let thread = 3;
        let total_reg = length - emails.length;

        let results = await Promise.allSettled(Array.from({ length: total_reg < thread ? total_reg : thread }).map(async (i, index) =>
            await (new Outlook(null, null, true, { key: "35edc9e0f05741409ac9c93329bef25c296839", thread: index + 1 }).register()
            )))
        results.forEach(i => {
            if (i.value && i.value.email) emails.push(i.value)
        })
        console.log("getHotMails", emails)
        if (emails.length == length) return emails
        return getHotMails({ length, emails })

    } catch (e) {
        console.log("error getHotMails", e)
        return []
    }

}
async function lastStartGologin(is_success) {
    // if failed, w
    let data_save = {}
    let minutes = 1;
    const path_file = path.resolve("./info_start_gologin.txt");
    if (fs.existsSync(path_file)) {
        const data = await strData(path_file);
        if (data) {
            const data_json = JSON.parse(data);
            // if(data_json.time && data_json.time && Date.now() - data_json.time < minutes*60*1000){
            //     return data_json.time;
            // }
            data_save.time = data_json.time
        }
    }
    if (is_success || JSON.stringify(data_save) == "{}") {
        data_save.time = Date.now();
        data_save.is_running = true
        await writeFile({ data: JSON.stringify(data_save), path: path_file });
    } else {
        if (data_save.time && Date.now() - data_save.time > minutes * 60 * 1000) {
            data_save.is_running = false
        } else {
            data_save.is_running = true
        }
    }
    if (data_save.time) {
        data_save.last = Math.floor((Date.now() - data_save.time) / 1000 / 60)
    }
    // data_save.time_str = (new Date(data_save.time)).toISOString()
    return data_save
}
async function checkCookieLive({ cookie_string, proxy, proxy_list }) {
    // console.log(proxy, proxy_list)
    let verifyFp = getString(cookie_string.replace(/ /g, '') + ';', 'verifyFp=', ';') || getString(cookie_string.replace(/ /g, '') + ';', 's_v_web_id=', ';')
    const options = {
        retryTime: 3,

        url: `https://www.tiktok.com/passport/web/account/info/?WebIdLastTime=1742631163&aid=1459&app_language=en&app_name=tiktok_web&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=MacIntel&browser_version=5.0%20%28Macintosh%3B%20Intel%20Mac%20OS%20X%2010_15_7%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F134.0.0.0%20Safari%2F537.36&channel=tiktok_web&cookie_enabled=true&data_collection_enabled=true&device_id=&device_platform=web_pc&focus_state=true&from_page=user&history_len=5&is_fullscreen=false&is_page_visible=true&odinId=&os=mac&priority_region=VN&referer=https%3A%2F%2Fwww.tiktok.com%2Flive&region=VN&root_referer=https%3A%2F%2Fwww.tiktok.com%2Flive&screen_height=1117&screen_width=1728&tz_name=Asia%2FSaigon&user_is_login=true&verifyFp=${verifyFp}&webcast_language=en`,
        method: 'GET',
        headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
            cookie: cookie_string
        },
        proxy,
        preCheckRetry: (body, json) => {
            return !body.includes('"user_id"');

        },
        proxy_list: proxy_list
    }
    let res = await makeRequest(options)
    let { body, bodyJson, status, headers, error } = res;
    if (!body) {
        return { status: false }
    } else if (body.includes('"user_id"')) {
        return { status: true, live: true, body }
    } else if (body.includes("session_expired")) {
        // console.log(username,body, proxy, cookie_string)
        return { status: true, live: false, body }
    }
}
function generateRandomPassword(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_';
    let password = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        password += characters.charAt(randomIndex);
    }
    return password;
}
function generateRandomDOB() {
    const year = getRandomInt(1981, 2004).toString();
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
function getString(test_str, text_begin, text_end) {
    if (!test_str || test_str == "") {
        return '';
    }
    var start_pos = test_str.toString().indexOf(text_begin);
    if (start_pos < 0) {
        return '';
    }
    start_pos += text_begin.length;
    var end_pos = test_str.indexOf(text_end, start_pos);
    var text_to_get = test_str.substring(start_pos, end_pos);
    return text_to_get;
}
/**
* parserAccounts
* @param {{acc_string:string| [string],number_slice, getIndex, number_ignore,key,format,key_format, item_return_type}} options 
* @return [Account]
* @description 
*  item_return_type: +obejct then return obejct Account, + key_in_format then return value of key
*/
function parserAccounts({ acc_string, number_slice, getIndex, number_ignore, key, format, key_format, item_return_type, preReturn }) {
    format = format || "username|temp1|temp2|temp3|cookie_string"
    key_format = key_format || "|"
    item_return_type = item_return_type || "object"
    let accounts = typeof acc_string == "string" ? (acc_string.split(key || "\n")) : acc_string;


    let array_return = []

    for (let index = 0; index < accounts.length; index++) {
        let i = accounts[index]
        let item = {};
        if (typeof i == "string") {
            let arr = i.split(key_format);
            let keys = format.split(key_format);


            for (let i = 0; i < keys.length; i++) {
                item[keys[i]] = arr[i]
            }
        } else {
            item = i;
        }

        let is_pass = true;
        if (preReturn) {
            try {
                is_pass = preReturn(item, item[item_return_type], i)

            } catch (e) {
                console.log("error", e)
            }
        }
        if (is_pass)
            array_return.push(item_return_type == "object" ? item : item[item_return_type])
    }
    if (number_ignore) {
        let [sub, remain] = subArray(array_return, number_ignore)
        array_return = remain
    }
    let spliced_array = [array_return];
    if (number_slice || number_slice > 0) {
        spliced_array = splice(array_return, number_slice)
    } else {
        getIndex = 0
    }

    if (!spliced_array || !spliced_array.length) return [];
    if (getIndex > (spliced_array.length - 1)) return []
    return spliced_array[getIndex]

}
function subArray(array, length) {
    return [(splice(array, length))[0], array.slice(length)]
}
function splice(array, max) {
    var splitCookies = [].concat.apply([],
        array.map(function (elem, i) {
            return i % max ? [] : [array.slice(i, i + max)];
        })
    );
    return splitCookies
}
async function appendFile({ path, data }) {
    return await new Promise((r) => {
        try {
            fs.appendFile(path, data, error => r(error ? false : true))
        } catch (error) {
            console.log("appendFile error", error)
        }
    })
}
async function writeFile({ path, data }) {
    return await new Promise((r) => {
        try {
            fs.writeFile(path, data, error => r(error ? false : true))
        } catch (error) {
            console.log("writeFile error", error)
        }
    })
}
async function getAgentVer() {
    try {
        let str = await strData(path.resolve("./agent_version.txt"));
        if (!str || str.trim() == "undefined") {
            str = `132.0.6834.83
129.0.6668.101
130.0.6723.69
137.0.7151.56
131.0.6778.86
133.0.6943.54
134.0.6998.36
128.0.6613.36
127.0.6533.73
`.trim()
            await writeFile({ path: path.resolve("./agent_version.txt"), data: str })
        }
        let vers = str.split("\n");
        let [ver] = vers.map(i => i.trim()).filter(i => i);
        if (!ver) throw new Error("No ver")
        return ver
    } catch (e) {
        console.log(e)
        return "127.0.6533.73"
    }
}
async function setBadUseragent(user_agent) {
    try {
        console.log("setBadUseragent", user_agent)
        let platform = user_agent.includes("Mac") ? "mac" : user_agent.includes("Windows") ? "win" : "lin";
        //ver is like 138.0.8271.89
        let ver = user_agent.match(/Chrome\/([\d.]+)/)[1];
        let str = await strData(path.resolve("./bad_useragent.txt"));
        if (!str) {
            str = "{}"
        }
        // {"mac":[{"ver":"127.0.3242.1","time_bad":1726790400000,"time_bad_str":"2024-09-16 00:00:00"}],"win":[{"ver":"127.0.3242.1","time_bad":1726790400000,"time_bad_str":"2024-09-16 00:00:00"}]}
        // if ver in platform is not in str, add it, if in str, update time_bad,time_bad_str
        let data_json = JSON.parse(str);
        if (!data_json[platform]) {
            data_json[platform] = []
        }
        if (!data_json[platform].find(i => i.ver == ver)) {
            data_json[platform].push({ ver, time_bad: Date.now(), time_bad_str: new Date().toLocaleString() })
        } else {
            data_json[platform].find(i => i.ver == ver).time_bad = Date.now()
            data_json[platform].find(i => i.ver == ver).time_bad_str = new Date().toLocaleString()
        }
        await writeFile({ path: path.resolve("./bad_useragent.txt"), data: JSON.stringify(data_json) })
        return data_json
    } catch (e) {
        console.log("error setBadUseragent", e)
        return {}
    }
}
function getGoodUserAgentDefault() {
    let list_ver = `
139.0.7258.127
138.0.7204.50`.trim().split('\n')
    let platforms = ["mac", "lin", "win"]
    let ver = list_ver[Math.floor(Math.random() * list_ver.length)]
    let platform = platforms[Math.floor(Math.random() * platforms.length)]
    let user_agent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ver} Safari/537.36`;
    if (platform == 'lin') {
        user_agent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ver} Safari/537.36`;
    }
    if (platform == 'win') {
        user_agent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ver} Safari/537.36`;
    }
    if (platform == 'android') {
        user_agent = `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ver} Safari/537.36`;
    }
    return { ver, platform, user_agent }
}
function getGoodUserAgent(time_bad_greater_than) {
    //time_bad_greater_than is minutes (like 5) i want to get if time_bad is spent 5 minutes from now
    let list_ver = `
131.0.6778.86
133.0.6943.54
134.0.6998.36
128.0.6613.36
127.0.6533.73
135.0.7049.41
132.0.6834.83
129.0.6668.101
130.0.6723.69`.trim().split('\n')
    // list_ver = `
    // 126.0.6533.73
    // 135.0.7049.41`.trim().split('\n')
    let platforms = ["mac", "lin", "win"]
    // platforms = ["win"]
    // random ver and platform from list_ver and platforms, it not in "./bad_useragent.txt" or in "./bad_useragent.txt" but time_bad_greater_than is greater than time_bad
    let data_json = getBadUseragent();
    let good_user_agent = null;
    let current = 0;
    let max_try = list_ver.length * platforms.length;
    while (!good_user_agent && current < max_try) {
        current++;
        let platform = platforms[Math.floor(Math.random() * platforms.length)]
        let ver = list_ver[Math.floor(Math.random() * list_ver.length)]
        //replace like 127.0.6533.73 to 127.0.0.0 or 130.0.6723.69 to 130.0.0.0
        let ver_check = normalizeVersion(ver)
        // console.log("ver_check",ver_check)
        // console.log("platform",platform)
        // console.log("data_json",data_json)
        if (!data_json[platform]) {
            good_user_agent = { ver, platform }
        } else if (!data_json[platform].find(i => i.ver == ver_check)) {
            good_user_agent = { ver, platform }
        } else {
            if (Date.now() - data_json[platform].find(i => i.ver == ver_check).time_bad > time_bad_greater_than * 60 * 1000) {
                good_user_agent = { ver, platform }
            }


        }
    }
    if (!good_user_agent) {
        return getGoodUserAgentDefault()
    }
    let user_agent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${good_user_agent.ver} Safari/537.36`;
    if (good_user_agent.platform == 'lin') {
        user_agent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${good_user_agent.ver} Safari/537.36`;
    }
    if (good_user_agent.platform == 'win') {
        user_agent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${good_user_agent.ver} Safari/537.36`;
    }
    if (good_user_agent.platform == 'android') {
        user_agent = `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${good_user_agent.ver} Safari/537.36`;
    }
    return { ver: good_user_agent.ver, user_agent, platform: good_user_agent.platform }
}
function normalizeVersion(ver) {
    // Tách theo dấu chấm
    let parts = ver.split(".");
    if (parts.length < 2) return ver; // không hợp lệ thì trả lại như cũ
    return `${parts[0]}.${parts[1]}.0.0`;
}
function getBadUseragent() {
    try {
        if (!fs.existsSync(path.resolve("./bad_useragent.txt"))) {
            return {}
        }
        let str = fs.readFileSync(path.resolve("./bad_useragent.txt"), "utf8");
        // let str = await strData(path.resolve("./bad_useragent.txt"));
        if (!str) {
            str = "{}"
        }
        return JSON.parse(str);
    } catch (e) {
        console.log("error getBadUseragent", e)
        //write async
        fs.writeFileSync(path.resolve("./bad_useragent.txt"), "{}")
        return {}
    }
}
async function changeAgentVer(current_ver) {
    try {
        let url = `http://217.15.163.20:8549/api/cron/changevertiktok?current_ver=${current_ver}`
        let res = await makeRequest({ url, method: "GET" })
    } catch (e) {
        console.log("error changeAgentVer", e)
    }
    try {
        let str = await strData(path.resolve("./agent_version.txt"));

        let vers = str.trim().split("\n");
        if (current_ver) {
            try {
                //current_ver is 134.0.0.0, vers[0] is 134.123.12.73, check if same 134 then return
                if (current_ver.split(".")[0] !== vers[0].split(".")[0]) {
                    return
                }
            } catch (e) {
                console.log("changeAgentVer", e)
            }
        }
        let [ver, ...others] = vers.map(i => i.trim()).filter(i => i);
        let new_data = "";
        others.push(ver)
        others.map(i => new_data += `${i}\n`);
        await writeFile({ path: path.resolve("./agent_version.txt"), data: new_data })
        console.log("Changed agent version", path.resolve("./agent_version.txt"))
    } catch (e) {
        console.log("error change agent", e)
    }
}

function randomSample(arr, n) {
    let result = [];
    let clonedArr = [...arr];  // Clone the array to avoid modifying the original

    for (let i = 0; i < n; i++) {
        let index = Math.floor(Math.random() * clonedArr.length);
        result.push(clonedArr.splice(index, 1)[0]);  // Remove and add to result
    }

    return result;
}
async function killAllOrbita() {
    // if ubuntu or linux
    if (os_type == "Linux") {
        await runCmd("pkill -f 'Orbita'")
        await runCmd("pkill -9 -f Orbita")
        await runCmd("pkill -f 'orbita'")
        await runCmd("pkill -9 -f 'orbita'")
    } else {
        // await runCmd("pkill -f 'Orbita'")
        await runCmd("pkill -9 -f Orbita")
        // await runCmd("pkill -f 'orbita'")
        await runCmd("pkill -9 -f 'orbita'")
    }

    // console.log(res)
}
async function getIpAddress() {
    let path_file = path.resolve("./ip_address.txt")
    let ip_address = ""
    //check path_file, if time less than 1 hour, return ip_address
    if (fs.existsSync(path_file)) {
        let data = await strData(path_file)
        if (data) {
            let data_json = JSON.parse(data)
            if (data_json.time && Date.now() - data_json.time < 10 * 60 * 1000) {
                return data_json.ip
            }
        }
    }
    try {
        let res = await makeRequest({
            "url": "https://ipv4.jsonip.com/",
            "body": null,
            "method": "GET",
            "timeout": 30000
        });
        ip_address = res.bodyJson.ip
        if (!ip_address) {
            res = await makeRequest({
                "url": "https://ifconfig.me/all.json",
                "body": null,
                "method": "GET",
                "timeout": 30000
            });
            ip_address = res.bodyJson.ip_addr
        }

        if (!ip_address) {
            res = await makeRequest({
                "url": "https://ipinfo.io/json",
                "body": null,
                "method": "GET",
                "timeout": 30000
            });
            ip_address = res.bodyJson.ip
        }
    } catch (e) { }
    if (ip_address) {
        //save to file
        await writeFile({ path: path_file, data: `{"ip": "${ip_address}","time": "${Date.now()}"}` })
    }
    return ip_address
}
let helper = { humanMouseMove, humanClick, humanType, startDeeplink, lastStartGologin, moveRemoveAccount, getCookies, getCookiesRepair, getMstokenLike, getMstokenLikeLive, countCate, likeVideo, getAccountLogout, getAccountLogout2, getEmailFileUnlimitGmailEduMail3979, getEmailGmailEdu, deleteEmailEdu, setBadUseragent, getBadUseragent, getGoodUserAgent, getGoodUserAgentDefault, checkUserExist, getEmailINBOXES, getMessageINBOXES, getTiktokCodeINBOXES, getEmailFVIA, getMessageFVIA, getTiktokCodeFVIA, stopGoLogin, startGoLogin, getConfigSite, buildSetUsernameUrlJSON, setCreateUsername, buildUpdateProfileUrlJSON, buildUpdateProfileUrl, buildUploadImageUrlJSON, buildUserDetailUrlJSON, ensureGoLoginRunning, checkandopenGologin, closeAllOrbita, updateProfile, uploadImage, killAllOrbita, getRoomId3, getRoomUser, checkInToRoom, checkCookieLive, getEmailTempIO, getMessageTempIO, getTiktokCodeTempIO, getProxySite, randomSample, getInfo, clickSelector, clickXpath, actionBeforeCapcha, checkFunction, delay, getFile, getRandomInt, parserProxyString, makeRequest, getEmail, getString, writeFile, appendFile, parserAccounts, getAgentVer, changeAgentVer, runCmd, formatPath, formatUrlWindow, strData, getEmailFileUnlimitEdu, getEmailTemp, getEmailTempIOExist, getIpAddress }

export { humanMouseMove, humanClick, humanType, startDeeplink, lastStartGologin, moveRemoveAccount, getCookies, getCookiesRepair, getMstokenLike, getMstokenLikeLive, countCate, likeVideo, getAccountLogout, getAccountLogout2, getEmailFileUnlimitGmailEduMail3979, getEmailGmailEdu, deleteEmailEdu, setBadUseragent, getBadUseragent, getGoodUserAgent, getGoodUserAgentDefault, checkUserExist, getEmailINBOXES, getMessageINBOXES, getTiktokCodeINBOXES, getEmailFVIA, getMessageFVIA, getTiktokCodeFVIA, stopGoLogin, startGoLogin, getConfigSite, buildSetUsernameUrlJSON, setCreateUsername, buildUpdateProfileUrlJSON, buildUpdateProfileUrl, buildUploadImageUrlJSON, buildUserDetailUrlJSON, ensureGoLoginRunning, checkandopenGologin, closeAllOrbita, updateProfile, uploadImage, killAllOrbita, getRoomId3, getRoomUser, checkInToRoom, checkCookieLive, getEmailTempIO, getMessageTempIO, getTiktokCodeTempIO, getProxySite, randomSample, getInfo, clickSelector, clickXpath, actionBeforeCapcha, checkFunction, delay, getFile, getRandomInt, parserProxyString, makeRequest, getEmail, getString, writeFile, appendFile, parserAccounts, getAgentVer, changeAgentVer, runCmd, formatPath, formatUrlWindow, strData, getEmailFileUnlimitEdu, getEmailTemp, getEmailTempIOExist, getIpAddress }
export default helper


