// 練習紀錄管理模組 - 使用 localStorage

const STORAGE_KEY = 'jg_practice_records';
const MAX_RECORDS = 100; // 最多保留 100 筆紀錄

// 儲存練習紀錄
function savePracticeRecord(record) {
    try {
        // 獲取現有紀錄
        const records = getPracticeRecords();

        // 加入新紀錄
        records.unshift(record); // 新紀錄放在最前面

        // 限制紀錄數量
        if (records.length > MAX_RECORDS) {
            records.splice(MAX_RECORDS);
        }

        // 儲存到 localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));

        console.log('✅ 練習紀錄已儲存:', record);
        return true;
    } catch (error) {
        console.error('❌ 儲存練習紀錄失敗:', error);
        return false;
    }
}

// 獲取所有練習紀錄
function getPracticeRecords() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('❌ 讀取練習紀錄失敗:', error);
        return [];
    }
}

// 獲取特定歌曲的練習紀錄
function getSongRecords(songId) {
    const allRecords = getPracticeRecords();
    return allRecords.filter(record => record.songId === songId);
}

// 獲取最近 N 筆紀錄
function getRecentRecords(count = 5) {
    const allRecords = getPracticeRecords();
    return allRecords.slice(0, count);
}

// 獲取歌曲的最佳成績
function getBestScore(songId) {
    const songRecords = getSongRecords(songId);
    if (songRecords.length === 0) return null;

    return Math.max(...songRecords.map(r => r.accuracy));
}

// 獲取歌曲的平均成績
function getAverageScore(songId) {
    const songRecords = getSongRecords(songId);
    if (songRecords.length === 0) return null;

    const total = songRecords.reduce((sum, r) => sum + r.accuracy, 0);
    return (total / songRecords.length).toFixed(1);
}

// 獲取練習次數
function getPracticeCount(songId) {
    return getSongRecords(songId).length;
}

// 獲取整體統計
function getOverallStats() {
    const records = getPracticeRecords();

    if (records.length === 0) {
        return {
            totalPractices: 0,
            totalSongs: 0,
            avgAccuracy: 0,
            totalTime: 0
        };
    }

    // 計算不重複歌曲數
    const uniqueSongs = new Set(records.map(r => r.songId));

    // 計算總練習時間（秒）
    const totalTime = records.reduce((sum, r) => sum + (r.duration || 0), 0);

    // 計算平均準確率
    const totalAccuracy = records.reduce((sum, r) => sum + r.accuracy, 0);
    const avgAccuracy = (totalAccuracy / records.length).toFixed(1);

    return {
        totalPractices: records.length,
        totalSongs: uniqueSongs.size,
        avgAccuracy: parseFloat(avgAccuracy),
        totalTime: totalTime
    };
}

// 刪除特定紀錄
function deleteRecord(timestamp) {
    try {
        const records = getPracticeRecords();
        const filtered = records.filter(r => r.timestamp !== timestamp);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        return true;
    } catch (error) {
        console.error('❌ 刪除紀錄失敗:', error);
        return false;
    }
}

// 清空所有紀錄
function clearAllRecords() {
    try {
        localStorage.removeItem(STORAGE_KEY);
        console.log('✅ 所有練習紀錄已清空');
        return true;
    } catch (error) {
        console.error('❌ 清空紀錄失敗:', error);
        return false;
    }
}

// 匯出紀錄為 JSON
function exportRecords() {
    const records = getPracticeRecords();
    const dataStr = JSON.stringify(records, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const url = URL.createObjectURL(dataBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jg-practice-records-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// 匯入紀錄
function importRecords(jsonData) {
    try {
        const importedRecords = JSON.parse(jsonData);

        if (!Array.isArray(importedRecords)) {
            throw new Error('格式錯誤：資料必須是陣列');
        }

        // 合併現有紀錄
        const existingRecords = getPracticeRecords();
        const merged = [...importedRecords, ...existingRecords];

        // 去重（根據 timestamp）
        const uniqueRecords = Array.from(
            new Map(merged.map(r => [r.timestamp, r])).values()
        );

        // 排序（最新的在前面）
        uniqueRecords.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // 限制數量
        if (uniqueRecords.length > MAX_RECORDS) {
            uniqueRecords.splice(MAX_RECORDS);
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(uniqueRecords));
        console.log(`✅ 成功匯入 ${importedRecords.length} 筆紀錄`);
        return true;
    } catch (error) {
        console.error('❌ 匯入紀錄失敗:', error);
        alert(`匯入失敗：${error.message}`);
        return false;
    }
}

// 格式化時間顯示
function formatTime(seconds) {
    if (!seconds) return '0 秒';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours} 小時 ${minutes} 分鐘`;
    } else if (minutes > 0) {
        return `${minutes} 分鐘 ${secs} 秒`;
    } else {
        return `${secs} 秒`;
    }
}

// 格式化日期顯示
function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    // 今天
    if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
        return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }

    // 昨天
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth()) {
        return `昨天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }

    // 本週內
    if (diff < 7 * 24 * 60 * 60 * 1000) {
        const days = ['日', '一', '二', '三', '四', '五', '六'];
        return `週${days[date.getDay()]} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }

    // 其他
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

// 獲取成績等級
function getScoreGrade(accuracy) {
    if (accuracy >= 90) return { text: '優秀', stars: '⭐⭐⭐⭐⭐', color: '#48c774' };
    if (accuracy >= 80) return { text: '良好', stars: '⭐⭐⭐⭐', color: '#3298dc' };
    if (accuracy >= 70) return { text: '及格', stars: '⭐⭐⭐', color: '#ffdd57' };
    if (accuracy >= 60) return { text: '待加強', stars: '⭐⭐', color: '#ff9800' };
    return { text: '需努力', stars: '⭐', color: '#f14668' };
}
