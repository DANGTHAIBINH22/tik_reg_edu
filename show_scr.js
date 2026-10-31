import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

const logFilePath = path.resolve( './script.log');

// Hàm để chạy tập lệnh AutoHotkey
export function showWindowsStacked() {
  // Xóa log file cũ
  try{

  if (fs.existsSync(logFilePath)) {
    fs.unlinkSync(logFilePath);
  }
  }catch(e){}

  let path_show_windows_stacked = path.resolve("./show_windows_stacked.ahk")
  const command = `"C:\\Program Files\\AutoHotkey\\AutoHotkey.exe" "${path_show_windows_stacked}"`;
  let child  = exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Stderr: ${stderr}`);
      return;
    }
    setTimeout(()=>{
      child.kill()
    },1000)
    console.log(`Stdout: ${stdout}`);
    
    // Đọc log file
    fs.readFile(logFilePath, 'utf8', (err, data) => {
      if (err) {
        console.error(`Error reading log file: ${err.message}`);
        return;
      }
      console.log(`Log:\n${data}`);
    });
  });
}

// Gọi hàm
// showWindowsStacked();
