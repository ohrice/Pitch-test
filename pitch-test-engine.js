let melodyTemplate = [];
let userPitchData = [];
let accompBuffer;
let audioCtx;
let sourceNode;
let analyser;
let micStream;
let startTime;
let isPlaying = false;
let accuracyScores = [];
let testStartTimestamp = null; // 記錄測試開始時間（用於計算測試時長）
let noteScores = {}; // 記錄每個音符的所有採樣分數 { noteIndex: [score1, score2, ...] }

// 錄音相關變數
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let mixedStream = null;

// 檢測移動裝置和瀏覽器
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const isChrome = /Chrome|CriOS/i.test(navigator.userAgent) && !/Edge/i.test(navigator.userAgent);
const isSafari = /Safari/i.test(navigator.userAgent) && !isChrome;
console.log(`裝置類型: ${isMobile ? '移動裝置' : '桌面裝置'}`);
console.log(`瀏覽器: Chrome=${isChrome}, Safari=${isSafari}`);
console.log(`User Agent: ${navigator.userAgent}`);

// 改進的自動相關音高檢測算法 (Autocorrelation)
// isLiveInput: true 表示即時麥克風輸入（嚴格），false 表示分析音檔（寬鬆）
function autoCorrelate(buffer, sampleRate, isLiveInput = false) {
    const SIZE = buffer.length;
    const MAX_SAMPLES = Math.floor(SIZE / 2);
    let best_offset = -1;
    let best_correlation = 0;
    let rms = 0;

    // 計算RMS (Root Mean Square)
    for (let i = 0; i < SIZE; i++) {
        const val = buffer[i];
        rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);

    // 根據用途設定不同的音量閾值（降低閾值以提高靈敏度）
    const rmsThreshold = isLiveInput ? 0.01 : 0.005; // 降低閾值,讓耳麥也能順利收音
    if (rms < rmsThreshold) return { pitch: -1, clarity: 0, rms: rms };

    // 尋找最佳相關性
    let lastCorrelation = 1;
    for (let offset = 1; offset < MAX_SAMPLES; offset++) {
        let correlation = 0;

        for (let i = 0; i < MAX_SAMPLES; i++) {
            correlation += Math.abs(buffer[i] - buffer[i + offset]);
        }

        correlation = 1 - (correlation / MAX_SAMPLES);

        if (correlation > 0.9 && correlation > lastCorrelation) {
            const foundGoodCorrelation = (correlation > best_correlation);
            if (foundGoodCorrelation) {
                best_correlation = correlation;
                best_offset = offset;
            }
        }

        lastCorrelation = correlation;
    }

    // 根據用途設定不同的相關性閾值（降低閾值以提高靈敏度）
    const clarityThreshold = isLiveInput ? 0.85 : 0.75; // 降低閾值,提高檢測成功率
    if (best_correlation > clarityThreshold && best_offset > 0) {
        const frequency = sampleRate / best_offset;
        return { pitch: frequency, clarity: best_correlation, rms: rms };
    }

    return { pitch: -1, clarity: best_correlation, rms: rms };
}

// 平滑音高（移動平均）- 減少抖動
let pitchHistory = [];
const PITCH_HISTORY_SIZE = 3;

function smoothPitch(newPitch) {
    if (newPitch <= 0) return -1;

    pitchHistory.push(newPitch);
    if (pitchHistory.length > PITCH_HISTORY_SIZE) {
        pitchHistory.shift();
    }

    // 計算平均值
    const avg = pitchHistory.reduce((sum, p) => sum + p, 0) / pitchHistory.length;

    // 如果新音高與平均值差距太大，可能是錯誤檢測
    if (Math.abs(newPitch - avg) > 50) {
        return -1; // 拒絕異常值
    }

    return avg;
}

// MIDI音符轉換為音符名稱
function midiToNoteName(midi) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const noteName = noteNames[Math.round(midi) % 12];
    return `${noteName}${octave}`;
}

// 找到當前時間最接近的目標音符
function findTargetNote(currentTime) {
    if (melodyTemplate.length === 0) return null;

    // 尋找時間最接近的音符（允許一定容差）
    let closest = null;
    let minDist = Infinity;

    for (let note of melodyTemplate) {
        const dist = Math.abs(note.time - currentTime);
        if (dist < minDist && dist < 0.2) { // 200ms容差
            minDist = dist;
            closest = note;
        }
    }

    return closest;
}

// 計算音準偏差（半音單位）
function calculateDeviation(userNote, targetNote) {
    return userNote - targetNote;
}

// 根據偏差計算準確度分數 (0-100)
function calculateAccuracy(deviation) {
    const absDev = Math.abs(deviation);

    if (absDev < 0.25) return 100; // 完美
    if (absDev < 0.5) return 90;   // 優秀
    if (absDev < 1.0) return 75;   // 良好
    if (absDev < 1.5) return 50;   // 尚可
    if (absDev < 2.0) return 30;   // 需改進
    return 0;                      // 偏差太大
}

// 更新即時音準指示器
function updateAccuracyMeter(deviation, userNote, targetNote) {
    const meter = document.getElementById('accuracyMeter');
    if (!meter) return;

    if (targetNote) {
        // 偏差範圍：-2到+2半音 對應 0%到100%的位置
        const clampedDev = Math.max(-2, Math.min(2, deviation));
        const position = 50 + (clampedDev / 2) * 50; // 50%為中心

        meter.style.left = `${position}%`;

        // 根據準確度改變指示器顏色
        const accuracy = calculateAccuracy(deviation);
        if (accuracy >= 90) {
            meter.style.background = '#48c774'; // 綠色
        } else if (accuracy >= 50) {
            meter.style.background = '#ffdd57'; // 黃色
        } else {
            meter.style.background = '#f14668'; // 紅色
        }
    } else {
        meter.style.left = '50%';
        meter.style.background = 'white';
    }
}

// 更新進度條
function updateProgress(progressBarId, progressTextId, percent) {
    const progressBar = document.getElementById(progressBarId);
    const progressText = document.getElementById(progressTextId);
    if (progressBar && progressText) {
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `${Math.round(percent)}%`;
    }
}

// MIDI 解析器 - 從 MIDI 檔案中提取音符資訊
function parseMIDI(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    let offset = 0;

    // 讀取 MIDI 標頭
    const headerChunk = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    if (headerChunk !== 'MThd') {
        throw new Error('不是有效的 MIDI 檔案');
    }

    offset += 4; // "MThd"
    const headerLength = view.getUint32(offset); offset += 4;
    const format = view.getUint16(offset); offset += 2;
    const numTracks = view.getUint16(offset); offset += 2;
    const division = view.getUint16(offset); offset += 2;

    console.log(`MIDI 格式: ${format}, 軌道數: ${numTracks}, 時間分割: ${division}`);

    const notes = [];
    const activeNotes = {}; // 追蹤正在播放的音符
    let tempo = 500000; // 預設 120 BPM (微秒每四分音符)
    let firstTempo = null; // 記錄第一個找到的 tempo
    const tempoChanges = []; // 記錄速度變化

    // 讀取所有軌道
    for (let track = 0; track < numTracks; track++) {
        const trackHeader = String.fromCharCode(view.getUint8(offset), view.getUint8(offset+1), view.getUint8(offset+2), view.getUint8(offset+3));
        if (trackHeader !== 'MTrk') {
            console.warn(`軌道 ${track} 標頭錯誤`);
            break;
        }

        offset += 4;
        const trackLength = view.getUint32(offset); offset += 4;
        const trackEnd = offset + trackLength;

        let currentTime = 0;
        let lastStatus = 0;

        while (offset < trackEnd) {
            // 讀取 delta time (可變長度)
            const deltaTime = readVarLen(view, offset);
            offset += deltaTime.length;
            currentTime += deltaTime.value;

            // 讀取事件
            let status = view.getUint8(offset);

            // 處理 running status
            if (status < 0x80) {
                status = lastStatus;
            } else {
                offset++;
                lastStatus = status;
            }

            const eventType = status & 0xF0;

            if (eventType === 0x90) { // Note On
                const note = view.getUint8(offset++);
                const velocity = view.getUint8(offset++);

                if (velocity > 0) {
                    // 記錄音符開始時間
                    activeNotes[note] = currentTime;
                } else {
                    // velocity 為 0 等同於 Note Off
                    if (activeNotes[note] !== undefined) {
                        const startTime = activeNotes[note];
                        const duration = currentTime - startTime;
                        notes.push({
                            note: note,
                            startTime: startTime,
                            endTime: currentTime,
                            duration: duration
                        });
                        delete activeNotes[note];
                    }
                }
            } else if (eventType === 0x80) { // Note Off
                const note = view.getUint8(offset++);
                offset++; // velocity

                if (activeNotes[note] !== undefined) {
                    const startTime = activeNotes[note];
                    const duration = currentTime - startTime;
                    notes.push({
                        note: note,
                        startTime: startTime,
                        endTime: currentTime,
                        duration: duration
                    });
                    delete activeNotes[note];
                }
            } else if (eventType === 0xA0 || eventType === 0xB0 || eventType === 0xE0) {
                offset += 2; // 跳過兩個數據字節
            } else if (eventType === 0xC0 || eventType === 0xD0) {
                offset += 1; // 跳過一個數據字節
            } else if (status === 0xFF) { // Meta 事件
                const metaType = view.getUint8(offset++);
                const metaLength = readVarLen(view, offset);
                offset += metaLength.length;

                // 檢查是否為速度變化事件 (Set Tempo)
                if (metaType === 0x51 && metaLength.value === 3) {
                    const newTempo = (view.getUint8(offset) << 16) | (view.getUint8(offset + 1) << 8) | view.getUint8(offset + 2);

                    // 記錄第一個 tempo，這是最重要的
                    if (firstTempo === null) {
                        firstTempo = newTempo;
                        console.log(`第一個 Tempo: ${Math.round(60000000 / newTempo)} BPM at tick ${currentTime}`);
                    }

                    tempo = newTempo;
                    tempoChanges.push({ time: currentTime, tempo: newTempo });
                    const bpm = Math.round(60000000 / newTempo);
                    console.log(`速度變化 #${tempoChanges.length}: ${bpm} BPM at tick ${currentTime}`);
                }

                offset += metaLength.value;
            } else if (status === 0xF0 || status === 0xF7) { // SysEx
                const sysexLength = readVarLen(view, offset);
                offset += sysexLength.length + sysexLength.value;
            }
        }
    }

    // 將 MIDI ticks 轉換為秒
    const ticksPerQuarterNote = division;

    console.log(`速度變化次數: ${tempoChanges.length}`);

    // 如果沒有 tempo 變化，使用預設或第一個 tempo
    if (tempoChanges.length === 0) {
        const effectiveTempo = firstTempo !== null ? firstTempo : tempo;
        console.log(`使用固定 Tempo: ${Math.round(60000000 / effectiveTempo)} BPM`);

        const secondsPerTick = (effectiveTempo / 1000000) / ticksPerQuarterNote;

        const notesInSeconds = notes.map(n => ({
            note: n.note,
            startTime: n.startTime * secondsPerTick,
            endTime: n.endTime * secondsPerTick,
            duration: n.duration * secondsPerTick
        }));

        // 排序音符
        notesInSeconds.sort((a, b) => a.startTime - b.startTime);

        if (notesInSeconds.length > 0) {
            console.log(`時間範圍: ${notesInSeconds[0].startTime.toFixed(2)} - ${notesInSeconds[notesInSeconds.length - 1]?.endTime.toFixed(2)} 秒`);
        }

        return notesInSeconds;
    }

    // 有多個 tempo 變化，需要分段計算
    console.log(`檢測到多段速度變化，使用精確計算模式`);

    // 確保 tempo 變化按時間排序
    tempoChanges.sort((a, b) => a.time - b.time);

    // 顯示所有 tempo 變化
    tempoChanges.forEach((tc, i) => {
        console.log(`  區間 ${i + 1}: tick ${tc.time}, ${Math.round(60000000 / tc.tempo)} BPM`);
    });

    // 將 tick 轉換為秒的函數（考慮多段 tempo）
    function ticksToSeconds(ticks) {
        if (ticks === 0) return 0;

        let seconds = 0;
        let currentTick = 0;
        let currentTempo = tempoChanges[0].tempo; // 使用第一個 tempo 作為初始值

        for (let i = 0; i < tempoChanges.length; i++) {
            const changePoint = tempoChanges[i].time;
            const newTempo = tempoChanges[i].tempo;

            // 如果目標 tick 在當前變化點之前
            if (ticks < changePoint) {
                const ticksInSegment = ticks - currentTick;
                const secondsPerTick = (currentTempo / 1000000) / ticksPerQuarterNote;
                seconds += ticksInSegment * secondsPerTick;
                return seconds;
            }

            // 累加從 currentTick 到 changePoint 的時間（使用當前 tempo）
            const ticksInSegment = changePoint - currentTick;
            const secondsPerTick = (currentTempo / 1000000) / ticksPerQuarterNote;
            seconds += ticksInSegment * secondsPerTick;

            // 更新到下一個區間
            currentTick = changePoint;
            currentTempo = newTempo;
        }

        // 處理最後一個 tempo 變化之後的部分
        const remainingTicks = ticks - currentTick;
        const secondsPerTick = (currentTempo / 1000000) / ticksPerQuarterNote;
        seconds += remainingTicks * secondsPerTick;

        return seconds;
    }

    // 使用新的轉換函數計算每個音符的時間
    const notesInSeconds = notes.map(n => ({
        note: n.note,
        startTime: ticksToSeconds(n.startTime),
        endTime: ticksToSeconds(n.endTime),
        duration: ticksToSeconds(n.endTime) - ticksToSeconds(n.startTime)
    }));

    // 排序音符
    notesInSeconds.sort((a, b) => a.startTime - b.startTime);

    // 過濾重疊的音符，只保留最高音（主旋律）
    const filteredNotes = filterOverlappingNotes(notesInSeconds);

    console.log(`原始音符數: ${notesInSeconds.length}, 過濾後: ${filteredNotes.length}`);

    if (filteredNotes.length > 0) {
        console.log(`時間範圍: ${filteredNotes[0].startTime.toFixed(2)} - ${filteredNotes[filteredNotes.length - 1]?.endTime.toFixed(2)} 秒`);
    }

    return filteredNotes;
}

// 處理重疊音符：過濾和弦 + 裁剪 legato 重疊
function filterOverlappingNotes(notes) {
    if (notes.length === 0) return notes;

    // 按開始時間排序
    const sorted = [...notes].sort((a, b) => a.startTime - b.startTime);

    const result = [];
    const startTimeThreshold = 0.05; // 50 毫秒內視為同時開始（和弦）

    for (let i = 0; i < sorted.length; i++) {
        const currentNote = { ...sorted[i] }; // 複製以便修改

        // 保留所有音符（包括和弦中的所有音符），不再過濾低音

        // 找到下一個不是和弦的音符（開始時間明顯不同）
        let nextNonChordNote = null;
        for (let j = i + 1; j < sorted.length; j++) {
            const timeDiff = Math.abs(sorted[j].startTime - currentNote.startTime);
            if (timeDiff >= startTimeThreshold) {
                // 這是下一個不同時開始的音符（不是和弦的一部分）
                nextNonChordNote = sorted[j];
                break;
            }
        }

        // 如果當前音符的結束時間超過下一個非和弦音符的開始時間（legato）
        if (nextNonChordNote && currentNote.endTime > nextNonChordNote.startTime) {
            const originalEnd = currentNote.endTime;
            // 裁剪到下一個音符開始前（留 10ms 間隙避免重疊）
            currentNote.endTime = nextNonChordNote.startTime - 0.01;
            currentNote.duration = currentNote.endTime - currentNote.startTime;

            if (currentNote.startTime >= 32 && currentNote.startTime <= 34) {
                console.log(`  ✂️ 裁剪 legato: MIDI${currentNote.note}, ${originalEnd.toFixed(3)}s → ${currentNote.endTime.toFixed(3)}s`);
            }
        }

        // 確保持續時間合理
        if (currentNote.duration > 0.01) {
            result.push(currentNote);
        }
    }

    console.log(`音符處理: 原始 ${notes.length} 個，保留 ${result.length} 個（保留所有和弦，裁剪 legato 重疊）`);
    return result;
}

// 讀取可變長度值 (MIDI 格式)
function readVarLen(view, offset) {
    let value = 0;
    let length = 0;
    let byte;

    do {
        byte = view.getUint8(offset + length);
        value = (value << 7) | (byte & 0x7F);
        length++;
    } while (byte & 0x80);

    return { value, length };
}

// 過濾孤立的音符點（暫時停用 - 直接返回所有音符）
function filterIsolatedNotes(notes) {
    console.log(`不進行過濾，保留所有音符：${notes.length} 個`);
    return notes;
}

// 1. 分析主旋律 (MIDI 檔案)
async function analyzeMelody(midiFile) {
    const statusText = document.getElementById('statusText');
    const melodyProgress = document.getElementById('melodyProgress');
    const melodyStatus = document.getElementById('melodyStatus');

    // 檢查檔案大小 (移動裝置記憶體限制)
    if (midiFile.size > 5 * 1024 * 1024) { // 5MB 限制
        if (melodyStatus) {
            melodyStatus.textContent = '✗ 檔案太大 (超過 5MB)';
            melodyStatus.classList.add('error');
        }
        if (statusText) statusText.innerText = '狀態：MIDI 檔案太大，請使用較小的檔案';
        return [];
    }

    if (statusText) statusText.innerText = "狀態：正在分析 MIDI 主旋律...";
    if (melodyProgress) melodyProgress.style.display = 'block';
    if (melodyStatus) {
        melodyStatus.textContent = '讀取 MIDI 檔案中...';
        melodyStatus.classList.remove('error', 'success');
    }
    updateProgress('melodyProgressFill', 'melodyProgressText', 20);

    try {
        // 使用 FileReader 提高相容性
        const arrayBuffer = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('檔案讀取失敗'));
            reader.readAsArrayBuffer(midiFile);
        });

        updateProgress('melodyProgressFill', 'melodyProgressText', 40);
        if (melodyStatus) melodyStatus.textContent = '解析 MIDI 資料中...';

        // 解析 MIDI 檔案
        const midiNotes = parseMIDI(arrayBuffer);
        updateProgress('melodyProgressFill', 'melodyProgressText', 80);

        console.log(`MIDI 解析完成，找到 ${midiNotes.length} 個音符`);
        console.log('前 10 個音符:', midiNotes.slice(0, 10));

        // 將 MIDI 音符轉換為我們使用的格式
        // MIDI 音符編號直接對應，時間已經在 parseMIDI 中轉換為秒
        const result = [];

        midiNotes.forEach(midiNote => {
            // MIDI 格式已經包含音符的持續時間
            // 我們需要在整個持續時間內生成多個採樣點，以便視覺化
            const samplesPerSecond = 50; // 每秒 50 個採樣點
            const numSamples = Math.max(1, Math.floor(midiNote.duration * samplesPerSecond));

            for (let i = 0; i < numSamples; i++) {
                const time = midiNote.startTime + (i / samplesPerSecond);
                if (time <= midiNote.endTime) {
                    result.push({
                        time: time,
                        note: midiNote.note // MIDI 音符編號 (60 = C4)
                    });
                }
            }
        });

        updateProgress('melodyProgressFill', 'melodyProgressText', 100);
        if (melodyStatus) {
            melodyStatus.textContent = `✓ MIDI 解析完成！找到 ${midiNotes.length} 個音符，生成 ${result.length} 個採樣點`;
            melodyStatus.classList.add('success');
        }
        if (statusText) statusText.innerText = `狀態：主旋律分析完成，找到 ${midiNotes.length} 個音符`;

        return result;
    } catch (error) {
        console.error('MIDI 解析錯誤:', error);
        if (melodyStatus) {
            melodyStatus.textContent = `✗ 解析失敗: ${error.message}`;
            melodyStatus.classList.add('error');
        }
        if (statusText) statusText.innerText = `狀態：MIDI 解析失敗，請確認檔案格式`;
        return [];
    }
}

// 將音符點轉換為連續的音符區塊（每個區塊音高固定）
// 先按音高四捨五入分組，然後按時間合併相同音高的連續音符
function groupNotesIntoBlocks(notes, maxGapTime = 0.15) {
    if (notes.length === 0) return [];

    // 先按時間排序
    const sortedNotes = [...notes].sort((a, b) => a.time - b.time);

    const blocks = [];
    let currentBlock = {
        startTime: sortedNotes[0].time,
        endTime: sortedNotes[0].time,
        roundedNote: Math.round(sortedNotes[0].note), // 四捨五入到整數半音
        avgNote: sortedNotes[0].note,
        notes: [sortedNotes[0]]
    };

    for (let i = 1; i < sortedNotes.length; i++) {
        const note = sortedNotes[i];
        const roundedNote = Math.round(note.note);
        const timeDiff = note.time - currentBlock.endTime;

        // 條件：時間差小於 150ms 且四捨五入後音高完全相同
        if (timeDiff < maxGapTime && roundedNote === currentBlock.roundedNote) {
            currentBlock.notes.push(note);
            currentBlock.endTime = note.time;
            // 音高保持為該組的四捨五入值
        } else {
            // 音高變化或時間間隔太大，開始新區塊
            blocks.push(currentBlock);
            currentBlock = {
                startTime: note.time,
                endTime: note.time,
                roundedNote: roundedNote,
                avgNote: note.note,
                notes: [note]
            };
        }
    }

    // 加入最後一個區塊
    blocks.push(currentBlock);

    return blocks;
}

// 繪製音高軸 (Y軸標示)
function renderPitchAxis() {
    const axisCanvas = document.getElementById('pitchAxis');
    if (!axisCanvas) return;

    const axisCtx = axisCanvas.getContext('2d');
    const pitchHeight = 10;
    const offsetNote = 50;

    axisCtx.clearRect(0, 0, axisCanvas.width, axisCanvas.height);

    // 背景
    axisCtx.fillStyle = "#1a1a1a";
    axisCtx.fillRect(0, 0, axisCanvas.width, axisCanvas.height);

    // 音符名稱對應
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    // 繪製音高刻度 (每個 MIDI 音符)
    axisCtx.font = "9px monospace";
    axisCtx.textAlign = "right";

    for (let midiNote = offsetNote; midiNote <= offsetNote + Math.floor(axisCanvas.height / pitchHeight); midiNote++) {
        const y = axisCanvas.height - (midiNote - offsetNote) * pitchHeight;

        if (y >= 0 && y <= axisCanvas.height) {
            const octave = Math.floor(midiNote / 12) - 1;
            const noteName = noteNames[midiNote % 12];
            const fullNoteName = `${noteName}${octave}`;

            // 只顯示 C 音符的完整標示，其他音符顯示較淡
            if (midiNote % 12 === 0) {
                // C 音符 - 白色粗線
                axisCtx.strokeStyle = "#555";
                axisCtx.lineWidth = 2;
                axisCtx.fillStyle = "#00d1b2";
            } else {
                // 其他音符 - 灰色細線
                axisCtx.strokeStyle = "#333";
                axisCtx.lineWidth = 1;
                axisCtx.fillStyle = "#666";
            }

            // 繪製刻度線
            axisCtx.beginPath();
            axisCtx.moveTo(axisCanvas.width - 10, y);
            axisCtx.lineTo(axisCanvas.width, y);
            axisCtx.stroke();

            // 只為 C 和 E, G 音符標示名稱
            if (midiNote % 12 === 0 || midiNote % 12 === 4 || midiNote % 12 === 7) {
                axisCtx.fillText(fullNoteName, axisCanvas.width - 12, y + 3);
            }
        }
    }
}

// 2. 渲染音譜 (整合主旋律與使用者曲線) - 滾動視窗模式
function renderPianoRoll(currentTime = -1) {
    const canvas = document.getElementById('pianoRoll');
    if (!canvas) {
        console.error('Canvas 元素不存在！');
        return;
    }

    const ctx = canvas.getContext('2d');
    const timeScale = 50; // 增加時間縮放，讓畫面更清楚
    const pitchHeight = 10;
    const offsetNote = 50;

    // 每次渲染時也更新音高軸
    renderPitchAxis();

    // 診斷輸出
    if (currentTime === -1) {
        console.log('renderPianoRoll 被呼叫（初始渲染），melodyTemplate 長度:', melodyTemplate?.length || 0);
        console.log('Canvas 尺寸:', canvas.width, 'x', canvas.height);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 計算視窗偏移量（讓當前時間保持在畫面中央偏左）
    const viewWindowSeconds = 10; // 顯示10秒的視窗
    const timeOffset = currentTime >= 0 ? Math.max(0, currentTime - 2) : 0; // 當前時間在左側2秒處

    // 繪製背景網格
    ctx.strokeStyle = "#333";
    for(let i = 0; i < canvas.height; i += 20) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
    }

    // 繪製時間刻度
    ctx.fillStyle = "#555";
    ctx.font = "10px monospace";
    for(let t = Math.floor(timeOffset); t <= timeOffset + viewWindowSeconds; t++) {
        const x = (t - timeOffset) * timeScale;
        if (x >= 0 && x <= canvas.width) {
            ctx.fillText(`${t}s`, x, 10);
        }
    }

    // A. 繪製標準主旋律 (橘色區塊)
    const melodyBlocks = groupNotesIntoBlocks(melodyTemplate, 0.15);
    melodyBlocks.forEach(block => {
        const x1 = (block.startTime - timeOffset) * timeScale;
        const x2 = (block.endTime - timeOffset) * timeScale;
        const actualWidth = x2 - x1;
        // 增加最小寬度到 20 像素，讓短促音符也能清楚看見
        const width = Math.max(actualWidth, 20);
        // 使用四捨五入後的音高，確保每個區塊完全平整
        const y = canvas.height - (block.roundedNote - offsetNote) * pitchHeight;
        const blockHeight = 20; // 區塊高度

        if (x2 >= 0 && x1 <= canvas.width && y >= 0 && y <= canvas.height) {
            // 只繪製橘色填充區塊，每個區塊音高固定
            ctx.fillStyle = "rgba(230, 126, 34, 0.85)"; // 橘色
            ctx.fillRect(x1, y - blockHeight/2, width, blockHeight);
        }
    });

    // B. 繪製使用者演唱軌跡 (根據準確度著色)
    userPitchData.forEach(item => {
        const x = (item.time - timeOffset) * timeScale;
        const y = canvas.height - (item.note - offsetNote) * pitchHeight;

        if (x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height) {
            // 根據準確度設定顏色
            if (item.accuracy >= 90) {
                ctx.fillStyle = "#48c774"; // 綠色：完美
            } else if (item.accuracy >= 50) {
                ctx.fillStyle = "#ffdd57"; // 黃色：良好
            } else {
                ctx.fillStyle = "#f14668"; // 紅色：需改進
            }
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
        }
    });

    // C. 繪製白色掃描線（固定在畫面左側2秒處）
    if (currentTime >= 0) {
        const scanLineX = 2 * timeScale; // 固定在2秒位置
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(scanLineX, 0);
        ctx.lineTo(scanLineX, canvas.height);
        ctx.stroke();

        // 在掃描線上方顯示當前時間
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px monospace";
        ctx.fillText(`${currentTime.toFixed(1)}s`, scanLineX + 5, 25);
    }
}

// 計算最終結果
function calculateFinalResults() {
    // 如果沒有任何採樣點，返回空結果
    if (accuracyScores.length === 0) {
        return {
            avgAccuracy: 0,
            finalScore: 0,
            perfectNotes: 0,
            goodNotes: 0,
            poorNotes: 0,
            totalNotes: melodyTemplate.length
        };
    }

    // 計算整體平均準確率（使用所有採樣點）
    const avgAccuracy = accuracyScores.reduce((a, b) => a + b, 0) / accuracyScores.length;

    // 基於音符的評分
    let perfectNotes = 0;
    let goodNotes = 0;
    let poorNotes = 0;
    let scoredNotes = 0;

    // 為每個 MIDI 音符計算平均分數
    for (let i = 0; i < melodyTemplate.length; i++) {
        if (noteScores[i] && noteScores[i].length > 0) {
            // 計算該音符所有採樣點的平均分數
            const noteAvg = noteScores[i].reduce((a, b) => a + b, 0) / noteScores[i].length;
            scoredNotes++;

            // 根據平均分數分類
            if (noteAvg >= 90) {
                perfectNotes++;
            } else if (noteAvg >= 50) {
                goodNotes++;
            } else {
                poorNotes++;
            }
        } else {
            // 沒有評分的音符視為 poor（用戶沒唱到或沒被偵測到）
            poorNotes++;
        }
    }

    console.log(`📊 評分統計: 總音符=${melodyTemplate.length}, 已評分=${scoredNotes}, 完美=${perfectNotes}, 良好=${goodNotes}, 需改進=${poorNotes}`);

    return {
        avgAccuracy: avgAccuracy.toFixed(1),
        finalScore: Math.round(avgAccuracy),
        perfectNotes,
        goodNotes,
        poorNotes,
        totalNotes: melodyTemplate.length,
        scoredNotes // 實際評分的音符數
    };
}

// 儲存錄音
function saveRecording() {
    if (recordedChunks.length === 0) {
        console.log('沒有錄音資料');
        return;
    }

    // 創建 Blob
    const blob = new Blob(recordedChunks, { type: 'audio/webm' });
    const url = URL.createObjectURL(blob);

    // 生成檔案名稱（包含時間戳記）
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `pitch-test-recording-${timestamp}.webm`;

    // 創建下載連結
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();

    // 清理
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);

    console.log(`錄音已儲存: ${filename}`);

    // 通知使用者
    const statusText = document.getElementById('statusText');
    const currentText = statusText.innerText;
    statusText.innerText = currentText + ` | 錄音已儲存: ${filename}`;
}

// 顯示測試結果
function displayResults() {
    const results = calculateFinalResults();

    document.getElementById('finalScore').textContent = results.finalScore;
    document.getElementById('avgAccuracy').textContent = `${results.avgAccuracy}%`;
    document.getElementById('perfectNotes').textContent = results.perfectNotes;
    document.getElementById('goodNotes').textContent = results.goodNotes;
    document.getElementById('poorNotes').textContent = results.poorNotes;

    document.getElementById('resultsPanel').style.display = 'block';

    // 儲存練習紀錄
    savePracticeToLocalStorage(results);

    // 滾動到結果區域
    document.getElementById('resultsPanel').scrollIntoView({ behavior: 'smooth' });
}

// 儲存練習紀錄到 localStorage
function savePracticeToLocalStorage(results) {
    // 檢查是否有 currentSong（從 app.js 傳入的全域變數）
    if (typeof currentSong === 'undefined' || !currentSong) {
        console.log('⚠️ 無法儲存紀錄：找不到當前歌曲資訊');
        return;
    }

    // 計算測試時長
    const duration = testStartTimestamp ? Math.round((Date.now() - testStartTimestamp) / 1000) : 0;

    // 建立紀錄物件
    const record = {
        songId: currentSong.id,
        songTitle: currentSong.title,
        timestamp: new Date().toISOString(),
        accuracy: results.finalScore,
        avgAccuracy: parseFloat(results.avgAccuracy),
        duration: duration,
        perfectNotes: results.perfectNotes,
        goodNotes: results.goodNotes,
        poorNotes: results.poorNotes,
        totalNotes: results.perfectNotes + results.goodNotes + results.poorNotes
    };

    // 呼叫 practice-records.js 的儲存函數
    if (typeof savePracticeRecord === 'function') {
        const saved = savePracticeRecord(record);
        if (saved) {
            console.log('✅ 練習紀錄已儲存');
            // 更新 UI 顯示（如果有最佳成績提示）
            updateRecordHints(record);
        }
    } else {
        console.error('❌ 找不到 savePracticeRecord 函數，請確認已載入 practice-records.js');
    }
}

// 更新紀錄提示
function updateRecordHints(record) {
    // 檢查是否為新的最佳成績
    const bestScore = typeof getBestScore === 'function' ? getBestScore(record.songId) : null;

    if (bestScore !== null && record.accuracy >= bestScore) {
        // 顯示新紀錄提示
        const statusText = document.getElementById('statusText');
        if (statusText) {
            statusText.innerText = `狀態：測試完成！🎉 恭喜！這是您的最佳成績！`;
        }
    }
}

// 3. 事件綁定
// 註：在 JG 平台中，檔案上傳透過 upload.html 處理，因此不需要這些事件監聽器
// 檔案會在 app.js 的 selectSong() 函數中載入
const melodyFileInput = document.getElementById('melodyFile');
if (melodyFileInput) {
    melodyFileInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
            melodyTemplate = await analyzeMelody(e.target.files[0]);
            renderPianoRoll();
        }
    });
}

const accompFileInput = document.getElementById('accompFile');
if (accompFileInput) {
    accompFileInput.addEventListener('change', async (e) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const accompProgress = document.getElementById('accompProgress');
        const accompStatus = document.getElementById('accompStatus');
        const audioFile = e.target.files[0];

        // 檢查檔案大小 (移動裝置記憶體限制)
        if (audioFile.size > 50 * 1024 * 1024) {
            if (accompStatus) {
                accompStatus.textContent = '✗ 檔案太大 (超過 50MB)';
                accompStatus.classList.add('error');
            }
            const statusText = document.getElementById('statusText');
            if (statusText) statusText.innerText = '狀態:伴奏檔案太大，請使用較小的檔案';
            return;
        }

        try {
            if (accompProgress) accompProgress.style.display = 'block';
            if (accompStatus) {
                accompStatus.textContent = '讀取檔案中...';
                accompStatus.classList.remove('error', 'success');
            }
            updateProgress('accompProgressFill', 'accompProgressText', 10);

            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }

            // 使用 FileReader 提高相容性
            const arrayBuffer = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(new Error('檔案讀取失敗'));
                reader.readAsArrayBuffer(audioFile);
            });

            updateProgress('accompProgressFill', 'accompProgressText', 40);
            if (accompStatus) accompStatus.textContent = '解碼音訊中...';

            // 添加錯誤處理的音訊解碼
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

            updateProgress('accompProgressFill', 'accompProgressText', 100);
            if (accompStatus) {
                accompStatus.textContent = '✓ 伴奏就緒！';
                accompStatus.classList.add('success');
            }
            const statusText = document.getElementById('statusText');
            if (statusText) statusText.innerText = "狀態：伴奏就緒，點擊開始測試！";
        } catch (error) {
            console.error('伴奏載入錯誤:', error);
            if (accompStatus) {
                accompStatus.textContent = `✗ 載入失敗: ${error.message}`;
                accompStatus.classList.add('error');
            }
            const statusText = document.getElementById('statusText');
            if (statusText) statusText.innerText = '狀態：伴奏載入失敗，請檢查檔案格式';
        }
    });
}

// 測試麥克風功能
let testMicStream = null;
let testMicAnalyser = null;
let isTesting = false;

const testMicBtn = document.getElementById('testMicBtn');
if (testMicBtn) {
    testMicBtn.addEventListener('click', async () => {
        const statusText = document.getElementById('statusText');

        if (isTesting) {
            // 停止測試
            if (testMicStream) {
                testMicStream.getTracks().forEach(t => t.stop());
                testMicStream = null;
            }
            isTesting = false;
            testMicBtn.textContent = '測試麥克風';
            testMicBtn.style.background = '#3273dc';
            if (statusText) statusText.innerText = "狀態：麥克風測試已停止";
            return;
        }

    // 開始測試
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') await audioCtx.resume();

        // 使用針對不同瀏覽器的優化策略
        let audioConfigs;

        if (isChrome && isMobile) {
            // Chrome on iPad: 使用單一最簡配置
            audioConfigs = [
                {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 44100
                }
            ];
        } else if (isSafari && isMobile) {
            // Safari on iPad: 優先嘗試基本配置
            audioConfigs = [
                true,
                {
                    channelCount: 1,
                    sampleRate: 44100,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            ];
        } else {
            // 桌面瀏覽器
            audioConfigs = [
                true,
                {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            ];
        }

        let streamObtained = false;
        let lastError = null;
        for (const config of audioConfigs) {
            try {
                testMicStream = await navigator.mediaDevices.getUserMedia({ audio: config });
                streamObtained = true;
                console.log('測試麥克風成功,配置:', typeof config === 'boolean' ? 'basic' : config);
                break;
            } catch (configErr) {
                console.warn('配置失敗:', configErr.message);
                lastError = configErr;
            }
        }

        if (!streamObtained) {
            const errorMsg = lastError ? lastError.message : '未知錯誤';
            const errorName = lastError ? lastError.name : '';

            let helpText = '';
            if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
                helpText = '\n\n請確認：\n1. 已授予麥克風權限\n2. 瀏覽器設定中允許此網站使用麥克風\n3. 若使用 iPad，請在「設定 > Safari > 麥克風」中允許存取';
            } else if (errorName === 'NotFoundError') {
                helpText = '\n\n找不到麥克風裝置，請檢查：\n1. 麥克風是否已連接\n2. 系統設定中是否已啟用麥克風';
            } else if (errorName === 'NotSupportedError' || errorName === 'TypeError') {
                helpText = '\n\n請使用 HTTPS 或 localhost 來訪問此網站\n麥克風功能需要安全連線';
            }

            throw new Error(`無法開啟麥克風\n錯誤: ${errorMsg}${helpText}`);
        }

        const micSource = audioCtx.createMediaStreamSource(testMicStream);
        testMicAnalyser = audioCtx.createAnalyser();
        testMicAnalyser.fftSize = 2048;
        testMicAnalyser.smoothingTimeConstant = 0.8;
        micSource.connect(testMicAnalyser);

        isTesting = true;
        testMicBtn.textContent = '停止測試';
        testMicBtn.style.background = '#f14668';
        if (statusText) statusText.innerText = "狀態：麥克風測試中 - 請唱歌或說話，觀察音量和音高顯示";

        testMicLoop();
    } catch (err) {
        console.error('麥克風測試錯誤:', err);
        alert(`無法開啟麥克風: ${err.message}\n請檢查權限`);
    }
    });
}

function testMicLoop() {
    if (!isTesting) return;

    const dataArray = new Float32Array(testMicAnalyser.fftSize);
    testMicAnalyser.getFloatTimeDomainData(dataArray);
    const { pitch, clarity, rms } = autoCorrelate(dataArray, audioCtx.sampleRate, true);

    // 更新音量顯示
    updateVolumeMeter(rms);

    requestAnimationFrame(testMicLoop);
}

// 4. 開始與停止邏輯 (加入麥克風啟動和錄音功能)
const startBtn = document.getElementById('startBtn');
if (startBtn) {
    startBtn.addEventListener('click', async () => {
    if (!accompBuffer) {
        alert('請先上傳伴奏音檔');
        return;
    }

    if (melodyTemplate.length === 0) {
        alert('請先上傳 MIDI 主旋律檔案');
        return;
    }

    if (isPlaying) return;

    // 詢問是否需要錄音
    const wantToRecord = confirm('是否要錄製這次演唱?\n錄音將包含伴奏和您的歌聲。');

    // 確保 AudioContext 處於運行狀態
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }

    // Chrome on iPad 需要額外的 resume 確認
    if (isChrome && isMobile) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }
    }

    // Safari on iPad: 需要用戶互動來首次啟動麥克風
    // 如果還沒有測試過麥克風，先自動初始化一次
    if (isSafari && isMobile && !testMicStream && !micStream) {
        try {
            const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // 立即停止，只是為了獲取權限和初始化
            tempStream.getTracks().forEach(t => t.stop());
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
            console.warn('Safari 麥克風預初始化失敗:', err);
        }
    }

    // 啟動麥克風 - 使用針對不同瀏覽器的優化策略
    try {
        // Chrome 和 Safari 在 iPad 上需要不同的音頻配置策略
        let audioConfigs;

        if (isChrome && isMobile) {
            // Chrome on iPad: 使用單一最簡配置
            audioConfigs = [
                {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 44100
                }
            ];
        } else if (isSafari && isMobile) {
            // Safari on iPad: 優先嘗試帶 deviceId 的配置以支援外接設備
            audioConfigs = [
                // 配置 1: 基本配置
                true,
                // 配置 2: 明確要求單聲道和基本採樣率
                {
                    channelCount: 1,
                    sampleRate: 44100,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            ];
        } else {
            // 桌面瀏覽器
            audioConfigs = [
                true,
                {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            ];
        }

        let micStreamObtained = false;
        let lastError = null;
        for (const config of audioConfigs) {
            try {
                micStream = await navigator.mediaDevices.getUserMedia({ audio: config });
                micStreamObtained = true;
                console.log('成功使用麥克風配置:', typeof config === 'boolean' ? 'basic' : config);
                break;
            } catch (configErr) {
                console.warn('配置失敗,嘗試下一個:', configErr.message);
                lastError = configErr;
            }
        }

        if (!micStreamObtained) {
            const errorMsg = lastError ? lastError.message : '未知錯誤';
            const errorName = lastError ? lastError.name : '';

            let helpText = '';
            if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
                helpText = '\n\n請確認：\n1. 已授予麥克風權限\n2. 瀏覽器設定中允許此網站使用麥克風\n3. 若使用 iPad，請在「設定 > Safari > 麥克風」中允許存取';
            } else if (errorName === 'NotFoundError') {
                helpText = '\n\n找不到麥克風裝置，請檢查：\n1. 麥克風是否已連接\n2. 系統設定中是否已啟用麥克風';
            } else if (errorName === 'NotSupportedError' || errorName === 'TypeError') {
                helpText = '\n\n請使用 HTTPS 或 localhost 來訪問此網站\n麥克風功能需要安全連線';
            }

            throw new Error(`所有音頻配置均失敗\n錯誤: ${errorMsg}${helpText}`);
        }

        const micSource = audioCtx.createMediaStreamSource(micStream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        micSource.connect(analyser);
    } catch (err) {
        console.error('麥克風錯誤:', err);
        alert(`無法開啟麥克風: ${err.message}\n請檢查權限設定`);
        return;
    }

    // 重置
    userPitchData = [];
    accuracyScores = [];
    noteScores = {}; // 重置音符評分記錄
    pitchHistory = []; // 重置音高歷史
    document.getElementById('resultsPanel').style.display = 'none';

    // 建立伴奏播放源
    sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = accompBuffer;

    // 如果需要錄音，設置混音和錄音器
    if (wantToRecord) {
        try {
            const destination = audioCtx.createMediaStreamDestination();
            sourceNode.connect(destination);

            const micSource = audioCtx.createMediaStreamSource(micStream);
            micSource.connect(destination);
            mixedStream = destination.stream;

            // 檢查 MediaRecorder 支援的格式
            const mimeTypes = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/ogg;codecs=opus',
                'audio/mp4'
            ];

            let selectedMimeType = '';
            for (const mimeType of mimeTypes) {
                if (MediaRecorder.isTypeSupported(mimeType)) {
                    selectedMimeType = mimeType;
                    break;
                }
            }

            if (!selectedMimeType) {
                throw new Error('瀏覽器不支援任何錄音格式');
            }

            recordedChunks = [];
            mediaRecorder = new MediaRecorder(mixedStream, { mimeType: selectedMimeType });

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                saveRecording();
            };

            mediaRecorder.start();
            isRecording = true;
        } catch (err) {
            console.error('錄音設置錯誤:', err);
            alert(`錄音功能啟動失敗: ${err.message}\n將繼續測試但不錄音`);
        }
    }

    // 連接伴奏到揚聲器
    sourceNode.connect(audioCtx.destination);

    // 監聽播放結束事件
    sourceNode.onended = () => {
        if (isPlaying) {
            isPlaying = false;
            if (micStream) micStream.getTracks().forEach(t => t.stop());

            // 停止錄音
            if (isRecording && mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                isRecording = false;
            }

            document.getElementById('statusText').innerText = "狀態：測試完成！";
            displayResults();
        }
    };

    // Chrome on iPad: 需要在播放前再次確認 AudioContext 狀態
    if (isChrome && isMobile && audioCtx.state === 'suspended') {
        await audioCtx.resume();
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    // 開始播放
    sourceNode.start(0);
    startTime = audioCtx.currentTime;
    testStartTimestamp = Date.now(); // 記錄測試開始時間
    isPlaying = true;

    // Safari on iPad: 確保播放開始後 context 保持活躍
    if (isSafari && isMobile) {
        setTimeout(() => {
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
        }, 100);
    }

    const recordingStatus = wantToRecord ? '(錄音中)' : '';
    const statusText = document.getElementById('statusText');
    if (statusText) statusText.innerText = `狀態：正在測試音準... ${recordingStatus}`;

    // 診斷輸出
    console.log('開始測試，melodyTemplate 長度:', melodyTemplate.length);
    console.log('Canvas 尺寸:', canvas.width, 'x', canvas.height);
    console.log('伴奏時長:', accompBuffer.duration, '秒');

    update();
    });
}

const stopBtn = document.getElementById('stopBtn');
if (stopBtn) {
    stopBtn.addEventListener('click', () => {
    if (sourceNode) sourceNode.stop();
    if (micStream) micStream.getTracks().forEach(t => t.stop());

    // 停止錄音
    if (isRecording && mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        isRecording = false;
    }

    isPlaying = false;
    const statusText = document.getElementById('statusText');
    if (statusText) statusText.innerText = "狀態：測試停止";

    if (accuracyScores.length > 0) {
        displayResults();
    }
    });
}

// 更新音量監控顯示
function updateVolumeMeter(rms) {
    const volumeMeter = document.getElementById('volumeMeter');
    const volumeText = document.getElementById('volumeText');

    // 將 RMS 轉換為百分比 (0.0 - 0.3 對應 0% - 100%)
    const volumePercent = Math.min(100, (rms / 0.3) * 100);

    if (volumeMeter && volumeText) {
        volumeMeter.style.width = `${volumePercent}%`;
        volumeText.textContent = `${Math.round(volumePercent)}%`;
    }
}

// 5. 每幀更新邏輯 (包含即時音準偵測)
function update() {
    if (!isPlaying) return;

    const now = audioCtx.currentTime - startTime;

    // 即時偵測麥克風音高
    const dataArray = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(dataArray);
    const { pitch: rawPitch, clarity, rms } = autoCorrelate(dataArray, audioCtx.sampleRate, true); // true = 即時輸入模式

    // 更新音量監控
    updateVolumeMeter(rms);

    // 使用平滑處理減少抖動
    const pitch = smoothPitch(rawPitch);

    // 降低過濾條件以提高靈敏度
    if (pitch > 0 && pitch >= 80 && pitch <= 1000 && clarity > 0.85) {
        const midiNote = 69 + 12 * Math.log2(pitch / 440);

        // 找到目標音符
        const targetNote = findTargetNote(now);

        let accuracy = 0;
        if (targetNote) {
            const deviation = calculateDeviation(midiNote, targetNote.note);
            accuracy = calculateAccuracy(deviation);

            // 將分數對應到對應的音符
            const targetNoteIndex = melodyTemplate.findIndex(n => n === targetNote);
            if (targetNoteIndex >= 0) {
                if (!noteScores[targetNoteIndex]) {
                    noteScores[targetNoteIndex] = [];
                }
                noteScores[targetNoteIndex].push(accuracy);
            }

            // 仍然記錄所有採樣點用於計算整體平均準確率
            accuracyScores.push(accuracy);

            // 更新即時指示器
            updateAccuracyMeter(deviation, midiNote, targetNote.note);

            // 只記錄準確度在合理範圍內的音符
            if (accuracy > 0) {
                userPitchData.push({ time: now, note: midiNote, accuracy: accuracy });
            }
        } else {
            // 沒有目標音符時，只更新指示器，不記錄數據
            updateAccuracyMeter(0, midiNote, null);
        }
    }

    renderPianoRoll(now);
    requestAnimationFrame(update);
}
