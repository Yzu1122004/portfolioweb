# Cloud setup

作品要在不同電腦都看得到，資料必須寫進雲端資料表，而不是只存在瀏覽器 `localStorage`。

## Current flow

- 公開頁、管理頁、作品介紹頁會透過 Google Apps Script 從 Google Sheet 讀取作品資料。
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
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error("找不到工作表：" + SHEET_NAME);

    const values = sheet.getDataRange().getValues();
    const headers = values.shift();
    const rows = values
      .filter((row) => row.some((cell) => cell !== ""))
      .map((row) => {
        const item = {};
        headers.forEach((header, index) => {
          item[header] = row[index] || "";
        });
        return item;
      });

    return ContentService
      .createTextOutput(JSON.stringify(rows))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error("找不到工作表：" + SHEET_NAME);
    
    // 解析前端傳來的 JSON 字串
    const data = JSON.parse(e.postData.contents);
    
    // 自動對應第一列的欄位名稱 (id, title, type 等)
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const idColumnIndex = headers.indexOf("id");
    if (idColumnIndex === -1) throw new Error("第一列缺少 id 欄位");

    const lastRow = sheet.getLastRow();
    let targetRow = -1;

    if (data.id && lastRow > 1) {
      const ids = sheet
        .getRange(2, idColumnIndex + 1, lastRow - 1, 1)
        .getValues()
        .flat()
        .map(String);
      const matchedIndex = ids.findIndex((id) => id === String(data.id));
      if (matchedIndex >= 0) targetRow = matchedIndex + 2;
    }

    if (data.action === "delete") {
      if (targetRow < 0) throw new Error("找不到要刪除的作品 id：" + data.id);
      sheet.deleteRow(targetRow);
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, message: "刪除成功！" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const row = headers.map((header) => data[header] || "");

    // 找到同 id 就更新原列；找不到才新增
    if (targetRow >= 0) {
      sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    // 關鍵：成功時回傳正確的 JSON 格式
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, message: targetRow >= 0 ? "更新成功！" : "新增成功！" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    // 失敗時也要回傳 JSON，才不會觸發前端的 CORS 阻擋
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

目前網站會用 `Content-Type: text/plain` 送出 JSON 字串，Apps Script 可用 `JSON.parse(e.postData.contents)` 解析。不要改回 `no-cors`，否則前端無法判斷同步是否成功。

## Deploy

1. 在 Apps Script 點選 `Deploy`。
2. 選擇 `Web app`。
3. `Execute as` 選 `Me`。
4. `Who has access` 選 `Anyone`。
5. 複製 Web app URL，放到 `app.js` 的 `GAS_API_URL`。

## Notes

每次修改 Apps Script 後都要重新 Deploy，並把最新 Web app URL 放到 `app.js` 的 `GAS_API_URL`。
