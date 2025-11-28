import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  BookOpen, Camera, Search, RefreshCw, Volume2, 
  Brain, BarChart3, Plus, X, Check, 
  ChevronDown, ChevronUp, Calendar as CalendarIcon, Trophy, Zap, AlertCircle, Trash2, ArrowRight, PenTool, Layers, PieChart, CheckSquare, Square, Link2, ChevronLeft, ChevronRight, Medal, Play, RotateCcw, Settings, Globe, TrendingUp, Clock, Quote
} from 'lucide-react';

import { initializeApp } from "firebase/app";
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken,
  GoogleAuthProvider, linkWithPopup
} from "firebase/auth";
import { 
  getFirestore, collection, doc, addDoc, 
  onSnapshot, query, orderBy, deleteDoc, updateDoc, 
  serverTimestamp, Timestamp 
} from "firebase/firestore";

// ========= Firebase 設定 =========
const firebaseConfig = {
  apiKey: "AIzaSyBGw5rmXDfeZve5LXVwASyt7gbf3VUsPts",
  authDomain: "japanese-learn-5d44c.firebaseapp.com",
  projectId: "japanese-learn-5d44c",
  storageBucket: "japanese-learn-5d44c.firebasestorage.app",
  messagingSenderId: "20086189278",
  appId: "1:20086189278:web:bac10b0c806c1e6f27264f",
  measurementId: "G-39VCBVXFK9"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = (typeof __app_id !== 'undefined') ? __app_id : 'default-app-id';

// --- Constants ---
const SRS_INTERVALS = [1, 3, 7, 14, 30, 90]; 
const DAILY_GOAL = 50; 

const DAILY_QUOTES = [
  "千里之行，始於足下。",
  "每天進步一點點，一年後就是巨大的飛躍。",
  "學而不思則罔，思而不學則殆。",
  "継続は力なり (持續就是力量)。",
  "失敗是成功之母，別怕犯錯。",
  "學習語言是為了遇見更廣闊的世界。",
  "今天的努力，是為了明天更好的自己。",
  "雨垂れ石を穿つ (滴水穿石)。",
  "不要小看累積的力量。",
  "保持好奇心，世界會給你驚喜。",
  "七転び八起き (七轉八起，百折不撓)。",
  "學習沒有捷徑，只有堅持。",
  "你的努力，時間都看在眼裡。",
  "初心忘るべからず (莫忘初衷)。",
  "相信自己，你比想像中更強大。",
  "休息是為了走更長遠的路。",
  "塵も積もれば山となる (積少成多)。",
  "享受學習的過程，而不只是結果。",
  "每一個單字，都是通往新世界的鑰匙。",
  "石の上にも三年 (只要堅持，終會成功)。",
  "今天的你比昨天更進步了嗎？",
  "不要和別人比，和昨天的自己比。",
  "案ずるより産むが易し (船到橋頭自然直)。",
  "專注當下，未來自然會來。",
  "用語言連結人心。",
  "學習是給自己最好的禮物。",
  "笑う門には福来たる (笑口常開，好運自來)。",
  "堅持到底，風景會很不一樣。",
  "慢慢來，比較快。",
  "你已經做得很好了，繼續加油！"
];

// --- Utilities ---
const sanitizeData = (data, id) => ({
  id: id || data?.id || '',
  word: data?.word || '未知',
  reading: data?.reading || '',
  meaning: data?.meaning || '',
  nuance: data?.nuance || '無詳細說明',
  partOfSpeech: data?.partOfSpeech || '未分類',
  jlpt: data?.jlpt || '', 
  related: Array.isArray(data?.related) ? data.related : [],
  tags: Array.isArray(data?.tags) ? data.tags : [],
  examples: Array.isArray(data?.examples) ? data.examples : [],
  collocations: Array.isArray(data?.collocations) ? data.collocations : [],
  level: typeof data?.level === 'number' ? data.level : 0,
  nextReview: data?.nextReview?.toDate ? data.nextReview.toDate() : new Date(),
  createdAt: data?.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
});

const speak = (text) => {
  if (!text) return;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = 0.9; 
  window.speechSynthesis.speak(utterance);
};

const calculateStreak = (dates) => {
  if (!dates || dates.length === 0) return 0;
  const sortedDates = [...new Set(dates)].sort((a, b) => new Date(b) - new Date(a));
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  if (sortedDates[0] !== today && sortedDates[0] !== yesterday) return 0;

  let streak = 1;
  let currentDate = new Date(sortedDates[0]);

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const checkDate = prevDate.toISOString().split('T')[0];
    
    if (sortedDates[i] === checkDate) {
      streak++;
      currentDate = prevDate;
    } else {
      break;
    }
  }
  return streak;
};

// --- Gemini API ---
const callGemini = async (prompt, imageBase64 = null) => {
  const apiKey = "AIzaSyBbJHcozBA47Bg8v6KBY5FMRkwtbJXfhuI";
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

  const parts = [{ text: prompt }];
  if (imageBase64) parts.push({ inlineData: { mimeType: "image/png", data: imageBase64 } });
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};

// --- UI Components ---
const Toast = ({ msg, type, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = { success: 'bg-stone-800', error: 'bg-red-500', info: 'bg-amber-500' };
  return (
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-xl text-white font-medium z-[100] flex items-center gap-2 ${colors[type] || colors.info}`}>
      {type === 'error' ? <AlertCircle size={18} /> : <Check size={18} />} {msg}
    </div>
  );
};

const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-stone-900/40 z-[90] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <h3 className="text-xl font-bold text-stone-800 mb-2">{title}</h3>
        <p className="text-stone-500 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-stone-500 font-bold hover:bg-stone-50 rounded-xl">取消</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-red-500 text-white font-bold hover:bg-red-600 rounded-xl shadow-lg shadow-red-200">確定刪除</button>
        </div>
      </div>
    </div>
  );
};

// --- Stats Component ---
const StatsView = ({ vocabList, activityLogs, handleLinkGoogle }) => {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date()); 
  const [selectedDate, setSelectedDate] = useState(today.toISOString().split('T')[0]); 
  
  const statsByDate = useMemo(() => {
    const stats = {};
    activityLogs.forEach(log => {
      const date = log.date;
      if (!stats[date]) stats[date] = { add: 0, review: 0, correct: 0, wrong: 0 };
      if (log.type === 'add') stats[date].add++;
      if (log.type === 'review') {
        stats[date].review++;
        if (log.result === 'correct') stats[date].correct++;
        else if (log.result === 'wrong') stats[date].wrong++;
      }
    });
    return stats;
  }, [activityLogs]);

  const changeMonth = (offset) =>
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));

  const currentStats = statsByDate[selectedDate] || { add: 0, review: 0, correct: 0, wrong: 0 };
  const correctRate =
    currentStats.review > 0
      ? Math.round((currentStats.correct / currentStats.review) * 100)
      : 0;

  const totalWords = vocabList.length;
  const activeDays = new Set(activityLogs.map(l => l.date)).size;
  const streak = useMemo(
    () => calculateStreak(activityLogs.map(l => l.date)),
    [activityLogs]
  );

  const quoteIndex = useMemo(
    () => today.getDate() % DAILY_QUOTES.length,
    [today]
  );
  const dailyQuote = DAILY_QUOTES[quoteIndex];

  return (
    <div className="space-y-6 pb-20">
      {/* 總覽卡片 + 今日小語 */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100 relative overflow-hidden">
        <div className="flex justify-between items-start mb-4 relative z-10">
          <div>
            <div className="text-sm text-stone-400 font-medium mb-1">累計學詞</div>
            <div className="text-5xl font-bold text-stone-800 tracking-tight">
              {totalWords}
            </div>
          </div>

          <div className="flex flex-col items-end pl-4 flex-1">
            <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 flex items-center gap-1 bg-stone-50 px-2 py-0.5 rounded-full">
              <Quote size={10} className="fill-current" />
              今日小語
            </div>
            <div
              className="text-sm text-stone-600 italic leading-relaxed text-right"
              style={{ textWrap: "balance" }}
            >
              「{dailyQuote}」
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-stone-100 pt-6 relative z-10">
          <div className="text-center">
            <div className="text-xs text-stone-400 mb-1">累計天數</div>
            <div className="text-2xl font-bold text-stone-700">{activeDays}</div>
          </div>
          <div className="text-center border-l border-stone-100">
            <div className="text-xs text-stone-400 mb-1">連續天數</div>
            <div className="text-2xl font-bold text-stone-700">{streak}</div>
          </div>
        </div>

        <div className="absolute -top-6 -right-6 w-24 h-24 bg-amber-50 rounded-full opacity-50 z-0" />
      </div>

      {/* Calendar */}
      <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => changeMonth(-1)}
            className="p-2 hover:bg-stone-100 rounded-full text-stone-400"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-bold text-stone-700">
            {viewDate.getFullYear()}年 {viewDate.getMonth() + 1}月
          </h2>
          <button
            onClick={() => changeMonth(1)}
            className="p-2 hover:bg-stone-100 rounded-full text-stone-400"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center mb-2 text-xs font-bold text-stone-400">
          <div>日</div>
          <div>月</div>
          <div>火</div>
          <div>水</div>
          <div>木</div>
          <div>金</div>
          <div>土</div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay() }).map(
            (_, i) => <div key={`e-${i}`} />
          )}
          {Array.from({
            length: new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate()
          }).map((_, i) => {
            const d = i + 1;
            const dateStr = `${viewDate.getFullYear()}-${String(
              viewDate.getMonth() + 1
            ).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const hasMedal = (statsByDate[dateStr]?.correct || 0) >= DAILY_GOAL;
            const isSelected = dateStr === selectedDate;
            const todayStr = today.toISOString().split("T")[0];

            return (
              <div
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`h-12 flex flex-col items-center justify-center rounded-xl cursor-pointer ${
                  isSelected
                    ? "bg-stone-800 text-white"
                    : "hover:bg-stone-100 text-stone-700"
                } ${
                  dateStr === todayStr && !isSelected
                    ? "border-2 border-amber-400 text-amber-600"
                    : ""
                }`}
              >
                <span className="text-sm">{d}</span>
                {hasMedal && (
                  <div className="bg-amber-100 rounded-full p-0.5 mt-0.5">
                    <Medal
                      size={8}
                      className="text-amber-500 fill-amber-500"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily Detail */}
      <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm">
        <div className="flex justify-between items-center mb-6 border-b border-stone-100 pb-4">
          <h3 className="text-xl font-bold text-stone-800">{selectedDate}</h3>
          {currentStats.correct >= DAILY_GOAL && (
            <span className="bg-amber-100 text-amber-600 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <Trophy size={12} /> 目標達成
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4 mb-8 text-center">
          <div className="p-3 bg-stone-50 rounded-2xl">
            <div className="text-stone-400 text-xs mb-1">新學</div>
            <div className="text-xl font-bold text-stone-700">
              {currentStats.add}
            </div>
          </div>
          <div className="p-3 bg-amber-50 rounded-2xl">
            <div className="text-amber-400 text-xs mb-1">複習</div>
            <div className="text-xl font-bold text-amber-600">
              {currentStats.review}
            </div>
          </div>
          <div className="p-3 bg-stone-50 rounded-2xl">
            <div className="text-stone-400 text-xs mb-1">正確率</div>
            <div className="text-xl font-bold text-stone-700">
              {correctRate}%
            </div>
          </div>
        </div>
      </div>

      {/* 帳號綁定區域 - 移到這裡了 */}
      <div className="mt-8 p-6 bg-white rounded-3xl border border-stone-100 text-center shadow-sm">
        <h3 className="text-stone-800 font-bold mb-2 flex items-center justify-center gap-2">
          <Settings size={18} /> 帳號設定
        </h3>
        <p className="text-sm text-stone-400 mb-4 leading-relaxed">
          綁定 Google 帳號，防止資料遺失，<br/>並可在不同裝置同步。
        </p>
        <button
          onClick={handleLinkGoogle}
          className="w-full py-3 bg-white border-2 border-stone-200 text-stone-600 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-stone-50 hover:border-amber-400 hover:text-amber-600 transition-all"
        >
          {/* Google Icon */}
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          綁定 Google 帳號
        </button>
      </div>
    </div>
  );
};

// --- VOCAB CARD ---
const VocabCard = ({ item, onRequestDelete, onAnalyzeRelated }) => {
  const [expanded, setExpanded] = useState(false);
  const levelColors = [
    "border-stone-200",
    "border-stone-300",
    "border-amber-200",
    "border-amber-300",
    "border-emerald-300",
    "border-emerald-500"
  ];

  const getJlptColor = (level) => {
    if (!level) return "bg-stone-100 text-stone-400 border-stone-200";
    const l = level.toUpperCase();
    if (l.includes("N1")) return "bg-red-50 text-red-600 border-red-200";
    if (l.includes("N2")) return "bg-orange-50 text-orange-600 border-orange-200";
    if (l.includes("N3")) return "bg-amber-50 text-amber-600 border-amber-200";
    if (l.includes("N4")) return "bg-emerald-50 text-emerald-600 border-emerald-200";
    if (l.includes("N5")) return "bg-blue-50 text-blue-600 border-blue-200";
    return "bg-stone-100 text-stone-500 border-stone-200";
  };

  return (
    <div className={`bg-white rounded-xl border-l-4 ${levelColors[item.level]} shadow-sm hover:shadow-md transition-all mb-3`}>
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="text-xl font-bold text-stone-800">{item.word}</h3>
              <span className="text-sm text-stone-400 font-jp">
                {item.reading}
              </span>

              <div className="flex gap-1 ml-1">
                {item.jlpt && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getJlptColor(
                      item.jlpt
                    )}`}
                  >
                    {item.jlpt}
                  </span>
                )}
                {item.partOfSpeech && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-stone-50 border-stone-200 text-stone-500">
                    {item.partOfSpeech}
                  </span>
                )}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  speak(item.word);
                }}
                className="text-stone-300 hover:text-amber-500 p-1 ml-auto sm:ml-0"
              >
                <Volume2 size={16} />
              </button>
            </div>
            <p className="text-stone-600 font-medium truncate">
              {item.meaning}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                item.level >= 5
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-stone-100 text-stone-400"
              }`}
            >
              Lv.{item.level}
            </span>
            {expanded ? (
              <ChevronUp size={18} className="text-stone-300" />
            ) : (
              <ChevronDown size={18} className="text-stone-300" />
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 bg-stone-50/50 pt-4 border-t border-stone-100 rounded-b-xl">
          <div className="bg-white p-4 rounded-xl border border-stone-200/60 shadow-sm relative overflow-hidden mb-4">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-300" />
            <span className="text-xs font-bold text-amber-500 uppercase tracking-wider block mb-2">
              語感筆記
            </span>
            <p className="text-stone-700 text-sm leading-relaxed">
              {item.nuance}
            </p>
          </div>

          {item.collocations && item.collocations.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Link2 size={12} />
                常見搭配
              </div>
              <div className="flex flex-wrap gap-2">
                {item.collocations.map((col, i) => (
                  <button
                    key={i}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAnalyzeRelated(col.ja);
                    }}
                    className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-600 hover:border-amber-300 hover:text-amber-700 hover:shadow-sm text-left"
                  >
                    <span className="font-bold text-stone-700">
                      {col.ja}
                    </span>{" "}
                    {col.zh}
                  </button>
                ))}
              </div>
            </div>
          )}

          {item.related && item.related.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">
                相關詞
              </div>
              <div className="flex flex-wrap gap-2">
                {item.related.map((r, i) =>
                  (r.ja || r.zh) ? (
                    <button
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAnalyzeRelated(r.ja);
                      }}
                      className="px-2 py-1 bg-white border border-stone-200 rounded text-xs text-stone-600 hover:border-amber-400"
                    >
                      <b>{r.ja}</b>{" "}
                      <span className="text-stone-300">|</span> {r.zh}
                    </button>
                  ) : null
                )}
              </div>
            </div>
          )}

          {item.examples && item.examples.length > 0 && (
            <div className="mb-2">
              <div className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">
                例句
              </div>
              <div className="space-y-2">
                {item.examples.map((ex, i) => (
                  <div
                    key={i}
                    className="pl-3 border-l-2 border-amber-200/50 py-1"
                  >
                    <div className="flex items-center gap-2 text-stone-700 text-sm font-jp">
                      {ex.ja}
                      <button
                        onClick={() => speak(ex.ja)}
                        className="text-stone-300 hover:text-amber-500"
                      >
                        <Volume2 size={12} />
                      </button>
                    </div>
                    <div className="text-xs text-stone-400 mt-0.5">
                      {ex.zh}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-stone-200/50 mt-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRequestDelete(item.id);
              }}
              className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
            >
              <Trash2 size={14} /> 刪除
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- QUIZ COMPONENT ---
const QuizView = ({ vocabList, onUpdateLevel }) => {
  const [status, setStatus] = useState('setup'); 
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]); 
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const [currentQuizData, setCurrentQuizData] = useState(null);
  const [currentOptions, setCurrentOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const timerRef = useRef(null);
  const dueCards = useMemo(
    () => vocabList
      .filter(v => new Date() > v.nextReview)
      .sort((a, b) => a.nextReview - b.nextReview),
    [vocabList]
  );

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const startQuiz = (count) => {
    let selected = dueCards.length > 0
      ? dueCards
      : [...vocabList].sort(() => 0.5 - Math.random());

    if (count !== 'all') selected = selected.slice(0, count);
    if (selected.length === 0) return; 

    setQueue(selected);
    setHistory(new Array(selected.length).fill(null)); 
    setCurrentIndex(0);
    setCurrentQuizData(null);
    setCurrentOptions([]);
    setStatus('active');
  };

  const generateQuestion = async (card) => {
    setLoading(true);
    let quiz = {
      sentence: `______ (${card.meaning})`,
      translation: card.meaning,
      explanation: card.nuance
    };
    let opts = [];

    try {
      const prompt = `
        Create a Japanese sentence using "${card.word}".
        Replace the word with "______".
        CRITICAL: Output Traditional Chinese (繁體中文) for translation and explanation.
        Output JSON: { 
          "sentence": "Japanese sentence with ______", 
          "translation": "Traditional Chinese translation",
          "explanation": "Why this word fits (Trad Chinese)" 
        }
      `;
      const res = await callGemini(prompt);
      if (res) quiz = res;

      let distractors = ["A", "B", "C"];
      const others = vocabList.filter(v => v.id !== card.id);
      if (others.length >= 3) {
        distractors = others
          .sort(() => 0.5 - Math.random())
          .slice(0, 3)
          .map(v => v.word);
      } else {
        const dRes = await callGemini(
          `3 random Japanese nouns similar to "${card.word}". JSON Array only.`
        );
        if (Array.isArray(dRes)) distractors = dRes;
      }

      opts = [
        { t: card.word, ok: true },
        ...distractors.map(t => ({ t, ok: false }))
      ].sort(() => 0.5 - Math.random());
    } catch (e) {
      console.error("Quiz Gen Error", e);
      opts = [
        { t: card.word, ok: true },
        { t: "其他", ok: false }
      ].sort(() => 0.5 - Math.random());
    }

    setCurrentQuizData(quiz);
    setCurrentOptions(opts);
    setLoading(false);
  };

  useEffect(() => {
    if (status !== 'active') return;
    if (history[currentIndex]) {
      return;
    }
    if (queue[currentIndex]) {
      generateQuestion(queue[currentIndex]);
    } else {
      setStatus('summary');
    }
  }, [currentIndex, status, queue, history]);

  const handleOptionClick = (idx) => {
    if (history[currentIndex]) return; 
    const isCorrect = currentOptions[idx].ok;
    
    const newHistory = [...history];
    newHistory[currentIndex] = {
      card: queue[currentIndex],
      quizData: currentQuizData,
      options: currentOptions,
      selected: idx,
      isCorrect
    };
    setHistory(newHistory);

    const card = queue[currentIndex];
    const newLvl = isCorrect
      ? Math.min(5, card.level + 1)
      : Math.max(0, card.level - 1);
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + SRS_INTERVALS[newLvl]);
    onUpdateLevel(card.id, newLvl, nextDate, isCorrect);

    if (isCorrect) {
      timerRef.current = setTimeout(() => {
        if (currentIndex < queue.length - 1) {
          setCurrentIndex(prev => prev + 1);
        } else {
          setStatus('summary');
        }
      }, 1200); 
    }
  };

  const goToNext = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (currentIndex < queue.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setStatus('summary');
    }
  };

  const goToPrev = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const quitQuiz = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus('setup');
    setQueue([]);
    setHistory([]);
    setCurrentIndex(0);
  };

  if (status === 'setup') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
        <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mb-6 text-stone-400">
          <Brain size={40} />
        </div>
        <h2 className="text-2xl font-bold text-stone-800 mb-2">
          準備好複習了嗎？
        </h2>
        <p className="text-stone-500 mb-8 text-center">
          目前有{" "}
          <span className="font-bold text-amber-500 text-lg">
            {dueCards.length}
          </span>{" "}
          個單字需要複習
        </p>

        <div className="grid grid-cols-1 w-full max-w-xs gap-3">
          <button
            onClick={() => startQuiz(10)}
            disabled={dueCards.length === 0}
            className="flex items-center justify-between px-6 py-4 bg-white border-2 border-stone-100 rounded-2xl hover:border-stone-800 hover:shadow-md transition-all disabled:opacity-50"
          >
            <span className="font-bold text-stone-700">10 題快問快答</span>
            <ArrowRight size={18} className="text-stone-300" />
          </button>
          <button
            onClick={() => startQuiz(20)}
            disabled={dueCards.length < 10}
            className="flex items-center justify-between px-6 py-4 bg-white border-2 border-stone-100 rounded-2xl hover:border-stone-800 hover:shadow-md transition-all disabled:opacity-50"
          >
            <span className="font-bold text-stone-700">20 題深入練習</span>
            <ArrowRight size={18} className="text-stone-300" />
          </button>
          <button
            onClick={() => startQuiz("all")}
            disabled={dueCards.length === 0}
            className="flex items-center justify-between px-6 py-4 bg-stone-800 text-white rounded-2xl hover:bg-stone-700 shadow-lg shadow-stone-200 transition-all disabled:opacity-50 disabled:shadow-none"
          >
            <span className="font-bold">複習全部 ({dueCards.length})</span>
            <Play size={18} className="fill-current" />
          </button>
        </div>
      </div>
    );
  }

  if (status === 'summary') {
    const correctCount = history.filter(h => h && h.isCorrect).length;
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center text-amber-500 mb-6 shadow-sm">
          <Trophy size={48} className="fill-amber-500" />
        </div>
        <h2 className="text-3xl font-bold text-stone-800 mb-2">測驗完成！</h2>
        <p className="text-stone-400 mb-8">
          你答對了 {queue.length} 題中的{" "}
          <span className="text-stone-800 font-bold text-xl">
            {correctCount}
          </span>{" "}
          題
        </p>
        <button
          onClick={quitQuiz}
          className="px-8 py-3 bg-stone-800 text-white rounded-xl font-bold shadow-lg hover:bg-stone-700 transition-all flex items-center gap-2"
        >
          <RotateCcw size={18} /> 返回主頁
        </button>
      </div>
    );
  }

  const isReviewing = !!history[currentIndex];
  const activeData = isReviewing ? history[currentIndex].quizData : currentQuizData;
  const activeOptions = isReviewing ? history[currentIndex].options : currentOptions;
  const activeCard = queue[currentIndex];

  if (loading || !activeData) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-stone-400 gap-4">
        <div className="w-12 h-12 border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin" />
        <div className="text-sm font-bold tracking-widest uppercase">
          正在生成題目...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex flex-col pb-32 relative">
      <div className="flex justify-between items-center mb-8 px-2">
        <button
          onClick={quitQuiz}
          className="text-stone-400 hover:text-red-400 p-2 -ml-2"
        >
          <X size={20} />
        </button>
        <div className="text-xs font-bold text-stone-300 tracking-widest uppercase">
          第 {currentIndex + 1} 題 / 共 {queue.length} 題
        </div>
        <div className="w-8" />
      </div>

      <div className="text-center px-4 mb-8">
        <div className="text-2xl font-bold text-stone-800 leading-relaxed font-jp mb-6">
          {activeData.sentence.split("______").map((part, i, arr) => (
            <React.Fragment key={i}>
              {part}
              {i < arr.length - 1 && (
                <span
                  className={`inline-block mx-1 min-w-[60px] border-b-2 text-center transition-colors px-2 font-bold ${
                    isReviewing
                      ? history[currentIndex].isCorrect
                        ? "border-emerald-400 text-emerald-600"
                        : "border-red-400 text-red-500"
                      : "border-stone-300 text-transparent"
                  }`}
                >
                  {isReviewing ? activeCard.word : "___"}
                </span>
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="min-h-[2rem] transition-all duration-300">
          {isReviewing ? (
            <div className="inline-block bg-stone-100 text-stone-600 px-4 py-2 rounded-xl text-sm font-medium">
              {activeData.translation}
            </div>
          ) : (
            <div className="text-stone-300 text-xs tracking-widest uppercase pt-2">
              請選出正確的單字
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 mb-4 relative z-10 px-2">
        {activeOptions.map((opt, i) => {
          let btnClass =
            "bg-white border-stone-100 text-stone-600 hover:border-stone-300 hover:bg-stone-50";
          if (isReviewing) {
            const selected = history[currentIndex].selected;
            if (opt.ok)
              btnClass =
                "bg-emerald-50 border-emerald-400 text-emerald-700 shadow-sm";
            else if (selected === i && !opt.ok)
              btnClass =
                "bg-red-50 border-red-400 text-red-700 opacity-60";
            else
              btnClass =
                "opacity-40 border-stone-100 grayscale";
          }

          return (
            <button
              key={i}
              disabled={isReviewing}
              onClick={() => handleOptionClick(i)}
              className={`w-full p-4 rounded-xl border-2 text-lg font-bold font-jp transition-all relative ${btnClass}`}
            >
              {opt.t}
              {isReviewing && opt.ok && (
                <Check className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-600" />
              )}
              {isReviewing &&
                !opt.ok &&
                history[currentIndex].selected === i && (
                  <X className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500" />
                )}
            </button>
          );
        })}
      </div>

      {isReviewing && (
        <div className="mt-4 bg-stone-50 p-6 rounded-3xl border border-stone-100 relative z-20 shadow-xl shadow-stone-100/50">
          <div className="flex items-start gap-3 mb-6">
            <div className="bg-amber-100 p-2 rounded-full shrink-0 text-amber-500 mt-1">
              <Zap size={18} className="fill-current" />
            </div>
            <div className="text-sm text-stone-600 leading-relaxed">
              <span className="font-bold text-stone-800 block mb-1 text-base">
                解析
              </span>
              {activeData.explanation}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={goToPrev}
              disabled={currentIndex === 0}
              className="flex-1 py-3 bg-white border border-stone-200 text-stone-500 rounded-xl font-bold hover:bg-stone-50 disabled:opacity-30 disabled:hover:bg-white transition-colors flex items-center justify-center gap-2"
            >
              <ChevronLeft size={18} />
              上一題
            </button>
            {currentIndex < queue.length - 1 ? (
              <button
                onClick={goToNext}
                className="flex-[2] py-3 bg-stone-800 text-white rounded-xl font-bold hover:bg-stone-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-stone-200"
              >
                下一題 <ArrowRight size={18} />
              </button>
            ) : (
              <button
                onClick={() => setStatus("summary")}
                className="flex-[2] py-3 bg-stone-800 text-white rounded-xl font-bold hover:bg-stone-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-stone-200"
              >
                查看結果 <Trophy size={18} />
              </button>
            )}
          </div>
        </div>
      )}

      {!isReviewing && currentIndex > 0 && (
        <div className="mt-auto pt-4 flex justify-center">
          <button
            onClick={goToPrev}
            className="text-stone-400 text-sm font-bold flex items-center gap-1 hover:text-stone-600 px-4 py-2 rounded-full hover:bg-stone-100 transition-all"
          >
            <ChevronLeft size={16} />
            檢查上一題
          </button>
        </div>
      )}
    </div>
  );
};

// --- MAIN LAYOUT ---
export default function App() {
  const [user, setUser] = useState(null);
  const [vocabList, setVocabList] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [view, setView] = useState('vocab'); 
  const [filter, setFilter] = useState('');
  const [toast, setToast] = useState(null);
  const [deleteData, setDeleteData] = useState({ open: false, id: null, title: '' });
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [batchList, setBatchList] = useState([]); 
  const [selectedBatch, setSelectedBatch] = useState(new Set());
  const fileRef = useRef(null);

  const currentStreak = useMemo(
    () => calculateStreak(activityLogs.map(l => l.date)),
    [activityLogs]
  );

  // --- Prompts ---
  const SINGLE_PROMPT = `
    Analyze this specific Japanese word/sentence. 
    Output a SINGLE JSON object.
    CRITICAL: All "meaning", "nuance", "zh" fields MUST be in Traditional Chinese (繁體中文).
    
    Structure:
    { 
      "word": "Kanji", 
      "reading": "Hiragana", 
      "meaning": "Trad Chinese meaning", 
      "partOfSpeech": "名詞/自動詞/他動詞/形容詞/副詞...", 
      "jlpt": "N1/N2/N3/N4/N5 (or Empty)",
      "nuance": "Detailed nuance explanation in Trad Chinese", 
      "related": [{"ja": "Related/Similar Word", "zh": "Trad Chinese meaning"}],
      "tags": ["tag1"], 
      "collocations": [{"ja":"Common Collocation", "zh":"Trad Chinese meaning"}], 
      "examples": [{"ja":"Example Sentence", "zh":"Trad Chinese translation"}] 
    }
  `;
  
  const BATCH_PROMPT = `
    Analyze this image and identify all valuable Japanese vocabulary words present.
    Output a JSON ARRAY of objects.
    CRITICAL: All "meaning", "nuance", "zh" fields MUST be in Traditional Chinese (繁體中文).
    
    Format:
    [
      { 
        "word": "Kanji", 
        "reading": "Hiragana", 
        "meaning": "Trad Chinese", 
        "partOfSpeech": "名詞/自動詞/他動詞...", 
        "jlpt": "N1/N2/N3/N4/N5",
        "nuance": "Short nuance in Trad Chinese", 
        "related": [{"ja": "Related", "zh": "Meaning"}],
        "tags": ["N3"], 
        "collocations": [{"ja":"Collocation", "zh":"Meaning"}], 
        "examples": [{"ja": "Example", "zh": "Translation"}] 
      }
    ]
  `;

  // --- Auth & Data Loading ---
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const vocabRef = collection(db, 'artifacts', appId, 'users', user.uid, 'japanese_vocab');
    const logsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'activity_logs');

    const unsubV = onSnapshot(
      query(vocabRef, orderBy('createdAt', 'desc')),
      (s) => setVocabList(s.docs.map(d => sanitizeData(d.data(), d.id)))
    );
    const unsubL = onSnapshot(
      query(logsRef, orderBy('timestamp', 'desc')),
      (s) => setActivityLogs(s.docs.map(d => d.data()))
    );
    return () => { unsubV(); unsubL(); };
  }, [user]);

  // --- Handlers ---
  const handleTextAnalyze = async (text) => {
    if (!text) return;
    setLoading(true);
    try {
      const data = await callGemini(`${SINGLE_PROMPT} Analyze: "${text}"`);
      setPreview(data); 
    } catch (e) {
      console.error(e);
      setToast({ msg: "分析失敗", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleFileAnalyze = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64 = String(reader.result).split(',')[1];
        const data = await callGemini(BATCH_PROMPT, base64);
        if (Array.isArray(data)) {
          setBatchList(data);
          setSelectedBatch(
            new Set(
              data
                .map((_, i) => i)
                .filter(i => !vocabList.some(v => v.word === data[i].word))
            )
          );
        } else {
          setPreview(data);
        }
      } catch (e) {
        console.error(e);
        setToast({ msg: "辨識失敗", type: "error" });
      } finally {
        setLoading(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAdd = async (data) => {
    if (!user) return;
    try {
      if (vocabList.some(v => v.word === data.word)) {
        setToast({ msg: "單字已存在", type: "info" });
        return;
      }
      const vocabRef = collection(db, 'artifacts', appId, 'users', user.uid, 'japanese_vocab');
      const logRef = collection(db, 'artifacts', appId, 'users', user.uid, 'activity_logs');
      await addDoc(vocabRef, {
        ...data,
        createdAt: serverTimestamp(),
        level: 0,
        nextReview: Timestamp.now()
      });
      await addDoc(logRef, {
        date: new Date().toISOString().split('T')[0],
        timestamp: serverTimestamp(),
        type: 'add'
      });
      setToast({ msg: "已加入筆記", type: "success" });
    } catch (e) {
      console.error(e);
      setToast({ msg: "錯誤", type: "error" });
    }
  };

  const handleUpdateLevel = async (id, level, date, isCorrect) => {
    if (!user) return;
    const vocabDoc = doc(db, 'artifacts', appId, 'users', user.uid, 'japanese_vocab', id);
    const logRef = collection(db, 'artifacts', appId, 'users', user.uid, 'activity_logs');
    await updateDoc(vocabDoc, {
      level,
      nextReview: Timestamp.fromDate(date)
    });
    await addDoc(logRef, {
      date: new Date().toISOString().split('T')[0],
      timestamp: serverTimestamp(),
      type: 'review',
      result: isCorrect ? 'correct' : 'wrong'
    });
  };

  // --- 綁定 Google 帳號功能 (Correct Location) ---
  const handleLinkGoogle = async () => {
    if (!user) return;
    try {
      const provider = new GoogleAuthProvider();
      await linkWithPopup(user, provider);
      setToast({ msg: "綁定成功！資料已同步", type: "success" });
    } catch (error) {
      console.error("Link Error:", error);
      if (error.code === 'auth/credential-already-in-use') {
        setToast({ msg: "此 Google 帳號已被其他資料使用", type: "error" });
      } else {
        setToast({ msg: "綁定失敗，請重試", type: "error" });
      }
    }
  };

  const filtered = useMemo(
    () => vocabList.filter(
      v => v.word.includes(filter) || v.meaning.includes(filter)
    ),
    [vocabList, filter]
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f5f2ed] flex justify-center items-center">
        <div className="w-full max-w-md text-center text-stone-400">
          載入中...
        </div>
      </div>
    );
  }  
  return (
    <div className="min-h-screen bg-[#f5f2ed] flex justify-center font-sans text-stone-800">
      {/* 中央 App 區域，固定在手機寬度 */}
      <div className="w-full max-w-md bg-[#fffdf8] pb-10">
        {/* Sticky Header */}
        <div className="sticky top-0 z-50 bg-[#fffdf8]/90 backdrop-blur-md border-b border-stone-200">
          <div className="px-4 pt-4 pb-0">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-stone-800 text-white rounded-lg flex items-center justify-center shadow-md">
                  <span className="font-bold text-lg">日</span>
                </div>
                <span className="font-bold text-stone-700 tracking-tight">
                  日文語感筆記
                </span>
              </div>
              <div className="text-xs font-bold text-stone-400 bg-white px-3 py-1 rounded-full border border-stone-100 shadow-sm">
                連續學習 {currentStreak} 天
              </div>
            </div>
            <div className="flex gap-6">
              {[
                { id: "vocab", label: "單字庫", icon: BookOpen },
                { id: "quiz", label: "測驗", icon: PenTool },
                { id: "stats", label: "統計", icon: PieChart }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setView(tab.id)}
                  className={`flex items-center gap-2 pb-3 text-sm font-bold border-b-2 transition-all ${
                    view === tab.id
                      ? "text-stone-800 border-amber-400"
                      : "text-stone-400 border-transparent hover:text-stone-600"
                  }`}
                >
                  <tab.icon size={16} /> {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
  
        {/* 主要內容區 */}
        <div className="px-4 py-6">
          {toast && (
            <Toast
              msg={toast.msg}
              type={toast.type}
              onClose={() => setToast(null)}
            />
          )}
  
          <ConfirmDialog
            isOpen={deleteData.open}
            title="刪除單字"
            message={`確定要刪除「${deleteData.title}」嗎？`}
            onConfirm={async () => {
              if (!user || !deleteData.id) return;
              await deleteDoc(
                doc(
                  db,
                  "artifacts",
                  appId,
                  "users",
                  user.uid,
                  "japanese_vocab",
                  deleteData.id
                )
              );
              setDeleteData({ open: false, id: null, title: "" });
              setToast({ msg: "已刪除", type: "success" });
            }}
            onCancel={() => setDeleteData({ open: false, id: null, title: "" })}
          />
  
          {/* Vocab View */}
          <div className={view === "vocab" ? "block" : "hidden"}>
            <div className="mb-6">
              <div className="flex gap-2 p-2 bg-white rounded-2xl shadow-sm border border-stone-200">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="輸入單字或點擊右側按鈕掃描..."
                  className="flex-1 px-4 py-2 bg-transparent outline-none text-stone-700 placeholder:text-stone-300"
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleTextAnalyze(input)
                  }
                />
  
                <button
                  onClick={() => {
                    if (input.trim()) handleTextAnalyze(input);
                    else fileRef.current?.click();
                  }}
                  disabled={loading}
                  className={`px-4 rounded-xl font-bold text-white transition-all flex items-center gap-2 ${
                    input.trim()
                      ? "bg-amber-600 hover:bg-amber-700 shadow-md"
                      : "bg-amber-400 hover:bg-amber-500"
                  }`}
                >
                  {loading ? (
                    <RefreshCw className="animate-spin" size={20} />
                  ) : input.trim() ? (
                    <>
                      <Plus size={20} />
                      <span className="hidden sm:inline">新增</span>
                    </>
                  ) : (
                    <>
                      <Camera size={20} />
                      <span className="hidden sm:inline">掃描</span>
                    </>
                  )}
                </button>
  
                <input
                  type="file"
                  ref={fileRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileAnalyze}
                />
              </div>
            </div>
  
            <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-stone-200 mb-6">
              <Search size={18} className="text-stone-400" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="搜尋你的筆記..."
                className="flex-1 bg-transparent outline-none text-stone-600 placeholder:text-stone-300 text-sm"
              />
            </div>
  
            <div className="space-y-4">
              {filtered.length === 0 ? (
                <div className="text-center py-20 text-stone-300">
                  <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
                  <p>尚無筆記</p>
                </div>
              ) : (
                filtered.map((item) => (
                  <VocabCard
                    key={item.id}
                    item={item}
                    onRequestDelete={(id) =>
                      setDeleteData({ open: true, id, title: item.word })
                    }
                    onAnalyzeRelated={handleTextAnalyze}
                  />
                ))
              )}
            </div>
          </div>
  
          {/* Quiz View */}
          <div className={view === "quiz" ? "block" : "hidden"}>
            <QuizView
              vocabList={vocabList}
              onUpdateLevel={handleUpdateLevel}
            />
          </div>
  
          {/* Stats View */}
          {view === "stats" && (
            <StatsView
              vocabList={vocabList}
              activityLogs={activityLogs}
              handleLinkGoogle={handleLinkGoogle} // Pass the handler
            />
          )}
        </div>
  
        {/* 單字預覽 Modal */}
        {preview && (
          <div className="fixed inset-0 bg-stone-900/40 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-stone-700 flex items-center gap-2">
                  <PenTool size={18} /> 預覽筆記
                </h3>
                <button
                  onClick={() => setPreview(null)}
                  className="p-2 bg-stone-100 rounded-full text-stone-400 hover:text-stone-600"
                >
                  <X size={18} />
                </button>
              </div>
  
              <div className="space-y-6">
                <div className="text-center pb-4 border-b border-stone-100">
                  <div className="text-4xl font-bold text-stone-800 mb-1">
                    {preview.word}
                  </div>
                  <div className="text-stone-400 font-jp text-lg mb-3">
                    {preview.reading}
                  </div>
  
                  <div className="flex justify-center gap-2">
                    {preview.jlpt && (
                      <span className="text-xs font-bold bg-stone-100 px-2 py-0.5 rounded text-stone-500">
                        {preview.jlpt}
                      </span>
                    )}
                    {preview.partOfSpeech && (
                      <span className="text-xs font-bold bg-stone-100 px-2 py-0.5 rounded text-stone-500">
                        {preview.partOfSpeech}
                      </span>
                    )}
                  </div>
                </div>
  
                <div className="bg-amber-50 p-5 rounded-2xl text-amber-900 border border-amber-100/50">
                  <div className="text-xs font-bold text-amber-400 mb-2 uppercase tracking-wider">
                    MEANING & NUANCE
                  </div>
                  <div className="mb-2">
                    <span className="font-bold text-lg mr-2">
                      {preview.meaning}
                    </span>
                  </div>
                  <div className="text-sm opacity-90">{preview.nuance}</div>
                </div>
  
                {preview.collocations && preview.collocations.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Link2 size={12} />
                      常見搭配
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {preview.collocations.map((col, i) => (
                        <span
                          key={i}
                          className="px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-600"
                        >
                          <span className="font-bold text-stone-700">
                            {col.ja}
                          </span>{" "}
                          {col.zh}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
  
                {preview.examples && preview.examples.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">
                      例句
                    </div>
                    <div className="space-y-2">
                      {preview.examples.map((ex, i) => (
                        <div
                          key={i}
                          className="pl-3 border-l-2 border-stone-200 py-1"
                        >
                          <div className="text-stone-700 text-sm font-jp">
                            {ex.ja}
                          </div>
                          <div className="text-xs text-stone-400 mt-0.5">
                            {ex.zh}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
  
                <button
                  onClick={async () => {
                    await handleAdd(preview);
                    setPreview(null);
                    setInput("");
                  }}
                  className="w-full py-4 bg-stone-800 text-white rounded-2xl font-bold hover:bg-stone-700 flex items-center justify-center gap-2"
                >
                  <Check size={20} /> 加入筆記
                </button>
              </div>
            </div>
          </div>
        )}
  
        {/* 批次匯入 Modal */}
        {batchList.length > 0 && (
          <div className="fixed inset-0 bg-stone-900/40 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl">
              <div className="p-6 pb-2">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-bold text-stone-700 flex items-center gap-2">
                    <Layers size={18} /> 批次匯入{" "}
                    <span className="bg-amber-100 text-amber-600 text-xs px-2 py-0.5 rounded-full">
                      {batchList.length}
                    </span>
                  </h3>
                  <button
                    onClick={() => setBatchList([])}
                    className="p-2 bg-stone-100 rounded-full text-stone-400 hover:text-stone-600"
                  >
                    <X size={18} />
                  </button>
                </div>
                <p className="text-sm text-stone-400 mb-4">
                  勾選想要加入單字庫的項目
                </p>
              </div>
  
              <div className="flex-1 overflow-y-auto px-6 space-y-3">
                {batchList.map((item, index) => {
                  const isSelected = selectedBatch.has(index);
                  const isExisting = vocabList.some(
                    (v) => v.word === item.word
                  );
                  return (
                    <div
                      key={index}
                      onClick={() => {
                        if (isExisting) return;
                        setSelectedBatch((prev) => {
                          const n = new Set(prev);
                          n.has(index) ? n.delete(index) : n.add(index);
                          return n;
                        });
                      }}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                        isExisting
                          ? "opacity-50 bg-stone-50 cursor-not-allowed"
                          : isSelected
                          ? "bg-amber-50 border-amber-300"
                          : "bg-white border-stone-200"
                      }`}
                    >
                      <div className="mt-1 text-stone-300">
                        {isExisting ? (
                          <Check size={20} />
                        ) : isSelected ? (
                          <CheckSquare
                            size={20}
                            className="text-amber-500"
                          />
                        ) : (
                          <Square size={20} />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-stone-800">
                          {item.word}
                        </div>
                        <div className="text-sm text-stone-600">
                          {item.meaning}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
  
              <div className="p-6 pt-4 border-t border-stone-100">
                <button
                  onClick={async () => {
                    setLoading(true);
                    for (const i of selectedBatch) {
                      await handleAdd(batchList[i]);
                    }
                    setBatchList([]);
                    setSelectedBatch(new Set());
                    setLoading(false);
                  }}
                  disabled={loading || selectedBatch.size === 0}
                  className="w-full py-4 bg-stone-800 text-white rounded-2xl font-bold hover:bg-stone-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <RefreshCw className="animate-spin" size={20} />
                  ) : (
                    <Check size={20} />
                  )}
                  匯入選取的 {selectedBatch.size} 個單字
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
  }