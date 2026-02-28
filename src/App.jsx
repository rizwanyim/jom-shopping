import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, Plus, CheckCircle2, Circle, LogOut, 
  Wallet, Tag, Trash2, Edit3, X, History, ShoppingBag,
  Sparkles, ArrowRight
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
const firebaseConfig = {
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
  'Barang Basah (Ayam/Ikan)',
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

  // UI States
  const [inputCode, setInputCode] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMasterModal, setShowMasterModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);

  // Form States
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState(KATEGORI_LALAI[0]);
  const [budgetInput, setBudgetInput] = useState('');

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

  const toggleBought = async (itemId, currentStatus) => {
    if (!roomData) return;
    const newList = roomData.activeList.map(item => 
      item.id === itemId ? { ...item, isBought: !currentStatus } : item
    );
    await updateRoomData({ activeList: newList });
  };

  const updatePrice = async (itemId, newPrice) => {
    if (!roomData) return;
    const newList = roomData.activeList.map(item => 
      item.id === itemId ? { ...item, price: parseFloat(newPrice) || 0 } : item
    );
    await updateRoomData({ activeList: newList });
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

  // --- Analitik & Pengiraan ---
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


  // --- Skrin Antaramuka (UI) ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-teal-50 text-teal-600">
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');`}</style>
        <ShoppingCart className="animate-bounce w-12 h-12" />
      </div>
    );
  }

  // 1. Skrin Log Masuk / Sertai Bilik
  if (!roomCode || !roomData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-emerald-100 flex flex-col items-center justify-center p-4 relative overflow-hidden" style={{ fontFamily: "'Poppins', sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');`}</style>
        
        {/* Latar belakang hiasan bulat */}
        <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-72 h-72 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>

        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] shadow-2xl border border-white/50 w-full max-w-md text-center relative z-10">
          <div className="bg-gradient-to-tr from-teal-500 to-emerald-400 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-teal-500/30 transform rotate-3">
            <ShoppingBag className="w-12 h-12 text-white -rotate-3" />
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-3 tracking-tight">Jom Shopping</h1>
          <p className="text-gray-500 mb-8 font-medium">Kongsi senarai & pantau perbelanjaan runcit bersama.</p>

          <form onSubmit={joinRoom} className="space-y-4">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Kod Bilik (Cth: T8F2X)" 
                className="w-full text-center text-xl p-4 bg-white/50 border-2 border-teal-100 rounded-2xl focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 uppercase font-bold tracking-widest text-teal-900 transition-all"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
              />
            </div>
            <button 
              type="submit"
              disabled={!inputCode.trim()}
              className="w-full bg-gradient-to-r from-teal-600 to-emerald-500 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
            >
              <span className="flex items-center justify-center gap-2">
                Sertai Bilik <ArrowRight className="w-5 h-5" />
              </span>
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200/50">
            <p className="text-sm text-gray-400 font-medium mb-4">Atau mulakan sesi baru?</p>
            <button 
              onClick={generateRoomCode}
              className="w-full bg-teal-50 text-teal-700 font-bold py-4 rounded-2xl hover:bg-teal-100 transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" /> Cipta Bilik Baru
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Skrin Utama (Aplikasi Jom Shopping)
  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-32" style={{ fontFamily: "'Poppins', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');`}</style>

      {/* Header & Kad Bajet */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-500 text-white pt-8 pb-32 px-4 rounded-b-[3rem] shadow-lg relative">
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Jom Shopping</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-black/10 px-4 py-1.5 rounded-full text-sm font-bold tracking-wider backdrop-blur-sm border border-white/10">
                {roomCode}
              </span>
              <button onClick={leaveRoom} className="p-2 bg-black/10 rounded-full hover:bg-black/20 transition backdrop-blur-sm border border-white/10">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Kad Bajet Terapung */}
          <div className="bg-white rounded-[2rem] p-6 shadow-2xl shadow-teal-900/10 text-gray-800 absolute left-4 right-4 max-w-3xl mx-auto top-[100px] border border-gray-100">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm text-gray-400 font-medium flex items-center gap-1.5 mb-1">
                  <Wallet className="w-4 h-4 text-teal-500" /> Baki Bajet
                </p>
                <h2 className={`text-4xl font-bold tracking-tight ${remaining < 0 ? 'text-rose-500' : 'text-gray-800'}`}>
                  <span className="text-2xl text-gray-400 mr-1">RM</span>
                  {remaining.toFixed(2)}
                </h2>
              </div>
              <button 
                onClick={() => { setBudgetInput(totalBudget.toString()); setShowBudgetModal(true); }}
                className="bg-teal-50 p-2.5 rounded-full hover:bg-teal-100 text-teal-600 transition-colors"
              >
                <Edit3 className="w-5 h-5" />
              </button>
            </div>
            
            {/* Bar Kemajuan */}
            <div className="mb-4">
              <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${getProgressColor()} transition-all duration-500 ease-out`}
                  style={{ width: `${percentUsed}%` }}
                ></div>
              </div>
            </div>

            <div className="flex gap-4 pt-2">
              <div className="flex-1 bg-gray-50 rounded-xl p-3 border border-gray-100/50">
                <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Sasaran</p>
                <p className="font-bold text-gray-700">RM {totalBudget.toFixed(2)}</p>
              </div>
              <div className="flex-1 bg-rose-50 rounded-xl p-3 border border-rose-100/50">
                <p className="text-[11px] text-rose-400 font-semibold uppercase tracking-wider mb-1">Dibelanjakan</p>
                <p className="font-bold text-rose-600">RM {totalSpent.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ruang Kosong untuk adjust absolute positioning kad bajet */}
      <div className="h-32"></div>

      {/* Senarai Barang Mengikut Kategori */}
      <div className="max-w-3xl mx-auto px-4 mt-8">
        
        {Object.keys(groupedItems).length === 0 ? (
          <div className="text-center py-20">
            <div className="bg-teal-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingCart className="w-10 h-10 text-teal-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">Senarai Masih Kosong</h3>
            <p className="text-gray-400 font-medium">Mula tambah barang keperluan anda di bawah.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.keys(groupedItems).map(category => (
              <div key={category} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Tajuk Kategori */}
                <div className="flex items-center gap-3 mb-4 px-2">
                  <div className="bg-teal-100 p-1.5 rounded-lg">
                    <Tag className="w-4 h-4 text-teal-600" />
                  </div>
                  <h3 className="font-bold text-gray-700 text-lg flex-1">{category}</h3>
                  <span className="text-xs font-bold text-teal-700 bg-teal-100 px-3 py-1.5 rounded-full">
                    {groupedItems[category].filter(i => i.isBought).length} / {groupedItems[category].length}
                  </span>
                </div>
                
                {/* Item-item dalam kategori */}
                <div className="space-y-3">
                  {groupedItems[category].map(item => (
                    <div 
                      key={item.id} 
                      className={`group p-4 rounded-2xl border transition-all duration-300 ${
                        item.isBought 
                          ? 'bg-gray-50/80 border-gray-200/60 opacity-75' 
                          : 'bg-white border-teal-100/50 shadow-sm hover:shadow-md hover:border-teal-200'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {/* Checkbox */}
                        <button 
                          onClick={() => toggleBought(item.id, item.isBought)}
                          className="flex-shrink-0 focus:outline-none transform transition-transform active:scale-90"
                        >
                          {item.isBought ? (
                            <CheckCircle2 className="w-8 h-8 text-teal-500 fill-teal-50" />
                          ) : (
                            <Circle className="w-8 h-8 text-gray-300 hover:text-teal-400 transition-colors" />
                          )}
                        </button>
                        
                        {/* Butiran Item */}
                        <div className="flex-1">
                          <p className={`font-semibold text-[17px] transition-colors ${item.isBought ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                            {item.name}
                          </p>
                          
                          {/* Input Harga */}
                          <div className={`mt-2 transition-all duration-300 overflow-hidden ${item.isBought ? 'max-h-12 opacity-100' : 'max-h-0 opacity-0'}`}>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-gray-400 bg-gray-100 px-2 py-1.5 rounded-md">RM</span>
                              <input 
                                type="number" 
                                step="0.01"
                                min="0"
                                value={item.price || ''}
                                onChange={(e) => updatePrice(item.id, e.target.value)}
                                placeholder="0.00"
                                className="w-28 bg-white border-2 border-teal-100 text-sm p-1.5 rounded-lg font-semibold text-gray-700 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Buang Item */}
                        <button 
                          onClick={() => removeItem(item.id)}
                          className="text-gray-300 hover:text-rose-500 p-2 hover:bg-rose-50 rounded-full transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Butang Bersihkan Yang Selesai */}
        {(roomData?.activeList || []).some(i => i.isBought) && (
          <div className="mt-10 mb-6 text-center">
            <button 
              onClick={clearCompleted}
              className="inline-flex items-center gap-2 text-sm font-semibold text-teal-600 bg-teal-50 hover:bg-teal-100 px-6 py-3 rounded-full transition-colors"
            >
              <Sparkles className="w-4 h-4" /> Bersihkan item yang dibeli
            </button>
          </div>
        )}
      </div>

      {/* Floating Action Buttons (Gaya Kaca / Glassmorphism) */}
      <div className="fixed bottom-6 left-4 right-4 z-40">
        <div className="max-w-md mx-auto bg-white/80 backdrop-blur-xl p-2 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white flex gap-2">
          <button 
            onClick={() => setShowMasterModal(true)}
            className="flex-1 bg-gray-50 text-gray-700 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
          >
            <History className="w-5 h-5" /> Senarai Kerap
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex-1 bg-teal-600 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-teal-600/30 hover:bg-teal-700 hover:-translate-y-0.5 transition-all"
          >
            <Plus className="w-5 h-5" /> Tambah
          </button>
        </div>
      </div>

      {/* --- MODAL: Tambah Barang Baru --- */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-8 duration-300 shadow-2xl">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">Tambah Barang Baru</h3>
                <button onClick={() => setShowAddModal(false)} className="bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"><X className="w-5 h-5"/></button>
              </div>
              <form onSubmit={addItem} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-2">Nama Barang</label>
                  <input 
                    autoFocus
                    type="text" 
                    required
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Contoh: Ikan Siakap"
                    className="w-full border-2 border-gray-200 rounded-xl p-3.5 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 font-medium transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-2">Kategori Lorong</label>
                  <select 
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl p-3.5 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 bg-white font-medium appearance-none transition-all"
                  >
                    {KATEGORI_LALAI.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="w-full bg-teal-600 text-white font-bold py-4 rounded-xl mt-6 shadow-lg shadow-teal-600/30 hover:bg-teal-700 transition-colors">
                  Masukkan ke Senarai
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: Senarai Induk (Kerap Dibeli) --- */}
      {showMasterModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-8 duration-300 shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white z-10">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Senarai Kerap Dibeli</h3>
                <p className="text-sm text-teal-600 font-medium mt-1">Pilih untuk tambah pantas</p>
              </div>
              <button onClick={() => setShowMasterModal(false)} className="bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="overflow-y-auto p-4 flex-1 bg-gray-50/50">
              {(!roomData?.masterList || roomData.masterList.length === 0) ? (
                <div className="text-center text-gray-400 py-12">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">Belum ada sejarah barang.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {roomData.masterList.map(masterItem => {
                    const isAlreadyInActive = (roomData.activeList || []).some(i => i.name.toLowerCase() === masterItem.name.toLowerCase());
                    return (
                      <div key={masterItem.id} className="flex justify-between items-center bg-white border border-gray-100 p-3.5 rounded-2xl shadow-sm">
                        <div>
                          <p className="font-bold text-gray-800">{masterItem.name}</p>
                          <p className="text-xs font-semibold text-gray-400 mt-0.5">{masterItem.category}</p>
                        </div>
                        <button 
                          onClick={() => addFromMaster(masterItem)}
                          disabled={isAlreadyInActive}
                          className={`p-2.5 rounded-xl transition-all ${
                            isAlreadyInActive 
                              ? 'bg-gray-100 text-gray-400' 
                              : 'bg-teal-50 text-teal-600 hover:bg-teal-100 hover:scale-105 active:scale-95'
                          }`}
                        >
                          {isAlreadyInActive ? <CheckCircle2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
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

      {/* --- MODAL: Tetapkan Bajet --- */}
      {showBudgetModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden p-6 animate-in zoom-in-95 duration-200 shadow-2xl">
            <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center mb-4">
              <Wallet className="w-6 h-6 text-teal-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Tetapkan Bajet</h3>
            <p className="text-sm text-gray-500 font-medium mb-6">Berapa bajet anda untuk sesi kali ini?</p>
            
            <form onSubmit={updateBudget}>
              <div className="flex items-center gap-3 border-2 border-teal-200 rounded-2xl p-4 mb-8 bg-teal-50/50 focus-within:border-teal-500 focus-within:ring-4 focus-within:ring-teal-500/10 transition-all">
                <span className="font-bold text-teal-700 text-xl">RM</span>
                <input 
                  autoFocus
                  type="number" 
                  step="1"
                  min="0"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  className="w-full bg-transparent text-3xl font-bold text-gray-800 focus:outline-none placeholder-gray-300"
                  placeholder="0"
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowBudgetModal(false)} className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors">
                  Batal
                </button>
                <button type="submit" className="flex-1 py-4 bg-teal-600 text-white font-bold rounded-xl shadow-lg shadow-teal-600/30 hover:bg-teal-700 transition-colors">
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}