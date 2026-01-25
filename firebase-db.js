// Firebase 資料庫管理模組
// 替代原本的 db.js (IndexedDB)，使用 Firebase Storage + Firestore

const SONGS_COLLECTION = 'songs';
const STORAGE_PATH = 'songs/';

// 新增歌曲到 Firebase
async function addSong(songData) {
    try {
        // 檢查是否已登入
        if (!currentUser) {
            throw new Error('請先登入才能上傳歌曲');
        }

        console.log('開始上傳歌曲到 Firebase...');

        // 1. 上傳 MIDI 檔案到 Storage
        const midiFileName = `${Date.now()}_${songData.midiFileName}`;
        const midiRef = storage.ref(`${STORAGE_PATH}midi/${midiFileName}`);

        // 將 Base64 轉回 Blob
        const midiBlob = base64ToBlob(songData.midiData);
        const midiSnapshot = await midiRef.put(midiBlob);
        const midiURL = await midiSnapshot.ref.getDownloadURL();

        console.log('MIDI 檔案上傳成功:', midiURL);

        // 2. 上傳伴奏檔案到 Storage
        const accompFileName = `${Date.now()}_${songData.accompFileName}`;
        const accompRef = storage.ref(`${STORAGE_PATH}accomp/${accompFileName}`);

        const accompBlob = base64ToBlob(songData.accompData);
        const accompSnapshot = await accompRef.put(accompBlob);
        const accompURL = await accompSnapshot.ref.getDownloadURL();

        console.log('伴奏檔案上傳成功:', accompURL);

        // 3. 儲存歌曲資訊到 Firestore（只存 metadata 和 URL，不存檔案本身）
        const songDoc = {
            title: songData.title,
            part: songData.part,
            midiURL: midiURL,
            accompURL: accompURL,
            midiFileName: songData.midiFileName,
            accompFileName: songData.accompFileName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.email
        };

        const docRef = await db.collection(SONGS_COLLECTION).add(songDoc);
        console.log('歌曲資訊已儲存，ID:', docRef.id);

        return docRef.id;

    } catch (error) {
        console.error('上傳歌曲失敗:', error);
        throw error;
    }
}

// 取得所有歌曲
async function getAllSongs() {
    try {
        const snapshot = await db.collection(SONGS_COLLECTION)
            .orderBy('createdAt', 'desc')
            .get();

        const songs = [];
        snapshot.forEach(doc => {
            songs.push({
                id: doc.id,
                ...doc.data()
            });
        });

        console.log(`從 Firebase 取得 ${songs.length} 首歌曲`);
        return songs;

    } catch (error) {
        console.error('取得歌曲失敗:', error);
        throw error;
    }
}

// 取得單一歌曲
async function getSong(id) {
    try {
        const doc = await db.collection(SONGS_COLLECTION).doc(id).get();

        if (doc.exists) {
            return {
                id: doc.id,
                ...doc.data()
            };
        } else {
            throw new Error('歌曲不存在');
        }

    } catch (error) {
        console.error('取得歌曲失敗:', error);
        throw error;
    }
}

// 更新歌曲
async function updateSong(id, updates) {
    try {
        // 檢查是否已登入
        if (!currentUser) {
            throw new Error('請先登入才能更新歌曲');
        }

        console.log('開始更新歌曲...', id);

        // 1. 取得現有歌曲資訊
        const songDoc = await db.collection(SONGS_COLLECTION).doc(id).get();

        if (!songDoc.exists) {
            throw new Error('歌曲不存在');
        }

        const currentData = songDoc.data();
        const updateData = {
            title: updates.title,
            part: updates.part,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: currentUser.email
        };

        // 2. 如果有新的 MIDI 檔案，上傳並刪除舊檔案
        if (updates.midiData) {
            // 上傳新檔案
            const midiFileName = `${Date.now()}_${updates.midiFileName}`;
            const midiRef = storage.ref(`${STORAGE_PATH}midi/${midiFileName}`);
            const midiBlob = base64ToBlob(updates.midiData);
            const midiSnapshot = await midiRef.put(midiBlob);
            const midiURL = await midiSnapshot.ref.getDownloadURL();

            console.log('新 MIDI 檔案上傳成功:', midiURL);

            // 刪除舊檔案
            if (currentData.midiURL) {
                try {
                    const oldMidiRef = storage.refFromURL(currentData.midiURL);
                    await oldMidiRef.delete();
                    console.log('舊 MIDI 檔案已刪除');
                } catch (e) {
                    console.warn('刪除舊 MIDI 檔案失敗:', e);
                }
            }

            updateData.midiURL = midiURL;
            updateData.midiFileName = updates.midiFileName;
        }

        // 3. 如果有新的伴奏檔案，上傳並刪除舊檔案
        if (updates.accompData) {
            // 上傳新檔案
            const accompFileName = `${Date.now()}_${updates.accompFileName}`;
            const accompRef = storage.ref(`${STORAGE_PATH}accomp/${accompFileName}`);
            const accompBlob = base64ToBlob(updates.accompData);
            const accompSnapshot = await accompRef.put(accompBlob);
            const accompURL = await accompSnapshot.ref.getDownloadURL();

            console.log('新伴奏檔案上傳成功:', accompURL);

            // 刪除舊檔案
            if (currentData.accompURL) {
                try {
                    const oldAccompRef = storage.refFromURL(currentData.accompURL);
                    await oldAccompRef.delete();
                    console.log('舊伴奏檔案已刪除');
                } catch (e) {
                    console.warn('刪除舊伴奏檔案失敗:', e);
                }
            }

            updateData.accompURL = accompURL;
            updateData.accompFileName = updates.accompFileName;
        }

        // 4. 更新 Firestore 資訊
        await db.collection(SONGS_COLLECTION).doc(id).update(updateData);
        console.log('歌曲資訊已更新，ID:', id);

    } catch (error) {
        console.error('更新歌曲失敗:', error);
        throw error;
    }
}

// 刪除歌曲
async function deleteSong(id) {
    try {
        // 檢查是否已登入
        if (!currentUser) {
            throw new Error('請先登入才能刪除歌曲');
        }

        // 1. 取得歌曲資訊
        const songDoc = await db.collection(SONGS_COLLECTION).doc(id).get();

        if (!songDoc.exists) {
            throw new Error('歌曲不存在');
        }

        const songData = songDoc.data();

        // 2. 從 Storage 刪除 MIDI 檔案
        if (songData.midiURL) {
            const midiRef = storage.refFromURL(songData.midiURL);
            await midiRef.delete();
            console.log('MIDI 檔案已刪除');
        }

        // 3. 從 Storage 刪除伴奏檔案
        if (songData.accompURL) {
            const accompRef = storage.refFromURL(songData.accompURL);
            await accompRef.delete();
            console.log('伴奏檔案已刪除');
        }

        // 4. 從 Firestore 刪除歌曲資訊
        await db.collection(SONGS_COLLECTION).doc(id).delete();
        console.log('歌曲資訊已刪除，ID:', id);

    } catch (error) {
        console.error('刪除歌曲失敗:', error);
        throw error;
    }
}

// 搜尋歌曲（by title）
async function searchSongs(query) {
    const allSongs = await getAllSongs();
    const lowerQuery = query.toLowerCase();

    return allSongs.filter(song =>
        song.title.toLowerCase().includes(lowerQuery)
    );
}

// 估算儲存空間使用情況（Firebase 版本）
async function getStorageEstimate() {
    try {
        // Firebase 不提供即時的儲存空間查詢
        // 可以手動計算已上傳的檔案數量
        const songs = await getAllSongs();

        return {
            songCount: songs.length,
            message: `已儲存 ${songs.length} 首歌曲。請至 Firebase Console 查看詳細的儲存空間使用情況。`
        };
    } catch (error) {
        console.error('取得儲存資訊失敗:', error);
        return null;
    }
}

// 清空所有歌曲（謹慎使用）
async function clearAllSongs() {
    try {
        // 檢查是否已登入
        if (!currentUser) {
            throw new Error('請先登入才能清空歌曲');
        }

        const snapshot = await db.collection(SONGS_COLLECTION).get();

        const deletePromises = [];
        snapshot.forEach(doc => {
            deletePromises.push(deleteSong(doc.id));
        });

        await Promise.all(deletePromises);
        console.log('所有歌曲已清空');

    } catch (error) {
        console.error('清空失敗:', error);
        throw error;
    }
}

// 輔助函數：Base64 轉 Blob
function base64ToBlob(base64String) {
    // 分離 MIME 類型和 Base64 資料
    const parts = base64String.split(',');
    const mimeType = parts[0].match(/:(.*?);/)[1];
    const base64Data = parts[1];

    // 解碼 Base64
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

// 輔助函數：下載檔案並轉換為 Base64（用於載入歌曲時）
async function downloadFileAsBase64(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('下載檔案失敗:', error);
        throw error;
    }
}

console.log('Firebase DB 模組已載入');
