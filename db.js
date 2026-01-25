// IndexedDB 資料庫管理模組
// 提供歌曲的 CRUD 操作，支援儲存大型檔案

const DB_NAME = 'JG_MusicPlatform';
const DB_VERSION = 2;
const STORE_NAME = 'songs';

let db = null;

// 初始化資料庫
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('資料庫開啟失敗:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            console.log('資料庫開啟成功');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            db = event.target.result;

            // 建立 songs object store（如果不存在）
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });

                // 建立索引以便搜尋
                objectStore.createIndex('title', 'title', { unique: false });
                objectStore.createIndex('part', 'part', { unique: false });
                objectStore.createIndex('createdAt', 'createdAt', { unique: false });

                console.log('Object store 建立成功');
            } else {
                // 如果 object store 已存在，則更新索引
                const transaction = event.target.transaction;
                const objectStore = transaction.objectStore(STORE_NAME);

                // 刪除舊的索引（如果存在）
                if (objectStore.indexNames.contains('artist')) {
                    objectStore.deleteIndex('artist');
                }
                if (objectStore.indexNames.contains('difficulty')) {
                    objectStore.deleteIndex('difficulty');
                }

                // 新增 part 索引（如果不存在）
                if (!objectStore.indexNames.contains('part')) {
                    objectStore.createIndex('part', 'part', { unique: false });
                }

                console.log('索引已更新');
            }
        };
    });
}

// 新增歌曲
async function addSong(songData) {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);

        // 新增時間戳記
        songData.createdAt = new Date().toISOString();

        const request = objectStore.add(songData);

        request.onsuccess = () => {
            console.log('歌曲新增成功，ID:', request.result);
            resolve(request.result);
        };

        request.onerror = () => {
            console.error('歌曲新增失敗:', request.error);
            reject(request.error);
        };
    });
}

// 取得所有歌曲
async function getAllSongs() {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.getAll();

        request.onsuccess = () => {
            console.log(`取得 ${request.result.length} 首歌曲`);
            resolve(request.result);
        };

        request.onerror = () => {
            console.error('取得歌曲失敗:', request.error);
            reject(request.error);
        };
    });
}

// 取得單一歌曲
async function getSong(id) {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.get(id);

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            console.error('取得歌曲失敗:', request.error);
            reject(request.error);
        };
    });
}

// 刪除歌曲
async function deleteSong(id) {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.delete(id);

        request.onsuccess = () => {
            console.log('歌曲刪除成功，ID:', id);
            resolve();
        };

        request.onerror = () => {
            console.error('歌曲刪除失敗:', request.error);
            reject(request.error);
        };
    });
}

// 搜尋歌曲（by title）
async function searchSongs(query) {
    const allSongs = await getAllSongs();
    const lowerQuery = query.toLowerCase();

    return allSongs.filter(song =>
        song.title.toLowerCase().includes(lowerQuery)
    );
}

// 估算資料庫使用空間
async function getStorageEstimate() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
            usage: estimate.usage,
            quota: estimate.quota,
            usageInMB: (estimate.usage / (1024 * 1024)).toFixed(2),
            quotaInMB: (estimate.quota / (1024 * 1024)).toFixed(2),
            percentUsed: ((estimate.usage / estimate.quota) * 100).toFixed(2)
        };
    }
    return null;
}

// 清空所有歌曲（謹慎使用）
async function clearAllSongs() {
    if (!db) await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.clear();

        request.onsuccess = () => {
            console.log('所有歌曲已清空');
            resolve();
        };

        request.onerror = () => {
            console.error('清空失敗:', request.error);
            reject(request.error);
        };
    });
}
