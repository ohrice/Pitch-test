// Firebase 設定檔
// 請將下方的 firebaseConfig 替換成你從 Firebase Console 複製的設定

// Firebase 專案設定
const firebaseConfig = {
    apiKey: "AIzaSyC5r3r2Bclq5Qg4sWYHIAwXC-UrGBenCVw",
    authDomain: "jg-music-platform.firebaseapp.com",
    projectId: "jg-music-platform",
    storageBucket: "jg-music-platform.firebasestorage.app",
    messagingSenderId: "640153433017",
    appId: "1:640153433017:web:ba095c31f221e04f0c7c68",
    measurementId: "G-PH1TS80KKV"
};

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);

// 初始化服務
const auth = firebase.auth();
const storage = firebase.storage();
const db = firebase.firestore();

// 全域變數
let currentUser = null;

// 監聽登入狀態
auth.onAuthStateChanged((user) => {
    currentUser = user;
    console.log('登入狀態:', user ? `已登入 (${user.email})` : '未登入');

    // 更新上傳按鈕顯示
    updateUploadButtonVisibility();
});

// 更新上傳按鈕的顯示狀態
function updateUploadButtonVisibility() {
    const addSongBtn = document.getElementById('addSongBtn');
    if (addSongBtn) {
        // 只有登入的管理員才能看到上傳按鈕
        addSongBtn.style.display = currentUser ? 'inline-block' : 'none';
    }
}

// 登入函數（供 upload.html 使用）
async function loginAdmin(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        console.log('登入成功:', userCredential.user.email);
        return userCredential.user;
    } catch (error) {
        console.error('登入失敗:', error);
        throw error;
    }
}

// 登出函數
async function logoutAdmin() {
    try {
        await auth.signOut();
        console.log('已登出');
    } catch (error) {
        console.error('登出失敗:', error);
        throw error;
    }
}

// 檢查是否已登入
function isLoggedIn() {
    return currentUser !== null;
}

console.log('Firebase 已初始化');
