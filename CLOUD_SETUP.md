# Cloud setup

作品要在不同電腦都看得到，資料必須寫進雲端資料表，而不是只存在瀏覽器 `localStorage`。

## Current flow

- 公開頁、管理頁、作品介紹頁會從 Google Sheet / OpenSheet 讀取作品資料。
- 管理頁送出作品時，會 POST 到 Google Apps Script。
- `localStorage` 只作為雲端失敗時的暫存備援。

## Google Sheet 欄位

試算表第一列請放這些欄位名稱：

```text
id
title
type
category
date
description
detail
role
tools
link
image
```

## Apps Script 範例

將下方程式貼到 Google Apps Script，並把 `SHEET_NAME` 改成你的工作表名稱。

```js
const SHEET_NAME = "測試"; // 請確保與你試算表左下角分頁名稱一模一樣

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ 
    status: "success", 
    message: "Google Apps Script 連線成功！" 
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error("找不到工作表：" + SHEET_NAME);
    
    // 解析前端傳來的 JSON 字串
    const data = JSON.parse(e.postData.contents);
    
    // 自動對應第一列的欄位名稱 (id, title, type 等)
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = headers.map((header) => data[header] || "");

    // 寫入試算表
    sheet.appendRow(row);

    // 關鍵：成功時回傳正確的 JSON 格式
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, message: "新增成功！" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    // 失敗時也要回傳 JSON，才不會觸發前端的 CORS 阻擋
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

如果前端使用 `mode: "no-cors"`，不要強制設定 `Content-Type: application/json`。目前網站會用純文字 body 送出 JSON，Apps Script 仍可用 `JSON.parse(e.postData.contents)` 解析。

## Deploy

1. 在 Apps Script 點選 `Deploy`。
2. 選擇 `Web app`。
3. `Execute as` 選 `Me`。
4. `Who has access` 選 `Anyone`。
5. 複製 Web app URL，放到 `app.js` 的 `GAS_API_URL`。

## Notes

OpenSheet 有快取，新增作品後其他電腦可能需要 1 到 2 分鐘才看得到。
