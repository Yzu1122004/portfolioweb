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
const SHEET_NAME = "測試";

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = JSON.parse(e.postData.contents);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map((header) => data[header] || "");

  sheet.appendRow(row);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
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
