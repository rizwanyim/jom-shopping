import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, Plus, CheckCircle, Circle, LogOut, 
  Wallet, Tag, Trash2, Edit3, X, History, ShoppingBag,
  Sparkles, ArrowRight, Scale, Search, Moon, Sun, Minus, 
  ClipboardCheck, ListTodo, PieChart, CalendarCheck, FolderPlus, AlertTriangle
} from 'lucide-react';
import { 
  initializeApp 
} from 'firebase/app';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, doc, onSnapshot, setDoc, updateDoc, enableIndexedDbPersistence
} from 'firebase/firestore';

// --- Konfigurasi Firebase ---
// SILA GANTIKAN BLOK INI DENGAN KUNCI FIREBASE ANDA
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyD1-v5QTqf3C3aa-xUG8OPhAntDcMrfH2A",
  authDomain: "jom-shopping-af8ee.firebaseapp.com",
  projectId: "jom-shopping-af8ee",
  storageBucket: "jom-shopping-af8ee.firebasestorage.app",
  messagingSenderId: "334639480884",
  appId: "1:334639480884:web:b9a4786347e4ab44070a61"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Aktifkan Mod Luar Talian
try {
  enableIndexedDbPersistence(db).catch((err) => {
    console.warn("Mod Luar Talian gagal diaktifkan:", err.code);
  });
} catch (e) {
  console.warn("Ralat memulakan mod luar talian");
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'jom-shopping-app';

const KATEGORI_LALAI = [
  'Barang Basah',
  'Sayur & Buah',
  'Barangan Kering',
  'Keperluan Rumah',
  'Snek & Minuman',
  'Lain-lain'
];

export default function App() {
  const [user, setUser] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [loading, setLoading] = useState(true);

  // UI States Modal
  const [inputCode, setInputCode] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMasterModal, setShowMasterModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showManageListModal, setShowManageListModal] = useState(false);
  
  // State: Tab & Multi-List
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedListId, setSelectedListId] = useState('default');
  const [newListInput, setNewListInput] = useState('');

  // State: Dark Mode
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('jom-shopping-dark-mode');
      if (saved !== null) return JSON.parse(saved);
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // State: Popup Harga, Carian, Cuci Rekod
  const [priceModalItem, setPriceModalItem] = useState(null);
  const [priceInput, setPriceInput] = useState('');
  const [qtyInput, setQtyInput] = useState(1);
  const [searchMasterQuery, setSearchMasterQuery] = useState('');
  const [confirmClean, setConfirmClean] = useState(false);

  // State: Edit Sejarah
  const [editingMasterId, setEditingMasterId] = useState(null);
  const [editMasterName, setEditMasterName] = useState('');
  const [editMasterCategory, setEditMasterCategory] = useState('');

  // Form States
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState(KATEGORI_LALAI[0]);
  const [budgetInput, setBudgetInput] = useState('');

  // States: Perbandingan Harga
  const [compA, setCompA] = useState({ price: '', qty: '', unit: 'g' });
  const [compB, setCompB] = useState({ price: '', qty: '', unit: 'g' });

  useEffect(() => {
    localStorage.setItem('jom-shopping-dark-mode', JSON.stringify(isDarkMode));
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('room');
    if (roomFromUrl) {
      setRoomCode(roomFromUrl.toUpperCase());
      setInputCode(roomFromUrl.toUpperCase());
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Ralat Log Masuk:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !roomCode) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'jom_shopping_rooms', roomCode);
    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        setRoomData(docSnap.data());
      } else {
        const initialData = { 
          id: roomCode, budget: 0, budgets: { 'default': 0 }, 
          activeList: [], masterList: [], pastSessions: [], 
          lists: [{ id: 'default', name: 'Senarai Utama' }] 
        };
        setDoc(roomRef, initialData);
        setRoomData(initialData);
      }
    });
    return () => unsubscribe();
  }, [user, roomCode]);

  // --- Fungsi Asas Aplikasi ---
  const updateUrlWithRoom = (code) => {
    if (code) window.history.pushState(null, '', `?room=${code}`);
    else window.history.pushState(null, '', window.location.pathname);
  };

  const generateRoomCode = () => {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    setRoomCode(code);
    updateUrlWithRoom(code);
  };

  const joinRoom = (e) => {
    e.preventDefault();
    if (inputCode.trim()) {
      const code = inputCode.trim().toUpperCase();
      setRoomCode(code);
      updateUrlWithRoom(code);
    }
  };

  const leaveRoom = () => {
    setRoomCode('');
    setRoomData(null);
    setInputCode('');
    updateUrlWithRoom('');
  };

  const updateRoomData = async (newData) => {
    if (!roomCode) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'jom_shopping_rooms', roomCode);
    await updateDoc(roomRef, newData);
  };

  // --- PENGURUSAN MULTI-LIST ---
  const lists = roomData?.lists || [{ id: 'default', name: 'Senarai Utama' }];
  const currentListId = selectedListId || 'default';

  const addNewList = async (e) => {
    e.preventDefault();
    if (!newListInput.trim() || !roomData) return;
    const newListId = 'list_' + Date.now().toString();
    const newLists = [...lists, { id: newListId, name: newListInput.trim() }];
    
    const newBudgets = { ...(roomData.budgets || {}) };
    newBudgets[newListId] = 0; 

    await updateRoomData({ lists: newLists, budgets: newBudgets });
    setNewListInput('');
    setSelectedListId(newListId);
    setShowManageListModal(false);
  };

  const removeList = async (listId) => {
    if (listId === 'default' || !roomData) return;
    const newLists = lists.filter(l => l.id !== listId);
    const newActiveList = (roomData.activeList || []).filter(item => (item.listId || 'default') !== listId);
    
    const newBudgets = { ...(roomData.budgets || {}) };
    delete newBudgets[listId];
    
    await updateRoomData({ lists: newLists, activeList: newActiveList, budgets: newBudgets });
    if (selectedListId === listId) setSelectedListId('default');
  };

  // --- LOGIK ITEM & HARGA ---
  const addItem = async (e) => {
    e.preventDefault();
    if (!newItemName.trim() || !roomData) return;

    const newItemId = Date.now().toString();
    const newItem = { 
      id: newItemId, name: newItemName.trim(), category: newItemCategory, 
      price: 0, unitPrice: 0, qty: 1, isBought: false, listId: currentListId 
    };
    
    const newActiveList = [...(roomData.activeList || []), newItem];
    let newMasterList = [...(roomData.masterList || [])];
    
    if (!newMasterList.find(i => i.name.toLowerCase() === newItem.name.toLowerCase())) {
      newMasterList.push({ id: newItemId, name: newItem.name, category: newItem.category });
    }

    await updateRoomData({ activeList: newActiveList, masterList: newMasterList });
    setNewItemName('');
    setShowAddModal(false);
    setActiveTab('pending');
  };

  const addFromMaster = async (masterItem) => {
    if (!roomData) return;
    const activeList = roomData.activeList || [];
    if (activeList.find(i => i.name.toLowerCase() === masterItem.name.toLowerCase() && (i.listId || 'default') === currentListId)) return;

    const newItem = { 
      id: Date.now().toString(), name: masterItem.name, category: masterItem.category, 
      price: 0, unitPrice: 0, qty: 1, isBought: false, listId: currentListId 
    };
    await updateRoomData({ activeList: [...activeList, newItem] });
    setActiveTab('pending');
    setShowMasterModal(false);
  };

  const startEditMaster = (item) => {
    setEditingMasterId(item.id);
    setEditMasterName(item.name);
    setEditMasterCategory(item.category);
  };

  const saveEditMaster = async () => {
    if (!roomData || !editMasterName.trim()) return;
    const newMasterList = roomData.masterList.map(item =>
      item.id === editingMasterId ? { ...item, name: editMasterName.trim(), category: editMasterCategory } : item
    );
    const newActiveList = roomData.activeList.map(item => {
      const originalMasterItem = roomData.masterList.find(m => m.id === editingMasterId);
      if (originalMasterItem && item.name.toLowerCase() === originalMasterItem.name.toLowerCase()) {
        return { ...item, name: editMasterName.trim(), category: editMasterCategory };
      }
      return item;
    });

    await updateRoomData({ masterList: newMasterList, activeList: newActiveList });
    setEditingMasterId(null);
  };

  const handleItemClick = async (item, forceUncheck = false) => {
    if (item.isBought && forceUncheck) {
      const newList = roomData.activeList.map(i => i.id === item.id ? { ...i, isBought: false, price: 0, unitPrice: 0, qty: 1 } : i);
      await updateRoomData({ activeList: newList });
    } else {
      setPriceModalItem(item);
      setPriceInput(item.unitPrice ? item.unitPrice.toString() : (item.price ? item.price.toString() : ''));
      setQtyInput(item.qty ? item.qty.toString() : '1');
    }
  };

  const confirmItemPrice = async (e) => {
    e.preventDefault();
    if (!roomData || !priceModalItem) return;
    
    const unitP = parseFloat(priceInput) || 0;
    const q = parseFloat(qtyInput) || 1;
    const finalPrice = unitP * q;

    const newList = roomData.activeList.map(item => 
      item.id === priceModalItem.id 
        ? { ...item, isBought: true, price: finalPrice, unitPrice: unitP, qty: q } 
        : item
    );
    await updateRoomData({ activeList: newList });
    setPriceModalItem(null);
    setPriceInput('');
    setQtyInput('1');
  };

  const removeItem = async (itemId) => {
    if (!roomData) return;
    const newList = roomData.activeList.filter(item => item.id !== itemId);
    await updateRoomData({ activeList: newList });
  };

  const updateBudget = async (e) => {
    e.preventDefault();
    if (!roomData) return;
    const newBudgetVal = parseFloat(budgetInput);
    const finalBudget = isNaN(newBudgetVal) ? 0 : newBudgetVal;
    
    const newBudgets = { ...(roomData.budgets || {}) };
    newBudgets[currentListId] = finalBudget;

    if (currentListId === 'default') {
      await updateRoomData({ budget: finalBudget, budgets: newBudgets });
    } else {
      await updateRoomData({ budgets: newBudgets });
    }
    setShowBudgetModal(false);
  };

  const archiveSessionAndClear = async () => {
    if (!roomData) return;
    
    const allActiveList = roomData.activeList || [];
    const currentListCompletedItems = allActiveList.filter(item => item.isBought && (item.listId || 'default') === currentListId);
    
    if (currentListCompletedItems.length === 0) return;

    const sessionTotal = currentListCompletedItems.reduce((sum, item) => sum + (item.price || 0), 0);
    const sessionBreakdown = {};
    currentListCompletedItems.forEach(item => {
      sessionBreakdown[item.category] = (sessionBreakdown[item.category] || 0) + (item.price || 0);
    });

    const listName = lists.find(l => l.id === currentListId)?.name || 'Senarai Utama';

    const newSessionData = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      listName: listName,
      totalSpent: sessionTotal,
      breakdown: sessionBreakdown
    };

    const newPastSessions = [...(roomData.pastSessions || []), newSessionData];
    
    const remainingActiveList = allActiveList.filter(item => {
      if ((item.listId || 'default') === currentListId && item.isBought) return false; 
      return true; 
    });

    const newBudgets = { ...(roomData.budgets || {}) };
    newBudgets[currentListId] = 0;

    await updateRoomData({ 
      activeList: remainingActiveList,
      pastSessions: newPastSessions,
      budgets: newBudgets,
      ...(currentListId === 'default' ? { budget: 0 } : {})
    });
    
    setActiveTab('pending');
  };

  const clearCompleted = async () => {
    if (!roomData) return;
    const allActiveList = roomData.activeList || [];
    const remainingActiveList = allActiveList.filter(item => {
      if ((item.listId || 'default') === currentListId && item.isBought) return false; 
      return true; 
    });
    await updateRoomData({ activeList: remainingActiveList });
  };

  const cleanOldHistory = async () => {
    if (!roomData || !roomData.pastSessions) return;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const filteredSessions = roomData.pastSessions.filter(session => {
      const sessionDate = new Date(session.date);
      return sessionDate >= sixMonthsAgo;
    });

    await updateRoomData({ pastSessions: filteredSessions });
    setConfirmClean(false);
  };

  const handleNumberInput = (setter) => (e) => {
    let val = e.target.value.replace(/[^0-9.]/g, '');
    if ((val.match(/\./g) || []).length > 1) return;
    setter(val);
  };

  // --- Analitik & Pengiraan UI ---
  const { totalBudget, totalSpent, remaining, percentUsed, pendingCount, completedCount, groupedItems } = useMemo(() => {
    if (!roomData) return { totalBudget: 0, totalSpent: 0, remaining: 0, percentUsed: 0, pendingCount: 0, completedCount: 0, groupedItems: {} };
    
    const budgets = roomData.budgets || {};
    const budget = budgets[currentListId] !== undefined ? budgets[currentListId] : (currentListId === 'default' ? (roomData.budget || 0) : 0);
    
    const allActive = roomData.activeList || [];
    const active = allActive.filter(item => (item.listId || 'default') === currentListId);
    
    const spent = active.filter(i => i.isBought).reduce((sum, item) => sum + (item.price || 0), 0);
    const bal = budget - spent;
    const percent = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

    let pCount = 0;
    let cCount = 0;
    const grouped = {};
    
    active.forEach(item => {
      if (item.isBought) cCount++; else pCount++;
      if ((activeTab === 'pending' && !item.isBought) || (activeTab === 'completed' && item.isBought)) {
        if (!grouped[item.category]) grouped[item.category] = [];
        grouped[item.category].push(item);
      }
    });

    return { totalBudget: budget, totalSpent: spent, remaining: bal, percentUsed: percent, pendingCount: pCount, completedCount: cCount, groupedItems: grouped };
  }, [roomData, activeTab, currentListId]);

  const getProgressColor = () => {
    if (percentUsed < 50) return 'bg-teal-400';
    if (percentUsed < 80) return 'bg-yellow-400';
    return 'bg-rose-500';
  };

  const analyticsData = useMemo(() => {
    if (!roomData?.pastSessions || roomData.pastSessions.length === 0) {
      return { totalAllTime: 0, categoryTotals: {}, sortedCategories: [] };
    }
    let total = 0;
    let catTotals = {};
    roomData.pastSessions.forEach(session => {
      total += session.totalSpent;
      Object.keys(session.breakdown || {}).forEach(cat => {
        catTotals[cat] = (catTotals[cat] || 0) + session.breakdown[cat];
      });
    });
    const sortedCats = Object.keys(catTotals).sort((a, b) => catTotals[b] - catTotals[a]);
    return { totalAllTime: total, categoryTotals: catTotals, sortedCategories: sortedCats };
  }, [roomData?.pastSessions]);

  const filteredMasterList = useMemo(() => {
    if (!roomData?.masterList) return [];
    if (!searchMasterQuery.trim()) return roomData.masterList;
    return roomData.masterList.filter(item => 
      item.name.toLowerCase().includes(searchMasterQuery.toLowerCase()) || 
      item.category.toLowerCase().includes(searchMasterQuery.toLowerCase())
    );
  }, [roomData?.masterList, searchMasterQuery]);

  const bestValue = useMemo(() => {
    if (!compA.price || !compA.qty || !compB.price || !compB.qty) return null;
    const getBaseMultiplier = (unit) => { if (unit === 'kg' || unit === 'L') return 1000; return 1; };
    const costA = parseFloat(compA.price) / (parseFloat(compA.qty) * getBaseMultiplier(compA.unit));
    const costB = parseFloat(compB.price) / (parseFloat(compB.qty) * getBaseMultiplier(compB.unit));

    if (costA === costB) return 'Sama nilai berbaloi.';
    if (costA < costB) {
      const p = ((costB - costA) / costB) * 100;
      return { winner: 'A', text: `Barang A lebih berbaloi! (Jimat ${p.toFixed(0)}%)` };
    } else {
      const p = ((costA - costB) / costA) * 100;
      return { winner: 'B', text: `Barang B lebih berbaloi! (Jimat ${p.toFixed(0)}%)` };
    }
  }, [compA, compB]);


  // --- Skrin Antaramuka (UI) ---
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-slate-900 text-teal-400' : 'bg-teal-50 text-teal-600'}`}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');`}</style>
        <ShoppingCart className="animate-bounce w-12 h-12" />
      </div>
    );
  }

  // --- SKRIN LOG MASUK ---
  if (!roomCode || !roomData) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-slate-900' : 'bg-gradient-to-br from-teal-50 to-emerald-100'} flex flex-col items-center justify-center p-4 relative overflow-hidden transition-colors duration-300`} style={{ fontFamily: "'Poppins', sans-serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>
        <div className={`absolute top-[-10%] left-[-10%] w-64 h-64 ${isDarkMode ? 'bg-teal-900/40' : 'bg-teal-200'} rounded-full mix-blend-multiply filter blur-3xl opacity-50`}></div>
        <div className={`absolute bottom-[-10%] right-[-10%] w-72 h-72 ${isDarkMode ? 'bg-emerald-900/40' : 'bg-emerald-200'} rounded-full mix-blend-multiply filter blur-3xl opacity-50`}></div>

        <div className="absolute top-6 right-6 z-20">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-2 rounded-full backdrop-blur-sm border ${isDarkMode ? 'bg-slate-800/50 border-slate-700 text-yellow-300' : 'bg-white/50 border-white text-gray-600'} transition-all shadow-sm`}>
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <div className={`${isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white/80 border-white/50'} backdrop-blur-xl p-8 rounded-[2rem] shadow-2xl border w-full max-w-md text-center relative z-10 mb-8 transition-colors`}>
          <div className="bg-gradient-to-tr from-teal-500 to-emerald-400 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-teal-500/30 transform rotate-3">
            <ShoppingBag className="w-10 h-10 text-white -rotate-3" />
          </div>
          <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-2 tracking-tight`}>Jom Shopping</h1>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-8 font-medium`}>Kongsi senarai & pantau perbelanjaan runcit bersama.</p>

          <form onSubmit={joinRoom} className="space-y-4">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Kod Bilik (Cth: T8F2X)" 
                className={`w-full text-center text-lg p-3.5 border-2 rounded-2xl focus:outline-none focus:ring-4 uppercase font-bold tracking-widest transition-all ${isDarkMode ? 'bg-slate-900/50 border-slate-600 text-white focus:border-teal-500 focus:ring-teal-500/20' : 'bg-white/50 border-teal-100 text-teal-900 focus:border-teal-500 focus:ring-teal-500/10'}`}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
              />
            </div>
            <button type="submit" disabled={!inputCode.trim()} className="w-full bg-gradient-to-r from-teal-600 to-emerald-500 text-white font-semibold py-3.5 rounded-2xl shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0">
              <span className="flex items-center justify-center gap-2">Sertai Bilik <ArrowRight className="w-5 h-5" /></span>
            </button>
          </form>

          <div className={`mt-8 pt-6 border-t ${isDarkMode ? 'border-slate-700' : 'border-gray-200/50'}`}>
            <p className={`text-xs font-medium mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Atau mulakan sesi baru?</p>
            <button onClick={generateRoomCode} className={`w-full font-bold py-3.5 rounded-2xl transition-colors flex items-center justify-center gap-2 text-sm ${isDarkMode ? 'bg-teal-900/30 text-teal-400 hover:bg-teal-900/50' : 'bg-teal-50 text-teal-700 hover:bg-teal-100'}`}>
              <Sparkles className="w-4 h-4" /> Cipta Bilik Baru
            </button>
          </div>
        </div>
        <div className="absolute bottom-6 left-0 right-0 text-center z-10">
          <p className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-teal-700/40'}`}>Created by Wan SK</p>
        </div>
      </div>
    );
  }

  // --- SKRIN UTAMA ---
  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-slate-900' : 'bg-[#F8FAFC]'} pb-32 transition-colors duration-300`} style={{ fontFamily: "'Poppins', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Header & Kad Bajet */}
      <div className={`bg-gradient-to-r ${isDarkMode ? 'from-teal-800 to-emerald-900' : 'from-teal-600 to-emerald-500'} text-white pt-5 pb-24 px-4 rounded-b-[2.5rem] shadow-lg relative transition-colors duration-300`}>
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm shadow-inner">
                <ShoppingBag className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-base md:text-lg font-bold tracking-tight leading-tight">Jom Shopping</h1>
                <div className="flex items-center mt-0.5">
                  <span className="bg-black/20 px-2 py-0.5 rounded text-[9px] font-bold tracking-widest backdrop-blur-sm border border-white/10 uppercase shadow-sm">
                    KOD: {roomCode}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 bg-black/10 rounded-full hover:bg-black/20 transition backdrop-blur-sm border border-white/10 text-white">
                {isDarkMode ? <Sun className="w-4 h-4 text-yellow-300" /> : <Moon className="w-4 h-4 text-white" />}
              </button>
              <button onClick={leaveRoom} className="p-2 bg-black/10 rounded-full hover:bg-black/20 transition backdrop-blur-sm border border-white/10">
                <LogOut className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700 text-white shadow-black/40' : 'bg-white border-gray-100 text-gray-800 shadow-teal-900/10'} rounded-3xl p-5 shadow-xl absolute left-4 right-4 max-w-3xl mx-auto top-[80px] border transition-colors duration-300 z-20`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className={`text-xs font-semibold flex items-center gap-1.5 mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  <Wallet className="w-3.5 h-3.5 text-teal-500" /> Jumlah Baki
                </p>
                <h2 className={`text-3xl md:text-4xl font-bold tracking-tight leading-none ${remaining < 0 ? 'text-rose-500' : (isDarkMode ? 'text-white' : 'text-slate-800')}`}>
                  <span className={`text-lg md:text-xl mr-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>RM</span>
                  {remaining.toFixed(2)}
                </h2>
              </div>
              <button onClick={() => setShowBudgetModal(true)} className={`p-2 rounded-full transition-colors ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-teal-400' : 'bg-teal-50 hover:bg-teal-100 text-teal-600'}`}>
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
            
            <div className="mb-3">
              <div className={`h-2 w-full rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                <div className={`h-full ${getProgressColor()} transition-all duration-500 ease-out`} style={{ width: `${percentUsed}%` }}></div>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <div className={`flex-1 rounded-lg p-2.5 border ${isDarkMode ? 'bg-slate-700/50 border-slate-600' : 'bg-gray-50 border-gray-100/50'}`}>
                <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`}>Bajet</p>
                <p className={`font-bold text-sm md:text-base ${isDarkMode ? 'text-slate-200' : 'text-gray-700'}`}>RM {totalBudget.toFixed(2)}</p>
              </div>
              <div className={`flex-1 rounded-lg p-2.5 border ${isDarkMode ? 'bg-rose-900/20 border-rose-900/30' : 'bg-rose-50 border-rose-100/50'}`}>
                <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isDarkMode ? 'text-rose-400/80' : 'text-rose-400'}`}>Belanja</p>
                <p className={`font-bold text-sm md:text-base ${isDarkMode ? 'text-rose-400' : 'text-rose-600'}`}>RM {totalSpent.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="h-32 md:h-36"></div>

      {/* --- MULTI-LIST BAR --- */}
      <div className="max-w-3xl mx-auto px-4 mb-4 relative z-10">
        <div className="flex overflow-x-auto no-scrollbar gap-2 pb-2">
          {lists.map(list => (
            <button
              key={list.id}
              onClick={() => { setSelectedListId(list.id); setActiveTab('pending'); }}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all border shadow-sm flex items-center gap-1.5 ${
                selectedListId === list.id 
                  ? 'bg-gradient-to-r from-teal-500 to-emerald-500 border-transparent text-white' 
                  : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50')
              }`}
            >
              <ShoppingCart className={`w-3.5 h-3.5 ${selectedListId === list.id ? 'opacity-100' : 'opacity-50'}`} />
              {list.name}
            </button>
          ))}
          <button 
            onClick={() => setShowManageListModal(true)}
            className={`px-3 py-2 rounded-xl text-sm font-bold whitespace-nowrap flex items-center gap-1 border-2 border-dashed transition-all ${
              isDarkMode ? 'border-slate-700 text-slate-400 hover:border-teal-500 hover:text-teal-400' : 'border-gray-300 text-gray-500 hover:border-teal-500 hover:text-teal-600'
            }`}
          >
            <FolderPlus className="w-4 h-4" /> Urus
          </button>
        </div>
      </div>

      {/* --- TAB TOGGLE --- */}
      <div className="max-w-3xl mx-auto px-4 mb-4 relative z-0">
        <div className={`flex p-1 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-gray-200/50'}`}>
          <button 
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'pending' 
                ? (isDarkMode ? 'bg-slate-700 text-teal-400 shadow-sm' : 'bg-white text-teal-600 shadow-sm') 
                : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700')
            }`}
          >
            <ListTodo className="w-4 h-4" />
            Perlu Beli
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'pending' ? (isDarkMode ? 'bg-teal-900/50' : 'bg-teal-50') : (isDarkMode ? 'bg-slate-700' : 'bg-gray-200')}`}>{pendingCount}</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('completed')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'completed' 
                ? (isDarkMode ? 'bg-slate-700 text-emerald-400 shadow-sm' : 'bg-white text-emerald-600 shadow-sm') 
                : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700')
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            Telah Selesai
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'completed' ? (isDarkMode ? 'bg-emerald-900/50' : 'bg-emerald-50') : (isDarkMode ? 'bg-slate-700' : 'bg-gray-200')}`}>{completedCount}</span>
          </button>
        </div>
      </div>

      {/* --- SENARAI BARANG --- */}
      <div className="max-w-3xl mx-auto px-4 mt-2 relative z-0">
        {Object.keys(groupedItems).length === 0 ? (
          <div className="text-center py-12">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${isDarkMode ? 'bg-teal-900/30' : 'bg-teal-50'}`}>
              <ShoppingCart className={`w-8 h-8 ${isDarkMode ? 'text-teal-500' : 'text-teal-300'}`} />
            </div>
            <h3 className={`text-lg font-bold mb-1 ${isDarkMode ? 'text-slate-200' : 'text-gray-700'}`}>
              {activeTab === 'pending' ? 'Senarai Kosong' : 'Belum Ada Belian'}
            </h3>
            <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-gray-400'}`}>
              {activeTab === 'pending' ? `Mula tambah barang untuk senarai ini.` : 'Barang yang dibeli akan muncul di sini.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.keys(groupedItems).map(category => (
              <div key={category} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className={`p-1.5 rounded-md ${isDarkMode ? 'bg-teal-900/50' : 'bg-teal-100'}`}>
                    <Tag className={`w-3.5 h-3.5 ${isDarkMode ? 'text-teal-400' : 'text-teal-600'}`} />
                  </div>
                  <h3 className={`font-bold text-sm md:text-base flex-1 leading-tight ${isDarkMode ? 'text-slate-200' : 'text-gray-700'}`}>{category}</h3>
                </div>
                <div className="space-y-2.5">
                  {groupedItems[category].map(item => (
                    <div 
                      key={item.id} 
                      className={`group rounded-2xl border transition-all duration-300 overflow-hidden ${
                        item.isBought 
                          ? (isDarkMode ? 'bg-slate-800/60 border-emerald-800/50' : 'bg-emerald-50/50 border-emerald-100/60')
                          : (isDarkMode ? 'bg-slate-800 border-slate-700 shadow-sm' : 'bg-white border-teal-100/50 shadow-sm')
                      }`}
                    >
                      <div className="flex items-center justify-between p-3.5">
                        <div className="flex items-center gap-3.5 flex-1 cursor-pointer" onClick={() => handleItemClick(item, false)}>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              if(item.isBought) handleItemClick(item, true); 
                              else handleItemClick(item, false); 
                            }} 
                            className="flex-shrink-0 focus:outline-none transform transition-transform active:scale-90"
                          >
                            {item.isBought ? (
                              <CheckCircle className={`w-6 h-6 ${isDarkMode ? 'text-emerald-500 fill-slate-800' : 'text-emerald-500 fill-emerald-50'}`} />
                            ) : (
                              <Circle className={`w-6 h-6 transition-colors ${isDarkMode ? 'text-slate-600 group-hover:text-teal-400' : 'text-gray-300 group-hover:text-teal-400'}`} />
                            )}
                          </button>
                          <div className="flex-1">
                            <p className={`font-semibold text-sm md:text-base transition-colors ${
                              item.isBought ? (isDarkMode ? 'text-slate-300' : 'text-gray-700') : (isDarkMode ? 'text-slate-200' : 'text-gray-800')
                            }`}>
                              {item.name}
                            </p>
                            {item.isBought && item.price > 0 && (
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-white border border-gray-200 text-gray-500'}`}>
                                  {item.qty} x RM {(item.unitPrice || 0).toFixed(2)}
                                </span>
                                <span className={`text-[11px] font-bold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                  = RM {item.price.toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} className={`p-2 ml-2 rounded-full transition-colors ${isDarkMode ? 'text-slate-600 hover:text-rose-400 hover:bg-rose-900/20' : 'text-gray-300 hover:text-rose-500 hover:bg-rose-50'}`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* BUTANG SIMPAN RESIT */}
        {activeTab === 'completed' && completedCount > 0 && (
          <div className="mt-10 mb-4 text-center">
            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-emerald-100 shadow-sm'} max-w-sm mx-auto`}>
              <p className={`text-xs font-bold mb-3 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>Dah habis shopping senarai ini?</p>
              <button onClick={archiveSessionAndClear} className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-500/30 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
                <CalendarCheck className="w-4 h-4" /> Simpan Resit & Tutup Sesi
              </button>
            </div>
            <button onClick={clearCompleted} className={`mt-4 inline-flex items-center gap-2 text-xs font-semibold px-5 py-2.5 rounded-full transition-colors ${isDarkMode ? 'bg-rose-900/30 text-rose-400 hover:bg-rose-900/50' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'}`}>
              <Trash2 className="w-3 h-3" /> Buang item selesai tanpa simpan
            </button>
          </div>
        )}

        <div className="mt-12 mb-8 text-center pb-12">
          <p className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-600' : 'text-gray-400/80'}`}>Created by Wan SK</p>
        </div>
      </div>

      {/* --- MENU BAWAH --- */}
      <div className="fixed bottom-4 left-4 right-4 z-40">
        <div className={`max-w-md mx-auto backdrop-blur-xl p-1.5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border flex gap-1 transition-colors ${isDarkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white/90 border-white'}`}>
          <button onClick={() => { setShowMasterModal(true); setSearchMasterQuery(''); }} className={`flex-1 bg-transparent font-bold py-2 rounded-2xl flex flex-col items-center justify-center gap-1 transition-colors ${isDarkMode ? 'text-slate-400 hover:text-teal-400 hover:bg-slate-700' : 'text-gray-500 hover:text-teal-600 hover:bg-gray-50'}`}>
            <History className="w-5 h-5" />
            <span className="text-[9px] tracking-wider uppercase">Sejarah</span>
          </button>
          <button onClick={() => setShowCompareModal(true)} className={`flex-1 bg-transparent font-bold py-2 rounded-2xl flex flex-col items-center justify-center gap-1 transition-colors ${isDarkMode ? 'text-slate-400 hover:text-blue-400 hover:bg-slate-700' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'}`}>
            <Scale className="w-5 h-5" />
            <span className="text-[9px] tracking-wider uppercase">Banding</span>
          </button>
          <button onClick={() => setShowAnalyticsModal(true)} className={`flex-1 bg-transparent font-bold py-2 rounded-2xl flex flex-col items-center justify-center gap-1 transition-colors ${isDarkMode ? 'text-slate-400 hover:text-purple-400 hover:bg-slate-700' : 'text-gray-500 hover:text-purple-600 hover:bg-purple-50'}`}>
            <PieChart className="w-5 h-5" />
            <span className="text-[9px] tracking-wider uppercase">Analitik</span>
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex-[1.2] bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-bold py-2 rounded-2xl flex flex-col items-center justify-center gap-1 shadow-lg shadow-teal-500/20 hover:-translate-y-0.5 transition-all">
            <Plus className="w-5 h-5" />
            <span className="text-[9px] tracking-wider uppercase">Tambah</span>
          </button>
        </div>
      </div>

      {/* --- SEMUA MODAL INLINE (LEBIH SELAMAT & STABIL) --- */}

      {/* MODAL: URUS SENARAI */}
      {showManageListModal && (
        <div className={`fixed inset-0 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center p-4 ${isDarkMode ? 'bg-slate-900/80' : 'bg-slate-900/40'}`}>
          <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-transparent'} rounded-[2rem] w-full max-w-sm overflow-hidden p-6 animate-in slide-in-from-bottom-8 duration-300 shadow-2xl border`}>
            <div className="flex justify-between items-center mb-5">
              <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Urus Senarai</h3>
              <button onClick={() => setShowManageListModal(false)} className={`p-1.5 rounded-full ${isDarkMode ? 'bg-slate-700 text-slate-400 hover:bg-slate-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}><X className="w-5 h-5"/></button>
            </div>
            <div className="space-y-3 mb-6 max-h-[40vh] overflow-y-auto pr-1 no-scrollbar">
              {lists.map(l => (
                <div key={l.id} className={`flex justify-between items-center p-3.5 rounded-xl border shadow-sm ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-gray-50 border-gray-200/50'}`}>
                  <span className={`font-bold text-sm ${isDarkMode ? 'text-slate-200' : 'text-gray-700'}`}>{l.name}</span>
                  {l.id !== 'default' ? (
                    <button onClick={() => removeList(l.id)} className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'text-rose-400 bg-rose-900/20 hover:bg-rose-900/40' : 'text-rose-500 bg-rose-50 hover:bg-rose-100'}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-gray-200 text-gray-500'}`}>Utama</span>
                  )}
                </div>
              ))}
            </div>
            <form onSubmit={addNewList} className="flex gap-2">
              <input type="text" required value={newListInput} onChange={(e) => setNewListInput(e.target.value)} placeholder="Nama senarai baru..." className={`flex-1 border-2 rounded-xl p-3 text-sm font-medium focus:outline-none focus:ring-4 transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:border-teal-500 focus:ring-teal-500/20' : 'bg-white border-gray-200 text-gray-800 focus:border-teal-500 focus:ring-teal-500/10'}`} />
              <button type="submit" className="bg-teal-600 hover:bg-teal-700 transition-colors text-white px-4 rounded-xl font-bold shadow-lg shadow-teal-600/30"><Plus className="w-5 h-5" /></button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TETAPKAN BAJET */}
      {showBudgetModal && (
        <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${isDarkMode ? 'bg-slate-900/80' : 'bg-slate-900/40'}`}>
          <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-[2rem] w-full max-w-xs overflow-hidden p-6 animate-in zoom-in-95 duration-200 shadow-2xl border ${isDarkMode ? 'border-slate-700' : 'border-transparent'}`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${isDarkMode ? 'bg-teal-900/50' : 'bg-teal-50'}`}>
              <Wallet className={`w-6 h-6 ${isDarkMode ? 'text-teal-400' : 'text-teal-600'}`} />
            </div>
            <h3 className={`text-xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Tetapkan Bajet</h3>
            <p className={`text-xs font-medium mb-5 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>Berapa bajet sesi kali ini?</p>
            <form onSubmit={updateBudget}>
              <div className={`flex items-center gap-2 border-2 rounded-2xl p-3 mb-6 transition-all focus-within:ring-4 ${isDarkMode ? 'bg-slate-900 border-slate-700 focus-within:border-teal-500 focus-within:ring-teal-500/20' : 'bg-teal-50/50 border-teal-200 focus-within:border-teal-500 focus-within:ring-teal-500/10'}`}>
                <span className={`font-bold text-lg ${isDarkMode ? 'text-teal-500' : 'text-teal-700'}`}>RM</span>
                <input 
                  type="text" 
                  inputMode="decimal"
                  value={budgetInput} 
                  onChange={handleNumberInput(setBudgetInput)} 
                  className={`w-full bg-transparent text-2xl font-bold focus:outline-none ${isDarkMode ? 'text-white placeholder-slate-600' : 'text-gray-800 placeholder-gray-300'}`} 
                  placeholder="0.00" 
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowBudgetModal(false)} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-colors ${isDarkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Batal</button>
                <button type="submit" className="flex-1 py-3 bg-teal-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-teal-600/30 hover:bg-teal-700 transition-colors">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: POPUP HARGA BARANG */}
      {priceModalItem && (
        <div className={`fixed inset-0 backdrop-blur-sm z-[60] flex items-center justify-center p-4 ${isDarkMode ? 'bg-slate-900/80' : 'bg-slate-900/60'}`}>
          <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-[2rem] w-full max-w-xs overflow-hidden p-6 animate-in zoom-in-95 duration-200 shadow-2xl border ${isDarkMode ? 'border-slate-700' : 'border-transparent'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-teal-900/50' : 'bg-teal-50'}`}>
                  <Tag className={`w-5 h-5 ${isDarkMode ? 'text-teal-400' : 'text-teal-600'}`} />
                </div>
                <div>
                  <h3 className={`text-base font-bold leading-tight ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{priceModalItem.name}</h3>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>{priceModalItem.category}</p>
                </div>
              </div>
            </div>
            <form onSubmit={confirmItemPrice}>
              <div className="flex gap-3 mb-4">
                <div className={`w-28 flex flex-col justify-center border-2 rounded-2xl p-2 transition-all focus-within:ring-4 ${isDarkMode ? 'bg-slate-900 border-slate-700 focus-within:border-teal-500 focus-within:ring-teal-500/20' : 'bg-gray-50/50 border-gray-200 focus-within:border-teal-500 focus-within:ring-teal-500/10'}`}>
                  <label className={`text-[10px] text-center font-bold uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>Kuantiti</label>
                  <div className="flex items-center justify-between">
                    <button type="button" onClick={() => setQtyInput(Math.max(1, (parseFloat(qtyInput)||1) - 1))} className={`p-1 rounded-full ${isDarkMode ? 'bg-slate-700 text-white' : 'bg-gray-200 text-gray-700'}`}><Minus className="w-3 h-3"/></button>
                    <input type="text" inputMode="decimal" required value={qtyInput} onChange={handleNumberInput(setQtyInput)} className={`w-8 text-center bg-transparent text-lg font-bold focus:outline-none ${isDarkMode ? 'text-white' : 'text-gray-800'}`} />
                    <button type="button" onClick={() => setQtyInput((parseFloat(qtyInput)||0) + 1)} className={`p-1 rounded-full ${isDarkMode ? 'bg-slate-700 text-white' : 'bg-gray-200 text-gray-700'}`}><Plus className="w-3 h-3"/></button>
                  </div>
                </div>
                <div className={`flex-1 flex flex-col justify-center border-2 rounded-2xl p-2 transition-all focus-within:ring-4 ${isDarkMode ? 'bg-slate-900 border-slate-700 focus-within:border-teal-500 focus-within:ring-teal-500/20' : 'bg-teal-50/50 border-teal-200 focus-within:border-teal-500 focus-within:ring-teal-500/10'}`}>
                  <label className={`text-[10px] text-center font-bold uppercase tracking-widest mb-1 ${isDarkMode ? 'text-teal-500' : 'text-teal-600'}`}>Harga Seunit</label>
                  <div className="flex items-center justify-center gap-1">
                    <span className={`font-bold text-sm ${isDarkMode ? 'text-teal-500' : 'text-teal-700'}`}>RM</span>
                    <input type="text" inputMode="decimal" required value={priceInput} onChange={handleNumberInput(setPriceInput)} className={`w-full bg-transparent text-xl text-center font-bold focus:outline-none ${isDarkMode ? 'text-white placeholder-slate-600' : 'text-gray-800 placeholder-gray-300'}`} placeholder="0.00" />
                  </div>
                </div>
              </div>
              <div className={`text-center p-3 mb-6 rounded-xl border border-dashed ${isDarkMode ? 'bg-slate-800/50 border-slate-600' : 'bg-gray-50 border-gray-300'}`}>
                <p className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>Jumlah Keseluruhan</p>
                <p className={`text-2xl font-bold ${isDarkMode ? 'text-teal-400' : 'text-teal-600'}`}>RM {((parseFloat(priceInput) || 0) * (parseFloat(qtyInput) || 1)).toFixed(2)}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPriceModalItem(null)} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-colors ${isDarkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Batal</button>
                <button type="submit" className="flex-[1.5] py-3 bg-teal-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-teal-600/30 hover:bg-teal-700 transition-colors">Sahkan & Tanda</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TAMBAH BARANG BARU */}
      {showAddModal && (
        <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 ${isDarkMode ? 'bg-slate-900/80' : 'bg-slate-900/40'}`}>
          <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-[2rem] w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-8 duration-300 shadow-2xl border ${isDarkMode ? 'border-slate-700' : 'border-transparent'}`}>
            <div className="p-5">
              <div className="flex justify-between items-center mb-5">
                <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Tambah Barang</h3>
                <button onClick={() => setShowAddModal(false)} className={`p-1.5 rounded-full ${isDarkMode ? 'bg-slate-700 text-slate-400 hover:bg-slate-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}><X className="w-5 h-5"/></button>
              </div>
              <form onSubmit={addItem} className="space-y-4">
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>Nama Barang</label>
                  <input type="text" required value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Contoh: Ikan Siakap" className={`w-full border-2 rounded-xl p-3 text-sm focus:outline-none font-medium transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:border-teal-500 placeholder-slate-600' : 'border-gray-200 text-gray-800 focus:border-teal-500'}`} />
                </div>
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>Kategori Lorong</label>
                  <select value={newItemCategory} onChange={(e) => setNewItemCategory(e.target.value)} className={`w-full border-2 rounded-xl p-3 text-sm focus:outline-none font-medium appearance-none transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white focus:border-teal-500' : 'bg-white border-gray-200 text-gray-800 focus:border-teal-500'}`}>
                    {KATEGORI_LALAI.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <button type="submit" className="w-full bg-teal-600 text-white font-bold py-3.5 rounded-xl mt-6 shadow-lg shadow-teal-600/30 hover:bg-teal-700 transition-colors text-sm">Masukkan ke Senarai</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SENARAI KERAP / SEJARAH */}
      {showMasterModal && (
        <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 ${isDarkMode ? 'bg-slate-900/80' : 'bg-slate-900/40'}`}>
          <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white'} rounded-[2rem] w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-8 duration-300 shadow-2xl border`}>
            <div className={`p-5 border-b flex justify-between items-center z-10 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
              <div>
                <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Senarai Kerap</h3>
                <p className={`text-[11px] font-bold uppercase tracking-wider mt-0.5 ${isDarkMode ? 'text-teal-400' : 'text-teal-600'}`}>Pilih untuk tambah pantas</p>
              </div>
              <button onClick={() => { setShowMasterModal(false); setEditingMasterId(null); }} className={`p-1.5 rounded-full ${isDarkMode ? 'bg-slate-700 text-slate-400 hover:bg-slate-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}><X className="w-5 h-5"/></button>
            </div>
            <div className={`p-4 border-b z-10 ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-gray-50 border-gray-100'}`}>
              <div className="relative">
                <Search className={`w-4 h-4 absolute left-3.5 top-3.5 ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`} />
                <input type="text" placeholder="Cari barang atau kategori..." value={searchMasterQuery} onChange={(e) => setSearchMasterQuery(e.target.value)} className={`w-full pl-10 pr-4 py-3 border rounded-xl text-sm font-medium focus:outline-none focus:ring-4 transition-all shadow-sm ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-teal-500 focus:ring-teal-500/10 placeholder-slate-500' : 'bg-white border-gray-200 text-gray-800 focus:border-teal-500 focus:ring-teal-500/10'}`} />
                {searchMasterQuery && <button onClick={() => setSearchMasterQuery('')} className={`absolute right-3 top-3.5 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}><X className="w-4 h-4" /></button>}
              </div>
            </div>
            <div className={`overflow-y-auto p-4 flex-1 ${isDarkMode ? 'bg-slate-900' : 'bg-gray-50/50'}`}>
              {(!roomData?.masterList || roomData.masterList.length === 0) ? (
                <div className="text-center py-10">
                  <History className={`w-10 h-10 mx-auto mb-2 opacity-20 ${isDarkMode ? 'text-white' : 'text-gray-800'}`} />
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-gray-400'}`}>Belum ada sejarah barang.</p>
                </div>
              ) : filteredMasterList.length === 0 ? (
                <div className="text-center py-10">
                  <Search className={`w-10 h-10 mx-auto mb-2 opacity-20 ${isDarkMode ? 'text-white' : 'text-gray-800'}`} />
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-gray-400'}`}>Tiada padanan untuk "{searchMasterQuery}"</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredMasterList.map(masterItem => {
                    const isAlreadyInActive = (roomData.activeList || []).some(i => i.name.toLowerCase() === masterItem.name.toLowerCase() && (i.listId || 'default') === currentListId);
                    if (editingMasterId === masterItem.id) {
                      return (
                        <div key={masterItem.id} className={`border p-3 rounded-2xl shadow-sm animate-in fade-in ${isDarkMode ? 'bg-teal-900/20 border-teal-800' : 'bg-teal-50/50 border-teal-200'}`}>
                          <input type="text" value={editMasterName} onChange={(e) => setEditMasterName(e.target.value)} className={`w-full border rounded-lg p-2 text-sm focus:outline-none focus:border-teal-500 font-medium mb-2 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-teal-200 text-gray-800'}`} />
                          <select value={editMasterCategory} onChange={(e) => setEditMasterCategory(e.target.value)} className={`w-full border rounded-lg p-2 text-sm focus:outline-none focus:border-teal-500 font-medium appearance-none mb-3 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-teal-200 text-gray-800'}`}>
                            {KATEGORI_LALAI.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                          </select>
                          <div className="flex gap-2">
                            <button onClick={() => setEditingMasterId(null)} className={`flex-1 py-1.5 text-xs font-bold rounded-lg border ${isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>Batal</button>
                            <button onClick={saveEditMaster} className="flex-1 py-1.5 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700">Simpan Edit</button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={masterItem.id} className={`flex justify-between items-center border p-3 rounded-2xl shadow-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
                        <div className="flex-1"><p className={`font-bold text-sm pr-2 ${isDarkMode ? 'text-slate-200' : 'text-gray-800'}`}>{masterItem.name}</p><p className={`text-[10px] font-bold mt-0.5 uppercase ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>{masterItem.category}</p></div>
                        <div className="flex gap-1">
                          <button onClick={() => startEditMaster(masterItem)} className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'bg-slate-700 text-slate-400 hover:text-teal-400 hover:bg-slate-600' : 'bg-gray-50 text-gray-400 hover:text-teal-600 hover:bg-teal-50'}`}><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => addFromMaster(masterItem)} disabled={isAlreadyInActive} className={`p-2 rounded-xl transition-all ${isAlreadyInActive ? (isDarkMode ? 'bg-slate-700 text-slate-500' : 'bg-gray-100 text-gray-400') : (isDarkMode ? 'bg-teal-900/50 text-teal-400 hover:bg-teal-900 active:scale-95' : 'bg-teal-50 text-teal-600 hover:bg-teal-100 active:scale-95')}`}>
                            {isAlreadyInActive ? <CheckCircle className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BANDING HARGA */}
      {showCompareModal && (
        <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${isDarkMode ? 'bg-slate-900/80' : 'bg-slate-900/60'}`}>
          <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-[2rem] w-full max-w-sm overflow-hidden p-5 animate-in slide-in-from-bottom-8 duration-300 shadow-2xl border ${isDarkMode ? 'border-slate-700' : 'border-transparent'}`}>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-blue-900/50' : 'bg-blue-100'}`}><Scale className={`w-4 h-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} /></div>
                <h3 className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Banding Harga</h3>
              </div>
              <button onClick={() => setShowCompareModal(false)} className={`p-1.5 rounded-full ${isDarkMode ? 'bg-slate-700 text-slate-400 hover:bg-slate-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}><X className="w-4 h-4"/></button>
            </div>

            <div className="space-y-4">
              <div className={`p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-gray-50 border-gray-200/60'}`}>
                <p className={`text-xs font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>Barang A</p>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <span className={`absolute left-2.5 top-2.5 text-xs font-bold ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>RM</span>
                    <input type="text" inputMode="decimal" value={compA.price} onChange={handleNumberInput((v)=>setCompA({...compA, price: v}))} placeholder="Harga" className={`w-full text-sm pl-8 pr-2 py-2 rounded-xl border focus:outline-none font-semibold ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white focus:border-blue-500' : 'bg-white border-gray-200 focus:border-blue-500 text-gray-800'}`} />
                  </div>
                  <div className="flex-1">
                    <input type="text" inputMode="decimal" value={compA.qty} onChange={handleNumberInput((v)=>setCompA({...compA, qty: v}))} placeholder="Kuantiti" className={`w-full text-sm px-3 py-2 rounded-xl border focus:outline-none font-semibold ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white focus:border-blue-500' : 'bg-white border-gray-200 focus:border-blue-500 text-gray-800'}`} />
                  </div>
                  <select value={compA.unit} onChange={e=>setCompA({...compA, unit: e.target.value})} className={`w-16 text-xs px-1 py-2 rounded-xl border font-semibold focus:outline-none appearance-none text-center ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white focus:border-blue-500' : 'bg-white border-gray-200 focus:border-blue-500 text-gray-800'}`}>
                    <option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="L">L</option><option value="pcs">pcs</option>
                  </select>
                </div>
              </div>

              <div className="relative h-4 flex items-center justify-center">
                <div className={`absolute w-full h-px ${isDarkMode ? 'bg-slate-700' : 'bg-gray-200'}`}></div>
                <span className={`relative px-2 text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-white text-gray-400'}`}>Lawan</span>
              </div>

              <div className={`p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-gray-50 border-gray-200/60'}`}>
                <p className={`text-xs font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>Barang B</p>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <span className={`absolute left-2.5 top-2.5 text-xs font-bold ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>RM</span>
                    <input type="text" inputMode="decimal" value={compB.price} onChange={handleNumberInput((v)=>setCompB({...compB, price: v}))} placeholder="Harga" className={`w-full text-sm pl-8 pr-2 py-2 rounded-xl border focus:outline-none font-semibold ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white focus:border-blue-500' : 'bg-white border-gray-200 focus:border-blue-500 text-gray-800'}`} />
                  </div>
                  <div className="flex-1">
                    <input type="text" inputMode="decimal" value={compB.qty} onChange={handleNumberInput((v)=>setCompB({...compB, qty: v}))} placeholder="Kuantiti" className={`w-full text-sm px-3 py-2 rounded-xl border focus:outline-none font-semibold ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white focus:border-blue-500' : 'bg-white border-gray-200 focus:border-blue-500 text-gray-800'}`} />
                  </div>
                  <select value={compB.unit} onChange={e=>setCompB({...compB, unit: e.target.value})} className={`w-16 text-xs px-1 py-2 rounded-xl border font-semibold focus:outline-none appearance-none text-center ${isDarkMode ? 'bg-slate-800 border-slate-600 text-white focus:border-blue-500' : 'bg-white border-gray-200 focus:border-blue-500 text-gray-800'}`}>
                    <option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="L">L</option><option value="pcs">pcs</option>
                  </select>
                </div>
              </div>
            </div>

            {bestValue && typeof bestValue === 'object' && (
              <div className={`mt-4 p-3 rounded-xl border text-center font-bold text-sm animate-in fade-in zoom-in-95 duration-300 ${bestValue.winner === 'A' ? (isDarkMode ? 'bg-emerald-900/30 border-emerald-800 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700') : (isDarkMode ? 'bg-blue-900/30 border-blue-800 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700')}`}>
                <Sparkles className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />{bestValue.text}
              </div>
            )}
            {bestValue === 'Sama nilai berbaloi.' && (
              <div className={`mt-4 p-3 rounded-xl border text-center font-bold text-sm animate-in fade-in ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-gray-100 border-gray-200 text-gray-600'}`}>
                Dua-dua sama je nilainya.
              </div>
            )}

            <button onClick={() => { setCompA({price:'',qty:'',unit:'g'}); setCompB({price:'',qty:'',unit:'g'}); }} className={`w-full mt-4 py-3 border-2 text-xs font-bold rounded-xl transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'}`}>
              Reset Semula
            </button>
          </div>
        </div>
      )}

      {/* MODAL: ANALITIK */}
      {showAnalyticsModal && (
        <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 ${isDarkMode ? 'bg-slate-900/80' : 'bg-slate-900/40'}`}>
          <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-transparent'} rounded-[2rem] w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-8 duration-300 shadow-2xl border`}>
            <div className={`p-5 border-b flex justify-between items-center z-10 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
              <div>
                <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Analitik</h3>
                <p className={`text-[11px] font-bold uppercase tracking-wider mt-0.5 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>Sejarah Pembelian</p>
              </div>
              <button onClick={() => {setShowAnalyticsModal(false); setConfirmClean(false);}} className={`p-1.5 rounded-full ${isDarkMode ? 'bg-slate-700 text-slate-400 hover:bg-slate-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}><X className="w-5 h-5"/></button>
            </div>
            <div className={`overflow-y-auto p-5 flex-1 ${isDarkMode ? 'bg-slate-900' : 'bg-gray-50'}`}>
              {(!roomData?.pastSessions || roomData.pastSessions.length === 0) ? (
                <div className="text-center py-16">
                  <PieChart className={`w-12 h-12 mx-auto mb-3 opacity-20 ${isDarkMode ? 'text-white' : 'text-gray-800'}`} />
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>Belum ada data analitik.</p>
                  <p className={`text-xs mt-2 ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>Tekan 'Simpan Resit' di tab selesai selepas pembelian untuk mula menjana graf.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className={`p-5 rounded-3xl text-center shadow-sm border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-400'}`}>Jumlah Keseluruhan (Sepanjang Masa)</p>
                    <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                      <span className="text-lg mr-1 text-gray-400">RM</span>
                      {analyticsData.totalAllTime.toFixed(2)}
                    </h2>
                  </div>

                  <div>
                    <h4 className={`text-xs font-bold uppercase tracking-widest mb-3 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>Pecahan Mengikut Kategori</h4>
                    <div className={`p-4 rounded-3xl shadow-sm border space-y-4 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
                      {analyticsData.sortedCategories.map((cat, index) => {
                        const amount = analyticsData.categoryTotals[cat];
                        const percentage = (amount / analyticsData.totalAllTime) * 100;
                        const colors = ['bg-teal-500', 'bg-blue-500', 'bg-purple-500', 'bg-rose-500', 'bg-orange-500', 'bg-indigo-500'];
                        const barColor = colors[index % colors.length];

                        return (
                          <div key={cat}>
                            <div className="flex justify-between text-xs font-bold mb-1.5">
                              <span className={isDarkMode ? 'text-slate-300' : 'text-gray-700'}>{cat}</span>
                              <span className={isDarkMode ? 'text-slate-400' : 'text-gray-500'}>RM {amount.toFixed(2)}</span>
                            </div>
                            <div className={`h-2 w-full rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                              <div className={`h-full ${barColor} rounded-full`} style={{ width: `${percentage}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h4 className={`text-xs font-bold uppercase tracking-widest mb-3 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>Rekod Sesi Terdahulu</h4>
                    <div className="space-y-3">
                      {[...roomData.pastSessions].reverse().map(session => {
                        const sessionDate = new Date(session.date);
                        return (
                          <div key={session.id} className={`p-4 rounded-2xl shadow-sm border flex justify-between items-center ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
                            <div>
                              <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-300' : 'text-gray-800'}`}>
                                {session.listName || 'Senarai Utama'}
                              </p>
                              <p className={`text-[10px] font-bold mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>
                                {sessionDate.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })} • {sessionDate.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <p className={`font-bold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>RM {session.totalSpent.toFixed(2)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className={`pt-6 pb-2 border-t border-dashed ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                    {!confirmClean ? (
                      <button onClick={() => setConfirmClean(true)} className={`w-full py-3 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 ${isDarkMode ? 'bg-rose-900/20 text-rose-400 hover:bg-rose-900/40' : 'bg-rose-50 text-rose-500 hover:bg-rose-100'}`}>
                        <AlertTriangle className="w-4 h-4" /> Cuci Rekod Lama ({'>'} 6 Bulan)
                      </button>
                    ) : (
                      <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-rose-900/10 border-rose-900/30' : 'bg-rose-50 border-rose-200'}`}>
                        <p className={`text-xs font-bold text-center mb-3 ${isDarkMode ? 'text-rose-400' : 'text-rose-600'}`}>
                          Adakah anda pasti? Rekod lama tidak boleh dikembalikan.
                        </p>
                        <div className="flex gap-2">
                          <button onClick={() => setConfirmClean(false)} className={`flex-1 py-2 text-xs font-bold rounded-lg ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-white text-gray-600'}`}>Batal</button>
                          <button onClick={cleanOldHistory} className="flex-1 py-2 text-xs font-bold rounded-lg bg-rose-500 text-white shadow-md shadow-rose-500/30">Ya, Sahkan</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}