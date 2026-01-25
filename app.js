// 主應用程式邏輯
let currentSong = null;
let songs = [];

// 聲部中文對照
const partLabels = {
    part1: "一部",
    part2: "二部",
    part3: "三部"
};

// 初始化應用程式
document.addEventListener('DOMContentLoaded', async () => {
    await loadSongsFromStorage();
    renderSongList();
    setupSearch();
});

// 從 IndexedDB 載入歌曲
async function loadSongsFromStorage() {
    try {
        songs = await getAllSongs();
        console.log(`已載入 ${songs.length} 首歌曲`);

        // 顯示儲存空間資訊
        const storageInfo = await getStorageEstimate();
        if (storageInfo) {
            console.log(`儲存空間使用情況: ${storageInfo.usageInMB} MB / ${storageInfo.quotaInMB} MB (${storageInfo.percentUsed}%)`);
        }
    } catch (error) {
        console.error('載入歌曲失敗:', error);
        songs = [];
        console.log('尚無歌曲，請點擊「新增歌曲」上傳');
    }
}

// 渲染歌曲列表
function renderSongList(filteredSongs = songs) {
    // 清空所有聲部的網格
    const gridPart1 = document.getElementById('songGridPart1');
    const gridPart2 = document.getElementById('songGridPart2');
    const gridPart3 = document.getElementById('songGridPart3');

    gridPart1.innerHTML = '';
    gridPart2.innerHTML = '';
    gridPart3.innerHTML = '';

    // 按聲部分類歌曲
    const part1Songs = filteredSongs.filter(song => song.part === 'part1');
    const part2Songs = filteredSongs.filter(song => song.part === 'part2');
    const part3Songs = filteredSongs.filter(song => song.part === 'part3');

    // 渲染各聲部
    renderPartSongs(gridPart1, part1Songs, 'part1');
    renderPartSongs(gridPart2, part2Songs, 'part2');
    renderPartSongs(gridPart3, part3Songs, 'part3');
}

// 渲染特定聲部的歌曲
function renderPartSongs(grid, partSongs, partType) {
    if (partSongs.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #aaa; padding: 20px;">尚無歌曲</div>';
        return;
    }

    partSongs.forEach(song => {
        const card = document.createElement('div');
        card.className = 'song-card';
        card.onclick = () => selectSong(song);

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3>${song.title}</h3>
                <div>
                    <button class="edit-btn admin-only" onclick="event.stopPropagation(); editSongHandler('${song.id}')">✏️</button>
                    <button class="delete-btn admin-only" onclick="event.stopPropagation(); deleteSongHandler('${song.id}')">🗑️</button>
                </div>
            </div>
        `;

        grid.appendChild(card);
    });
}

// 搜尋功能
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', async (e) => {
        const query = e.target.value.toLowerCase();
        if (query.trim() === '') {
            // 如果搜尋欄為空，顯示所有歌曲
            renderSongList(songs);
        } else {
            // 使用搜尋功能
            const filtered = songs.filter(song =>
                song.title.toLowerCase().includes(query)
            );
            renderSongList(filtered);
        }
    });
}

// 從 Firebase Storage URL 提取檔案路徑（備用，可能不需要了）
function extractStoragePath(url) {
    // URL 格式: https://firebasestorage.googleapis.com/v0/b/bucket/o/path%2Fto%2Ffile?...
    const match = url.match(/\/o\/(.+?)\?/);
    if (match && match[1]) {
        return decodeURIComponent(match[1]);
    }
    throw new Error('無法解析 Firebase Storage URL: ' + url);
}

// 選擇歌曲
async function selectSong(song) {
    currentSong = song;

    // 切換到測試頁面
    document.getElementById('songListPage').style.display = 'none';
    document.getElementById('testPage').style.display = 'block';

    // 更新測試頁面標題
    document.getElementById('currentSongTitle').textContent = song.title;
    document.getElementById('currentSongArtist').textContent = `🎵 ${partLabels[song.part]}`;

    // 重新調整 canvas 大小（因為測試頁面剛從 display:none 變為 display:block）
    setTimeout(() => {
        const canvas = document.getElementById('pianoRoll');
        const axisCanvas = document.getElementById('pitchAxis');
        if (canvas && axisCanvas) {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
            axisCanvas.width = 60;
            axisCanvas.height = canvas.clientHeight;
            console.log('Canvas 已調整大小:', canvas.width, 'x', canvas.height);
        }
    }, 50);

    // 更新狀態
    document.getElementById('statusText').innerText = '狀態：載入歌曲檔案中...';

    // 載入 MIDI 和伴奏
    try {
        await loadSongFromStorage(song);
        document.getElementById('statusText').innerText = '狀態：歌曲載入完成，點擊開始測試！';
    } catch (error) {
        console.error('載入歌曲失敗:', error);
        document.getElementById('statusText').innerText = `狀態：載入失敗 - ${error.message}`;
        alert(`載入歌曲失敗：${error.message}`);
    }
}

// 從 Firebase 載入歌曲檔案
async function loadSongFromStorage(song) {
    // Firebase 版本：使用 Firebase Storage SDK 下載檔案
    // 檢查歌曲資料格式（支援舊的 Base64 格式和新的 URL 格式）
    let midiFile, accompFile;

    if (song.midiURL) {
        // 新格式：Firebase URL - 使用 XMLHttpRequest 下載（更好的移動端相容性）
        console.log('從 Firebase 下載 MIDI:', song.midiURL);

        try {
            // 下載 MIDI 檔案
            console.log('下載 MIDI 檔案...');
            const midiBlob = await downloadFileAsBlob(song.midiURL, 'audio/midi');
            console.log('MIDI 下載成功，大小:', midiBlob.size, 'bytes');
            midiFile = new File([midiBlob], song.midiFileName || 'melody.mid', { type: 'audio/midi' });

            // 下載伴奏
            console.log('從 Firebase 下載伴奏:', song.accompURL);

            // 根據檔案副檔名判斷正確的 MIME 類型
            const accompFileName = song.accompFileName || 'accomp.mp3';
            let accompMimeType = 'audio/mpeg'; // 預設
            if (accompFileName.endsWith('.wav')) accompMimeType = 'audio/wav';
            else if (accompFileName.endsWith('.m4a')) accompMimeType = 'audio/mp4';
            else if (accompFileName.endsWith('.aac')) accompMimeType = 'audio/aac';
            else if (accompFileName.endsWith('.ogg')) accompMimeType = 'audio/ogg';
            else if (accompFileName.endsWith('.webm')) accompMimeType = 'audio/webm';

            const accompBlob = await downloadFileAsBlob(song.accompURL, accompMimeType);
            console.log('伴奏下載成功，大小:', accompBlob.size, 'bytes');
            accompFile = new File([accompBlob], accompFileName, { type: accompMimeType });

        } catch (error) {
            console.error('從 Firebase 下載檔案時發生錯誤:', error);
            throw new Error(`下載失敗: ${error.message}`);
        }
    } else {
        // 舊格式：Base64（向下相容）
        console.log('使用 Base64 格式載入（舊格式）');
        midiFile = base64ToFile(song.midiData, song.midiFileName || 'melody.mid', 'audio/midi');

        const accompFileName = song.accompFileName || 'accomp.mp3';
        let accompMimeType = 'audio/mpeg';
        if (accompFileName.endsWith('.wav')) accompMimeType = 'audio/wav';
        else if (accompFileName.endsWith('.m4a')) accompMimeType = 'audio/mp4';
        else if (accompFileName.endsWith('.aac')) accompMimeType = 'audio/aac';
        else if (accompFileName.endsWith('.ogg')) accompMimeType = 'audio/ogg';
        else if (accompFileName.endsWith('.webm')) accompMimeType = 'audio/webm';

        accompFile = base64ToFile(song.accompData, accompFileName, accompMimeType);
    }

    // 分析 MIDI
    melodyTemplate = await analyzeMelody(midiFile);
    console.log('MIDI 分析完成，melodyTemplate 長度:', melodyTemplate.length);
    console.log('melodyTemplate 前 5 個:', melodyTemplate.slice(0, 5));

    // 確保 renderPianoRoll 在全域可用
    if (typeof renderPianoRoll === 'function') {
        renderPianoRoll();
        console.log('已呼叫 renderPianoRoll()');
    } else {
        console.error('renderPianoRoll 函數不存在！');
    }

    // 解碼伴奏
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    const arrayBuffer = await accompFile.arrayBuffer();

    try {
        accompBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    } catch (decodeError) {
        // 某些瀏覽器需要回調版本
        accompBuffer = await new Promise((resolve, reject) => {
            audioCtx.decodeAudioData(
                arrayBuffer,
                (buffer) => resolve(buffer),
                (error) => reject(error)
            );
        });
    }
}

// 使用 XMLHttpRequest 下載檔案為 Blob（更好的移動端相容性）
function downloadFileAsBlob(url, mimeType) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'blob';

        // 顯示下載進度
        xhr.onprogress = function(event) {
            if (event.lengthComputable) {
                const percentComplete = Math.round((event.loaded / event.total) * 100);
                const statusText = document.getElementById('statusText');
                if (statusText) {
                    statusText.innerText = `狀態：下載中... ${percentComplete}%`;
                }
            }
        };

        xhr.onload = function() {
            if (xhr.status === 200) {
                resolve(xhr.response);
            } else {
                reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
            }
        };

        xhr.onerror = function() {
            reject(new Error('網路錯誤，請檢查網路連線'));
        };

        xhr.ontimeout = function() {
            reject(new Error('下載超時，請檢查網路速度或稍後再試'));
        };

        xhr.timeout = 180000; // 增加到 180 秒（3 分鐘）
        xhr.send();
    });
}

// Base64 轉 File
function base64ToFile(base64String, fileName, mimeType) {
    // 移除 data URL 前綴
    const base64Data = base64String.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    return new File([blob], fileName, { type: mimeType });
}

// 編輯歌曲
function editSongHandler(songId) {
    // 檢查是否已登入
    if (!isLoggedIn()) {
        alert('請先登入才能編輯歌曲！\n\n請前往上傳頁面登入。');
        return;
    }

    // 導向編輯頁面，並帶上歌曲 ID
    window.location.href = `edit.html?id=${songId}`;
}

// 刪除歌曲
async function deleteSongHandler(songId) {
    // 檢查是否已登入
    if (!isLoggedIn()) {
        alert('請先登入才能刪除歌曲！\n\n請前往上傳頁面登入。');
        return;
    }

    if (!confirm('確定要刪除這首歌曲嗎？')) {
        return;
    }

    try {
        // 從 Firebase 刪除（會同時刪除 Firestore 資料和 Storage 檔案）
        await deleteSong(songId);

        // 重新載入歌曲列表
        await loadSongsFromStorage();

        // 重新渲染
        renderSongList();

        // 顯示訊息
        const statusText = document.getElementById('searchInput');
        statusText.placeholder = '歌曲已刪除';
        setTimeout(() => {
            statusText.placeholder = '搜尋歌曲...';
        }, 2000);
    } catch (error) {
        console.error('刪除失敗:', error);
        alert(`刪除失敗：${error.message}`);
    }
}

// 返回歌曲列表
function backToSongList() {
    // 停止測試（如果正在進行）
    if (isPlaying) {
        if (sourceNode) sourceNode.stop();
        if (micStream) micStream.getTracks().forEach(t => t.stop());
        isPlaying = false;
    }

    // 停止麥克風測試
    if (isTesting) {
        if (testMicStream) {
            testMicStream.getTracks().forEach(t => t.stop());
            testMicStream = null;
        }
        isTesting = false;
        document.getElementById('testMicBtn').textContent = '測試麥克風';
        document.getElementById('testMicBtn').style.background = '#3273dc';
    }

    // 重置結果面板
    document.getElementById('resultsPanel').style.display = 'none';

    // 切換回歌曲列表
    document.getElementById('testPage').style.display = 'none';
    document.getElementById('songListPage').style.display = 'block';

    // 清空搜尋
    document.getElementById('searchInput').value = '';
    renderSongList();
}
