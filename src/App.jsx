import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, Plus, CheckCircle2, Circle, LogOut, 
  Wallet, Tag, Trash2, Edit3, X, History, ShoppingBag,
  Sparkles, ArrowRight, Scale, Search
} from 'lucide-react';
import { 
  initializeApp 
} from 'firebase/app';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, doc, onSnapshot, setDoc, updateDoc 
} from 'firebase/firestore';

// --- Konfigurasi Firebase ---
// SILA GANTIKAN BLOK INI DENGAN KUNCI FIREBASE ANDA UNTUK VERCEL
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
const appId = typeof __app_id !== 'undefined' ? __app_id : 'jom-shopping-app';

// Kategori Lalai
const KATEGORI_LALAI = [
  'Barang Basah',
  'Sayur & Buah',
  'Barangan Kering (Beras/Minyak)',
  'Keperluan Rumah (Sabun/Tisu)',
  'Snek & Minuman',
  'Lain-lain'
];

export default function JomShoppingApp() {
  const [user, setUser] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [loading, setLoading] = useState(true);

  // UI States (Modal Toggles)
  const [inputCode, setInputCode] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMasterModal, setShowMasterModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  
  // State untuk Popup Harga & Carian Senarai Kerap
  const [priceModalItem, setPriceModalItem] = useState(null);
  const [priceInput, setPriceInput] = useState('');
  const [searchMasterQuery, setSearchMasterQuery] = useState('');

  // Form States (Tambah Barang)
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState(KATEGORI_LALAI[0]);
  const [budgetInput, setBudgetInput] = useState('');

  // States untuk Perbandingan Harga
  const [compA, setCompA] = useState({ price: '', qty: '', unit: 'g' });
  const [compB, setCompB] = useState({ price: '', qty: '', unit: 'g' });

  // 1. Inisialisasi Auth
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

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Dengar Perubahan Data Bilik (Real-time)
  useEffect(() => {
    if (!user || !roomCode) return;

    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'jom_shopping_rooms', roomCode);
    
    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        setRoomData(docSnap.data());
      } else {
        const initialData = {
          id: roomCode,
          budget: 0,
          activeList: [],
          masterList: []
        };
        setDoc(roomRef, initialData);
        setRoomData(initialData);
      }
    }, (error) => {
      console.error("Ralat membaca data:", error);
    });

    return () => unsubscribe();
  }, [user, roomCode]);

  // --- Fungsi Aplikasi ---
  const generateRoomCode = () => {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    setRoomCode(code);
  };

  const joinRoom = (e) => {
    e.preventDefault();
    if (inputCode.trim()) {
      setRoomCode(inputCode.trim().toUpperCase());
    }
  };

  const leaveRoom = () => {
    setRoomCode('');
    setRoomData(null);
  };

  const updateRoomData = async (newData) => {
    if (!roomCode) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'jom_shopping_rooms', roomCode);
    await updateDoc(roomRef, newData);
  };

  const addItem = async (e) => {
    e.preventDefault();
    if (!newItemName.trim() || !roomData) return;

    const newItemId = Date.now().toString();
    const newItem = {
      id: newItemId,
      name: newItemName.trim(),
      category: newItemCategory,
      price: 0,
      isBought: false
    };

    const newActiveList = [...(roomData.activeList || []), newItem];
    let newMasterList = [...(roomData.masterList || [])];
    const existsInMaster = newMasterList.find(i => i.name.toLowerCase() === newItem.name.toLowerCase());
    if (!existsInMaster) {
      newMasterList.push({ id: newItemId, name: newItem.name, category: newItem.category });
    }

    await updateRoomData({ activeList: newActiveList, masterList: newMasterList });
    setNewItemName('');
    setShowAddModal(false);
  };

  const addFromMaster = async (masterItem) => {
    if (!roomData) return;
    const activeList = roomData.activeList || [];
    if (activeList.find(i => i.name.toLowerCase() === masterItem.name.toLowerCase())) return;

    const newItem = {
      id: Date.now().toString(),
      name: masterItem.name,
      category: masterItem.category,
      price: 0,
      isBought: false
    };
    await updateRoomData({ activeList: [...activeList, newItem] });
  };

  // Interaksi Tick & Popup Harga
  const handleItemClick = async (item) => {
    if (item.isBought) {
      const newList = roomData.activeList.map(i => 
        i.id === item.id ? { ...i, isBought: false, price: 0 } : i
      );
      await updateRoomData({ activeList: newList });
    } else {
      setPriceModalItem(item);
      setPriceInput('');
    }
  };

  const confirmItemPrice = async (e) => {
    e.preventDefault();
    if (!roomData || !priceModalItem) return;

    const finalPrice = parseFloat(priceInput) || 0;
    
    const newList = roomData.activeList.map(item => 
      item.id === priceModalItem.id 
        ? { ...item, isBought: true, price: finalPrice } 
        : item
    );
    
    await updateRoomData({ activeList: newList });
    setPriceModalItem(null);
    setPriceInput('');
  };

  const removeItem = async (itemId) => {
    if (!roomData) return;
    const newList = roomData.activeList.filter(item => item.id !== itemId);
    await updateRoomData({ activeList: newList });
  };

  const updateBudget = async (e) => {
    e.preventDefault();
    if (!roomData) return;
    await updateRoomData({ budget: parseFloat(budgetInput) || 0 });
    setShowBudgetModal(false);
  };

  const clearCompleted = async () => {
    if (!roomData) return;
    const newList = roomData.activeList.filter(item => !item.isBought);
    await updateRoomData({ activeList: newList });
  };

  // --- Analitik & Pengiraan Bajet ---
  const { totalBudget, totalSpent, remaining, percentUsed, groupedItems } = useMemo(() => {
    if (!roomData) return { totalBudget: 0, totalSpent: 0, remaining: 0, percentUsed: 0, groupedItems: {} };
    
    const budget = roomData.budget || 0;
    const active = roomData.activeList || [];
    const spent = active.filter(i => i.isBought).reduce((sum, item) => sum + (item.price || 0), 0);
    const bal = budget - spent;
    const percent = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

    const grouped = {};
    active.forEach(item => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    });

    return { totalBudget: budget, totalSpent: spent, remaining: bal, percentUsed: percent, groupedItems: grouped };
  }, [roomData]);

  const getProgressColor = () => {
    if (percentUsed < 50) return 'bg-teal-400';
    if (percentUsed < 80) return 'bg-yellow-400';
    return 'bg-rose-500';
  };

  // --- Logik Carian Senarai Kerap ---
  const filteredMasterList = useMemo(() => {
    if (!roomData?.masterList) return [];
    if (!searchMasterQuery.trim()) return roomData.masterList;
    
    return roomData.masterList.filter(item => 
      item.name.toLowerCase().includes(searchMasterQuery.toLowerCase()) || 
      item.category.toLowerCase().includes(searchMasterQuery.toLowerCase())
    );
  }, [roomData?.masterList, searchMasterQuery]);

  // --- Logik Perbandingan Harga ---
  const calculateBestValue = () => {
    if (!compA.price || !compA.qty || !compB.price || !compB.qty) return null;

    const getBaseMultiplier = (unit) => {
      if (unit === 'kg' || unit === 'L') return 1000;
      return 1;
    };

    const costPerBaseUnitA = parseFloat(compA.price) / (parseFloat(compA.qty) * getBaseMultiplier(compA.unit));
    const costPerBaseUnitB = parseFloat(compB.price) / (parseFloat(compB.qty) * getBaseMultiplier(compB.unit));

    if (costPerBaseUnitA === costPerBaseUnitB) return 'Sama nilai berbaloi.';
    
    if (costPerBaseUnitA < costPerBaseUnitB) {
      const percentSave = ((costPerBaseUnitB - costPerBaseUnitA) / costPerBaseUnitB) * 100;
      return { winner: 'A', text: `Barang A lebih berbaloi! (Jimat ${percentSave.toFixed(0)}%)` };
    } else {
      const percentSave = ((costPerBaseUnitA - costPerBaseUnitB) / costPerBaseUnitA) * 100;
      return { winner: 'B', text: `Barang B lebih berbaloi! (Jimat ${percentSave.toFixed(0)}%)` };
    }
  };


  // --- Skrin Antaramuka (UI) ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-teal-50 text-teal-600">
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');`}</style>
        <ShoppingCart className="animate-bounce w-12 h-12" />
      </div>
    );
  }

  if (!roomCode || !roomData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-emerald-100 flex flex-col items-center justify-center p-4 relative overflow-hidden" style={{ fontFamily: "'Poppins', sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');`}</style>
        <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-72 h-72 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>

        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] shadow-2xl border border-white/50 w-full max-w-md text-center relative z-10">
          <div className="bg-gradient-to-tr from-teal-500 to-emerald-400 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-teal-500/30 transform rotate-3">
            <ShoppingBag className="w-10 h-10 text-white -rotate-3" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2 tracking-tight">Jom Shopping</h1>
          <p className="text-sm text-gray-500 mb-8 font-medium">Kongsi senarai & pantau perbelanjaan runcit bersama.</p>

          <form onSubmit={joinRoom} className="space-y-4">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Kod Bilik (Cth: T8F2X)" 
                className="w-full text-center text-lg p-3.5 bg-white/50 border-2 border-teal-100 rounded-2xl focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 uppercase font-bold tracking-widest text-teal-900 transition-all"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
              />
            </div>
            <button 
              type="submit"
              disabled={!inputCode.trim()}
              className="w-full bg-gradient-to-r from-teal-600 to-emerald-500 text-white font-semibold py-3.5 rounded-2xl shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
            >
              <span className="flex items-center justify-center gap-2">
                Sertai Bilik <ArrowRight className="w-5 h-5" />
              </span>
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200/50">
            <p className="text-xs text-gray-400 font-medium mb-4">Atau mulakan sesi baru?</p>
            <button 
              onClick={generateRoomCode}
              className="w-full bg-teal-50 text-teal-700 font-bold py-3.5 rounded-2xl hover:bg-teal-100 transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Sparkles className="w-4 h-4" /> Cipta Bilik Baru
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-28" style={{ fontFamily: "'Poppins', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');`}</style>

      {/* Header & Kad Bajet */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-500 text-white pt-6 pb-28 px-4 rounded-b-[2.5rem] shadow-lg relative">
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <h1 className="text-lg font-bold tracking-tight">Jom Shopping</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-black/10 px-3 py-1 rounded-full text-xs font-bold tracking-wider backdrop-blur-sm border border-white/10 uppercase">
                {roomCode}
              </span>
              <button onClick={leaveRoom} className="p-1.5 bg-black/10 rounded-full hover:bg-black/20 transition backdrop-blur-sm border border-white/10">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-xl shadow-teal-900/10 text-gray-800 absolute left-4 right-4 max-w-3xl mx-auto top-[76px] border border-gray-100">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-xs text-gray-400 font-medium flex items-center gap-1.5 mb-0.5">
                  <Wallet className="w-3.5 h-3.5 text-teal-500" /> Baki Bajet
                </p>
                <h2 className={`text-3xl md:text-4xl font-bold tracking-tight ${remaining < 0 ? 'text-rose-500' : 'text-gray-800'}`}>
                  <span className="text-xl text-gray-400 mr-1">RM</span>
                  {remaining.toFixed(2)}
                </h2>
              </div>
              <button 
                onClick={() => { setBudgetInput(totalBudget.toString()); setShowBudgetModal(true); }}
                className="bg-teal-50 p-2 rounded-full hover:bg-teal-100 text-teal-600 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
            
            <div className="mb-3">
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${getProgressColor()} transition-all duration-500 ease-out`}
                  style={{ width: `${percentUsed}%` }}
                ></div>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <div className="flex-1 bg-gray-50 rounded-lg p-2.5 border border-gray-100/50">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Sasaran</p>
                <p className="font-bold text-gray-700 text-sm md:text-base">RM {totalBudget.toFixed(2)}</p>
              </div>
              <div className="flex-1 bg-rose-50 rounded-lg p-2.5 border border-rose-100/50">
                <p className="text-[10px] text-rose-400 font-bold uppercase tracking-wider mb-0.5">Belanja</p>
                <p className="font-bold text-rose-600 text-sm md:text-base">RM {totalSpent.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="h-28 md:h-32"></div>

      {/* Senarai Barang Mengikut Kategori */}
      <div className="max-w-3xl mx-auto px-4 mt-4">
        
        {Object.keys(groupedItems).length === 0 ? (
          <div className="text-center py-16">
            <div className="bg-teal-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="w-8 h-8 text-teal-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-700 mb-1">Senarai Masih Kosong</h3>
            <p className="text-sm text-gray-400 font-medium">Mula tambah barang keperluan anda di bawah.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.keys(groupedItems).map(category => (
              <div key={category} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="bg-teal-100 p-1.5 rounded-md">
                    <Tag className="w-3.5 h-3.5 text-teal-600" />
                  </div>
                  <h3 className="font-bold text-gray-700 text-sm md:text-base flex-1 leading-tight">{category}</h3>
                  <span className="text-[11px] font-bold text-teal-700 bg-teal-100 px-2.5 py-1 rounded-full">
                    {groupedItems[category].filter(i => i.isBought).length} / {groupedItems[category].length}
                  </span>
                </div>
                
                <div className="space-y-2.5">
                  {groupedItems[category].map(item => (
                    <div 
                      key={item.id} 
                      className={`group rounded-2xl border transition-all duration-300 overflow-hidden ${
                        item.isBought 
                          ? 'bg-gray-50/80 border-gray-200/60 opacity-80' 
                          : 'bg-white border-teal-100/50 shadow-sm hover:shadow-md hover:border-teal-200'
                      }`}
                    >
                      <div className="flex items-center justify-between p-3.5">
                        <div className="flex items-center gap-3.5 flex-1 cursor-pointer" onClick={() => handleItemClick(item)}>
                          <button className="flex-shrink-0 focus:outline-none transform transition-transform active:scale-90">
                            {item.isBought ? (
                              <CheckCircle2 className="w-6 h-6 text-teal-500 fill-teal-50" />
                            ) : (
                              <Circle className="w-6 h-6 text-gray-300 group-hover:text-teal-400 transition-colors" />
                            )}
                          </button>
                          
                          <div className="flex-1">
                            <p className={`font-semibold text-sm md:text-base transition-colors ${item.isBought ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                              {item.name}
                            </p>
                            {item.isBought && item.price > 0 && (
                              <span className="inline-block mt-0.5 text-[11px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md">
                                RM {item.price.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>

                        <button onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} className="text-gray-300 hover:text-rose-500 p-2 ml-2 hover:bg-rose-50 rounded-full transition-colors">
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

        {(roomData?.activeList || []).some(i => i.isBought) && (
          <div className="mt-8 mb-4 text-center">
            <button onClick={clearCompleted} className="inline-flex items-center gap-2 text-xs font-semibold text-teal-600 bg-teal-50 hover:bg-teal-100 px-5 py-2.5 rounded-full transition-colors">
              <Sparkles className="w-3.5 h-3.5" /> Buang item selesai
            </button>
          </div>
        )}
      </div>

      <div className="fixed bottom-4 left-4 right-4 z-40">
        <div className="max-w-md mx-auto bg-white/90 backdrop-blur-xl p-1.5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white flex gap-1.5">
          <button onClick={() => { setShowMasterModal(true); setSearchMasterQuery(''); }} className="flex-1 bg-transparent text-gray-600 font-bold py-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-gray-50 transition-colors">
            <History className="w-5 h-5" />
            <span className="text-[10px] tracking-wide">Sejarah</span>
          </button>
          <button onClick={() => setShowCompareModal(true)} className="flex-1 bg-transparent text-blue-600 font-bold py-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-blue-50 transition-colors">
            <Scale className="w-5 h-5" />
            <span className="text-[10px] tracking-wide">Banding</span>
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex-[1.2] bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-bold py-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 shadow-lg shadow-teal-500/20 hover:-translate-y-0.5 transition-all">
            <Plus className="w-5 h-5" />
            <span className="text-[10px] tracking-wide">Tambah</span>
          </button>
        </div>
      </div>

      {/* --- MODAL: POPUP HARGA --- */}
      {priceModalItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-xs overflow-hidden p-6 animate-in zoom-in-95 duration-200 shadow-2xl">
            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Tag className="w-6 h-6 text-teal-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">{priceModalItem.name}</h3>
              <p className="text-xs text-gray-500 font-medium mt-1">Sila masukkan harga barang ini</p>
            </div>
            <form onSubmit={confirmItemPrice}>
              <div className="flex items-center gap-2 border-2 border-teal-200 rounded-2xl p-3 mb-6 bg-teal-50/50 focus-within:border-teal-500 focus-within:ring-4 focus-within:ring-teal-500/10 transition-all">
                <span className="font-bold text-teal-700 text-lg">RM</span>
                <input autoFocus type="number" step="0.01" min="0" required value={priceInput} onChange={(e) => setPriceInput(e.target.value)} className="w-full bg-transparent text-2xl font-bold text-gray-800 focus:outline-none placeholder-gray-300" placeholder="0.00" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPriceModalItem(null)} className="flex-1 py-3 bg-gray-100 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-200 transition-colors">Batal</button>
                <button type="submit" className="flex-[1.5] py-3 bg-teal-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-teal-600/30 hover:bg-teal-700 transition-colors">Sahkan & Tanda</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: BANDING HARGA --- */}
      {showCompareModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden p-5 animate-in slide-in-from-bottom-8 duration-300 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="bg-blue-100 p-1.5 rounded-lg"><Scale className="w-4 h-4 text-blue-600" /></div>
                <h3 className="text-base font-bold text-gray-800">Banding Harga</h3>
              </div>
              <button onClick={() => setShowCompareModal(false)} className="bg-gray-100 p-1.5 rounded-full text-gray-500 hover:bg-gray-200"><X className="w-4 h-4"/></button>
            </div>
            

            <div className="space-y-4">
              {/* Barang A */}
              <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200/60">
                <p className="text-xs font-bold text-gray-700 mb-2">Barang A</p>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <span className="absolute left-2.5 top-2.5 text-xs font-bold text-gray-400">RM</span>
                    <input type="number" step="0.01" value={compA.price} onChange={e=>setCompA({...compA, price: e.target.value})} placeholder="Harga" className="w-full text-sm pl-8 pr-2 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-blue-500 font-semibold" />
                  </div>
                  <div className="flex-1">
                    <input type="number" step="0.01" value={compA.qty} onChange={e=>setCompA({...compA, qty: e.target.value})} placeholder="Kuantiti" className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-blue-500 font-semibold" />
                  </div>
                  <select value={compA.unit} onChange={e=>setCompA({...compA, unit: e.target.value})} className="w-16 text-xs px-1 py-2 rounded-xl border border-gray-200 bg-white font-semibold focus:outline-none focus:border-blue-500 appearance-none text-center">
                    <option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="L">L</option><option value="pcs">pcs</option>
                  </select>
                </div>
              </div>

              {/* VS Divider */}
              <div className="relative h-4 flex items-center justify-center">
                <div className="absolute w-full h-px bg-gray-100"></div>
                <span className="relative bg-white px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Berbanding</span>
              </div>

              {/* Barang B */}
              <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200/60">
                <p className="text-xs font-bold text-gray-700 mb-2">Barang B</p>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <span className="absolute left-2.5 top-2.5 text-xs font-bold text-gray-400">RM</span>
                    <input type="number" step="0.01" value={compB.price} onChange={e=>setCompB({...compB, price: e.target.value})} placeholder="Harga" className="w-full text-sm pl-8 pr-2 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-blue-500 font-semibold" />
                  </div>
                  <div className="flex-1">
                    <input type="number" step="0.01" value={compB.qty} onChange={e=>setCompB({...compB, qty: e.target.value})} placeholder="Kuantiti" className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-blue-500 font-semibold" />
                  </div>
                  <select value={compB.unit} onChange={e=>setCompB({...compB, unit: e.target.value})} className="w-16 text-xs px-1 py-2 rounded-xl border border-gray-200 bg-white font-semibold focus:outline-none focus:border-blue-500 appearance-none text-center">
                    <option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="L">L</option><option value="pcs">pcs</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Keputusan */}
            {calculateBestValue() && typeof calculateBestValue() === 'object' && (
              <div className={`mt-4 p-3 rounded-xl border ${calculateBestValue().winner === 'A' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-blue-50 border-blue-200 text-blue-700'} text-center font-bold text-sm animate-in fade-in zoom-in-95 duration-300`}>
                <Sparkles className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                {calculateBestValue().text}
              </div>
            )}
            {calculateBestValue() === 'Sama nilai berbaloi.' && (
              <div className="mt-4 p-3 rounded-xl bg-gray-100 border border-gray-200 text-gray-600 text-center font-bold text-sm animate-in fade-in">
                Dua-dua sama je nilainya.
              </div>
            )}

            <button onClick={() => { setCompA({price:'',qty:'',unit:'g'}); setCompB({price:'',qty:'',unit:'g'}); }} className="w-full mt-4 py-3 bg-white border-2 border-gray-100 text-gray-500 text-xs font-bold rounded-xl hover:bg-gray-50 transition-colors">
              Reset Semula
            </button>
          </div>
        </div>
      )}

      {/* --- MODAL: Tambah Barang Baru --- */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-8 duration-300 shadow-2xl">
            <div className="p-5">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-lg font-bold text-gray-800">Tambah Barang Baru</h3>
                <button onClick={() => setShowAddModal(false)} className="bg-gray-100 p-1.5 rounded-full text-gray-500 hover:bg-gray-200"><X className="w-5 h-5"/></button>
              </div>
              <form onSubmit={addItem} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Nama Barang</label>
                  <input autoFocus type="text" required value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Contoh: Ikan Siakap" className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-teal-500 font-medium transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Kategori Lorong</label>
                  <select value={newItemCategory} onChange={(e) => setNewItemCategory(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-teal-500 bg-white font-medium appearance-none transition-all">
                    {KATEGORI_LALAI.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="w-full bg-teal-600 text-white font-bold py-3.5 rounded-xl mt-6 shadow-lg shadow-teal-600/30 hover:bg-teal-700 transition-colors text-sm">
                  Masukkan ke Senarai
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: Senarai Induk (Kerap Dibeli) BERSERTA FUNGSI CARIAN --- */}
      {showMasterModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-8 duration-300 shadow-2xl">
            
            {/* Header Modal */}
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white z-10">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Senarai Kerap</h3>
                <p className="text-[11px] text-teal-600 font-bold uppercase tracking-wider mt-0.5">Pilih untuk tambah pantas</p>
              </div>
              <button onClick={() => setShowMasterModal(false)} className="bg-gray-100 p-1.5 rounded-full text-gray-500 hover:bg-gray-200"><X className="w-5 h-5"/></button>
            </div>

            {/* Kotak Carian (Search Input) Baru */}
            <div className="p-4 bg-gray-50 border-b border-gray-100 z-10">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Cari barang atau kategori..." 
                  value={searchMasterQuery}
                  onChange={(e) => setSearchMasterQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all shadow-sm"
                />
                {searchMasterQuery && (
                  <button onClick={() => setSearchMasterQuery('')} className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="overflow-y-auto p-4 flex-1 bg-gray-50/50">
              {(!roomData?.masterList || roomData.masterList.length === 0) ? (
                <div className="text-center text-gray-400 py-10">
                  <History className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm font-medium">Belum ada sejarah barang.</p>
                </div>
              ) : filteredMasterList.length === 0 ? (
                <div className="text-center text-gray-400 py-10">
                  <Search className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm font-medium">Tiada padanan untuk "{searchMasterQuery}"</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredMasterList.map(masterItem => {
                    const isAlreadyInActive = (roomData.activeList || []).some(i => i.name.toLowerCase() === masterItem.name.toLowerCase());
                    return (
                      <div key={masterItem.id} className="flex justify-between items-center bg-white border border-gray-100 p-3 rounded-2xl shadow-sm">
                        <div>
                          <p className="font-bold text-sm text-gray-800">{masterItem.name}</p>
                          <p className="text-[10px] font-bold text-gray-400 mt-0.5 uppercase">{masterItem.category}</p>
                        </div>
                        <button 
                          onClick={() => addFromMaster(masterItem)}
                          disabled={isAlreadyInActive}
                          className={`p-2 rounded-xl transition-all ${
                            isAlreadyInActive ? 'bg-gray-100 text-gray-400' : 'bg-teal-50 text-teal-600 hover:bg-teal-100 active:scale-95'
                          }`}
                        >
                          {isAlreadyInActive ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}