# 🚀 快速開始指南

## 立即開始的 3 個步驟

### 步驟 1️⃣：設定 Firebase（30 分鐘）

1. 前往 https://console.firebase.google.com/
2. 建立新專案「JG-Music-Platform」
3. 啟用三個服務：
   - ✅ Storage（儲存音檔）
   - ✅ Firestore Database（儲存歌曲資訊）
   - ✅ Authentication（登入功能）
4. 新增一個管理員使用者（電子郵件 + 密碼）
5. 複製 Firebase 設定（在專案設定中）

**詳細步驟**: 請看 [FIREBASE_SETUP_GUIDE.md](FIREBASE_SETUP_GUIDE.md)

---

### 步驟 2️⃣：填入你的 Firebase 設定（5 分鐘）

1. 開啟 `firebase-config.js`
2. 找到這段：
   ```javascript
   const firebaseConfig = {
       apiKey: "YOUR_API_KEY",
       // ...
   };
   ```
3. 替換成你從 Firebase Console 複製的設定
4. 儲存檔案

---

### 步驟 3️⃣：部署到 GitHub Pages（15 分鐘）

1. 登入 https://github.com
2. 建立新 repository：`Pitch-test`（Public）
3. 上傳以下檔案：
   - ✅ index.html
   - ✅ upload.html
   - ✅ app.js
   - ✅ firebase-config.js **（已填入你的設定）**
   - ✅ firebase-db.js
   - ✅ pitch-test-engine.js
   - ✅ README.md
   - ❌ **不要上傳** db.js（已不需要）

4. 前往 Settings → Pages
5. Source: 選擇 `main` branch
6. 等待 1-2 分鐘
7. 開啟 https://ohrice.github.io/Pitch-test/

**詳細步驟**: 請看 [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

---

## ✅ 測試檢查

部署完成後：

1. **開啟主頁面**
   → https://ohrice.github.io/Pitch-test/
   → 應該看到空的歌曲列表（正常）

2. **點擊「新增歌曲」**
   → 應該進入登入畫面

3. **登入**
   → 輸入你在 Firebase 建立的管理員帳號
   → 應該看到上傳表單

4. **上傳測試歌曲**
   → 選擇 MIDI 檔 + 伴奏檔
   → 點擊「儲存歌曲」
   → 應該顯示「儲存成功」

5. **返回主頁面**
   → 應該看到剛上傳的歌曲

6. **分享給朋友測試**
   → 他們應該能看到你上傳的歌曲
   → 不需要登入
   → 可以直接點擊測試

---

## 📱 給長者使用者的說明

### 你只需要告訴他們：

> 「請用手機或電腦開啟這個網址：
> **https://ohrice.github.io/Pitch-test/**
>
> 點選你想唱的歌，然後按「開始測試」就可以了！」

就這麼簡單！ 🎵

---

## 🔑 管理員操作

### 如何上傳新歌曲：

1. 開啟 https://ohrice.github.io/Pitch-test/upload.html
2. 登入（使用你的管理員帳號）
3. 填寫歌曲名稱、選擇聲部
4. 上傳 MIDI 檔和伴奏檔
5. 點擊「儲存歌曲」

### 如何刪除歌曲：

1. 開啟主頁面
2. 找到要刪除的歌曲
3. 點擊歌曲卡片上的 🗑️ 圖示
4. 確認刪除

---

## ❓ 常見問題快速解答

### Q: 長者需要登入嗎？
**A**: ❌ 不需要！只有管理員（你）需要登入才能上傳歌曲。

### Q: 每次上傳都要付費嗎？
**A**: ❌ 不用！Firebase 免費方案每月提供：
- 5 GB 儲存空間（約 1,600 首歌）
- 1 GB 下載流量（約 333 次播放）
- 對長者音樂平台來說綽綽有餘！

### Q: 忘記管理員密碼怎麼辦？
**A**: 前往 Firebase Console → Authentication → Users → 找到你的帳號 → 重設密碼

### Q: 想修改網站外觀或功能？
**A**: 修改對應的 HTML/CSS/JS 檔案後，重新上傳到 GitHub 即可（會自動更新）

---

## 📂 檔案清單

### 必須上傳到 GitHub 的檔案：
- ✅ index.html
- ✅ upload.html
- ✅ app.js
- ✅ firebase-config.js
- ✅ firebase-db.js
- ✅ pitch-test-engine.js
- ✅ README.md

### 不需要上傳的檔案：
- ❌ db.js（已被 firebase-db.js 取代）
- ❌ FIREBASE_SETUP_GUIDE.md（教學文件，可選）
- ❌ DEPLOYMENT_GUIDE.md（教學文件，可選）
- ❌ MIGRATION_SUMMARY.md（教學文件，可選）
- ❌ QUICK_START.md（本檔案，可選）

---

## 🎯 下一步

完成以上步驟後，你可以：

1. ✨ 開始上傳你準備好的歌曲
2. 📱 分享網址給長者使用
3. 📊 前往 Firebase Console 查看使用統計
4. 🎨 自訂網站外觀（修改 CSS）
5. 🔧 新增更多功能（需要修改程式碼）

---

## 💡 小提示

- 管理員密碼要記好，不要分享給其他人
- 定期檢查 Firebase 的使用量（Settings → Usage）
- 可以在多台電腦登入管理員帳號上傳歌曲
- MIDI 檔建議 < 1 MB，伴奏檔建議 < 5 MB

---

**需要完整說明？**
- 📘 Firebase 設定: [FIREBASE_SETUP_GUIDE.md](FIREBASE_SETUP_GUIDE.md)
- 📗 部署教學: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- 📙 遷移總結: [MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md)

**祝你順利！** 🎉
