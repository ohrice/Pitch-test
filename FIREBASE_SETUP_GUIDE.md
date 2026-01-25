# Firebase 設定指南

## 步驟 1：建立 Firebase 專案

1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 點擊「新增專案」或「Add project」
3. 輸入專案名稱：`JG-Music-Platform`（或你喜歡的名稱）
4. 不需要啟用 Google Analytics（可選）
5. 點擊「建立專案」

## 步驟 2：註冊網頁應用程式

1. 在專案總覽頁面，點擊「網頁」圖示 `</>`
2. 輸入應用程式暱稱：`JG Music Platform`
3. **不要勾選** Firebase Hosting（我們使用 GitHub Pages）
4. 點擊「註冊應用程式」
5. **重要**：複製顯示的 Firebase 設定程式碼，稍後會用到

設定程式碼範例：
```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## 步驟 3：啟用 Firebase Storage

1. 在左側選單點擊「Storage」
2. 點擊「開始使用」
3. 選擇「以測試模式啟動」（稍後會改成安全規則）
4. 選擇儲存位置：`asia-east1`（台灣）或 `asia-northeast1`（日本）
5. 點擊「完成」

## 步驟 4：啟用 Firestore Database

1. 在左側選單點擊「Firestore Database」
2. 點擊「建立資料庫」
3. 選擇「以測試模式啟動」
4. 選擇位置：與 Storage 相同（建議 `asia-east1`）
5. 點擊「啟用」

## 步驟 5：啟用 Authentication（驗證）

1. 在左側選單點擊「Authentication」
2. 點擊「開始使用」
3. 選擇「電子郵件/密碼」登入方式
4. 啟用「電子郵件/密碼」
5. 點擊「儲存」

## 步驟 6：建立管理員帳號

1. 在 Authentication 頁面，點擊「Users」標籤
2. 點擊「新增使用者」
3. 輸入你的電子郵件和密碼（這將是管理員帳號）
4. 點擊「新增使用者」
5. **記下這組帳號密碼**，上傳歌曲時會用到

## 步驟 7：設定安全規則

### Storage 規則
1. 前往 Storage → Rules 標籤
2. 貼上以下規則（允許所有人讀取，只有登入者可寫入）：

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /songs/{allPaths=**} {
      allow read: if true;  // 所有人可讀取
      allow write: if request.auth != null;  // 只有登入者可上傳
    }
  }
}
```

3. 點擊「發布」

### Firestore 規則
1. 前往 Firestore Database → Rules 標籤
2. 貼上以下規則：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /songs/{songId} {
      allow read: if true;  // 所有人可讀取
      allow create, update, delete: if request.auth != null;  // 只有登入者可修改
    }
  }
}
```

3. 點擊「發布」

## 步驟 8：複製 Firebase 設定

從步驟 2 複製的 `firebaseConfig` 物件，等等需要貼到 `firebase-config.js` 檔案中。

---

## 完成！

現在你的 Firebase 專案已經設定完成。接下來我會幫你：
1. 建立 `firebase-config.js`（你需要把上面的設定貼進去）
2. 修改網站程式碼以使用 Firebase
3. 部署到 GitHub Pages

## 費用說明

Firebase 免費方案（Spark Plan）包含：
- **Storage**：5 GB 儲存空間
- **下載**：每月 1 GB
- **Firestore**：每日 50,000 次讀取、20,000 次寫入

對於長者音樂平台來說，免費方案綽綽有餘！

假設：
- 每首歌約 3 MB（MIDI + 伴奏）
- 可儲存約 1,600 首歌曲
- 每月可支援約 333 次歌曲下載

---

**請完成以上步驟後告訴我，我會繼續協助你修改程式碼！**
