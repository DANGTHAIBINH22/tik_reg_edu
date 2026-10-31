import querystring from "querystring"
import os from "os"
import request from "request"
function signreq(options) {
    let {url, bodyEncoded, msToken, userAgent} = options;
    // const SERVER_URL = 'http://localhost:4000/api/xbogus';
    const SERVER_URL = 'http://sign.amazingcpanel.com/api/xbogus';
  return new Promise((resolve, reject) => {
    // Chuẩn bị dữ liệu request
    const requestData = {
      url: url,
      bodyEncoded: bodyEncoded,
      msToken: msToken,
      userAgent: userAgent
    };

    // Gửi request để lấy signature
    request({
      method: 'POST',
      url: `${SERVER_URL}`,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    }, (error, response, body) => {
      if (error) {
        console.error("Lỗi khi lấy signature:", error);
        reject(error);
        return;
      }
      
      try {
        const data = JSON.parse(body);
        resolve(data);
      } catch (err) {
        console.error("Lỗi khi parse response:", err);
        reject(err);
      }
    });
  });
}
export default signreq