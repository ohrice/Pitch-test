# 部署到 GitHub Pages 指南

## 前置準備

完成以下步驟後才能部署：

1. ✅ 已完成 `FIREBASE_SETUP_GUIDE.md` 中的所有 Firebase 設定
2. ✅ 已從 Firebase Console 取得 `firebaseConfig` 設定
3. ✅ 已建立管理員帳號

---

## 步驟 1：修改 firebase-config.js

1. 開啟 `firebase-config.js` 檔案
2. 找到以下區塊：

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

3. **替換成你自己的 Firebase 設定**（從 Firebase Console 複製）
4. 儲存檔案

---

## 步驟 2：建立 GitHub Repository

### 如果你還沒有 GitHub 帳號：
1. 前往 [github.com](https://github.com)
2. 點擊右上角「Sign up」註冊帳號
3. 使用你的電子郵件註冊

### 建立新的 Repository：
1. 登入 GitHub
2. 點擊右上角的 `+` → `New repository`
3. 填寫以下資訊：
   - **Repository name**: `Pitch-test`（必須與你想要的 URL 一致）
   - **Description**: `JG 音樂平台 - 音準測試系統`
   - **Public** （必須選 Public 才能使用 GitHub Pages）
   - **不要勾選** "Add a README file"
4. 點擊「Create repository」

---

## 步驟 3：上傳檔案到 GitHub

### 方法 A：使用網頁介面（簡單）

1. 在新建立的 repository 頁面，點擊「uploading an existing file」
2. 將 `G:\JG\` 資料夾中的所有檔案拖曳到上傳區域：
   - `index.html`
   - `upload.html`
   - `app.js`
   - `firebase-config.js`（已修改過的版本）
   - `firebase-db.js`
   - `pitch-test-engine.js`
   - `README.md`
   - **注意：不要上傳 `db.js`（舊版 IndexedDB，已不需要）**

3. 在底部的 "Commit changes" 區塊：
   - Commit message: `Initial commit - JG Music Platform with Firebase`
4. 點擊「Commit changes」

### 方法 B：使用 Git 指令（進階）

如果你熟悉 Git，可以使用以下指令：

```bash
cd G:\JG
git init
git add index.html upload.html app.js firebase-config.js firebase-db.js pitch-test-engine.js README.md FIREBASE_SETUP_GUIDE.md DEPLOYMENT_GUIDE.md
git commit -m "Initial commit - JG Music Platform with Firebase"
git branch -M main
git remote add origin https://github.com/ohrice/Pitch-test.git
git push -u origin main
```

---

## 步驟 4：啟用 GitHub Pages

1. 在 repository 頁面，點擊上方的「Settings」
2. 在左側選單找到「Pages」
3. 在「Source」區塊：
   - Branch: 選擇 `main`
   - Folder: 選擇 `/ (root)`
4. 點擊「Save」

稍等 1-2 分鐘，GitHub 會自動建置你的網站。

---

## 步驟 5：驗證部署

1. 回到「Settings」→「Pages」頁面
2. 你會看到：
   ```
   Your site is live at https://ohrice.github.io/Pitch-test/
   ```

3. 點擊連結，檢查網站是否正常運作

### 預期結果：
- ✅ 能看到歌曲列表頁面（一開始沒有歌曲是正常的）
- ✅ 搜尋列正常顯示
- ✅ 可以看到「新增歌曲」按鈕（只有登入後才會顯示）

---

## 步驟 6：測試上傳功能

1. 點擊「新增歌曲」按鈕
2. 應該會看到登入表單
3. 輸入你在 Firebase 建立的管理員帳號：
   - 電子郵件：你的管理員 email
   - 密碼：你設定的密碼
4. 點擊「登入」

### 如果登入成功：
- 會自動切換到上傳表單
- 可以上傳 MIDI 和伴奏檔案
- 上傳後會儲存到 Firebase

### 如果登入失敗：
檢查以下項目：
- ❌ Firebase 設定是否正確（firebase-config.js）
- ❌ Firebase Authentication 是否已啟用
- ❌ 管理員帳號是否已建立
- ❌ 電子郵件和密碼是否正確
- ❌ 打開瀏覽器的開發者工具（F12）查看 Console 錯誤訊息

---

## 步驟 7：測試長者使用情境

### 管理員（你）：
1. 登入 → 上傳幾首測試歌曲

### 長者使用者：
1. 開啟網址：`https://ohrice.github.io/Pitch-test/`
2. 應該能直接看到你上傳的歌曲
3. 點擊歌曲 → 開始測試
4. **不需要登入、不需要上傳**

---

## 常見問題

### Q1：網站顯示 404 Not Found
**A**：GitHub Pages 需要 1-2 分鐘建置，請稍等再重新整理。如果超過 5 分鐘仍顯示 404，檢查：
- Settings → Pages 是否已啟用
- Branch 是否選擇正確（main）
- 檔案是否已成功上傳到 repository

### Q2：登入時顯示「找不到此使用者」
**A**：請確認：
1. Firebase Authentication 已啟用「電子郵件/密碼」登入方式
2. 已在 Firebase Console → Authentication → Users 新增使用者
3. 輸入的電子郵件與 Firebase 中的完全一致

### Q3：上傳歌曲後，其他人看不到
**A**：請確認：
1. Firebase Storage 和 Firestore 的安全規則是否正確設定（參考 FIREBASE_SETUP_GUIDE.md）
2. 檢查 Firestore Database 中是否有 `songs` collection
3. 打開瀏覽器開發者工具（F12）→ Network 標籤，查看是否有 CORS 錯誤

### Q4：修改程式碼後，網站沒有更新
**A**：
1. 確認已將修改過的檔案上傳到 GitHub
2. 清除瀏覽器快取（Ctrl + Shift + R 強制重新整理）
3. GitHub Pages 可能需要 1-2 分鐘更新

### Q5：想要修改 Firebase 設定
**A**：
1. 修改 `firebase-config.js`
2. 將修改後的檔案重新上傳到 GitHub（可以直接在網頁上編輯）
3. 等待 1-2 分鐘讓 GitHub Pages 更新

---

## 更新網站內容

### 新增或修改歌曲：
- 直接前往網站，使用管理員帳號登入後上傳
- 無需重新部署

### 修改程式碼或介面：
1. 在本機修改檔案
2. 上傳到 GitHub（可使用網頁介面或 Git 指令）
3. GitHub Pages 會自動更新（1-2 分鐘）

---

## 網站 URL

- **主頁面**：https://ohrice.github.io/Pitch-test/
- **上傳頁面**：https://ohrice.github.io/Pitch-test/upload.html

將主頁面 URL 分享給長者使用即可！

---

## 備註：安全性建議

### ⚠️ 重要：不要將管理員密碼分享給長者

管理員帳號只有你自己使用，用來上傳歌曲。長者使用者：
- ✅ 只需開啟網址
- ✅ 不需要登入
- ✅ 不需要上傳
- ✅ 直接選歌唱歌即可

如果不小心將 `firebase-config.js` 的內容洩露，不用擔心：
- ✅ Firebase 安全規則已設定好（讀取公開、寫入需登入）
- ✅ 只有知道管理員密碼的人才能上傳歌曲
- ✅ 其他人只能檢視歌曲列表

---

## 支援

如有任何問題，請檢查：
1. Firebase Console 的 Firestore 和 Storage 是否有資料
2. 瀏覽器開發者工具的 Console 錯誤訊息
3. Firebase Console 的 Usage 頁面查看是否超過免費額度

祝你部署順利！🎉
