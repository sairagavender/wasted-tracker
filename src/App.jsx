import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, 
} from 'recharts';
import { 
  LayoutDashboard, PieChart as PieChartIcon, HandCoins,
  Moon, Sun, Search, Share2, ArrowUpRight, ArrowDownRight, 
  Wine, Calendar as CalendarIcon, X, Settings, ChevronLeft,
  Pencil, Trash2, Users, Ghost, ArrowRightLeft, CalendarDays, Plus,
  ClipboardPaste, Copy, Split, CheckCircle2, UserCircle2, ArrowLeft
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyCbof1yuALr5XNbrlpTF8GFDl_qA5wxV9g",

  authDomain: "wasted-608fb.firebaseapp.com",

  projectId: "wasted-608fb",

  storageBucket: "wasted-608fb.firebasestorage.app",

  messagingSenderId: "203014769425",

  appId: "1:203014769425:web:0f989470d200c62bcb1ab0",

  measurementId: "G-874MN5WBN3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'wasted-tracker';

const PRESET_COLORS = ['#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#94a3b8'];

const DEFAULT_SETTINGS = {
  tags: [
    { id: 't1', name: 'Food', color: '#f97316' },
    { id: 't2', name: 'Transport', color: '#3b82f6' },
    { id: 't3', name: 'Bills', color: '#eab308' },
    { id: 't4', name: 'Shopping', color: '#ec4899' },
    { id: 't5', name: 'Drinks', color: '#f43f5e' }
  ],
  quickAdds: [],
  friends: []
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  
  // JSON Shared Mode State
  const [sharedData, setSharedData] = useState(null); // If not null, we are in shared mode
  const [showImportModal, setShowImportModal] = useState(false);
  
  // App State
  const [transactions, setTransactions] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  
  // UI State
  const [currentView, setCurrentView] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagDetail, setSelectedTagDetail] = useState(null);
  const [selectedFriendProfile, setSelectedFriendProfile] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  
  // Advanced Time Filter State
  const [timeFilter, setTimeFilter] = useState('monthly'); // lifetime, monthly, weekly, custom
  
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  
  const [customStart, setCustomStart] = useState(new Date().toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().split('T')[0]);
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else if (typeof __firebase_config !== 'undefined') {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Auth init failed", err); }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || sharedData) return; // Don't fetch if in shared viewing mode

    const userId = user.uid;
    const txRef = collection(db, 'artifacts', appId, 'users', userId, 'transactions');
    const unsubTx = onSnapshot(txRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(data);
    });

    const settingsRef = doc(db, 'artifacts', appId, 'users', userId, 'settings', 'preferences');
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) setSettings({ ...DEFAULT_SETTINGS, ...docSnap.data() });
      else setDoc(settingsRef, DEFAULT_SETTINGS);
    });

    return () => { unsubTx(); unsubSettings(); };
  }, [user, sharedData]);

  const dateBounds = useMemo(() => {
     const formatDate = (d) => {
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().split('T')[0];
     };
     
     if (timeFilter === 'weekly') {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
        d.setDate(diff);
        const start = new Date(d);
        const end = new Date(d);
        end.setDate(end.getDate() + 6);
        return { start: formatDate(start), end: formatDate(end), label: 'This Week' };
     }
     
     if (timeFilter === 'monthly') {
        const [year, month] = selectedMonth.split('-');
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0); // Last day of month
        return { start: formatDate(start), end: formatDate(end), label: start.toLocaleString('default', { month: 'long', year: 'numeric' }) };
     }
     
     if (timeFilter === 'custom') {
        return { start: customStart, end: customEnd, label: `${new Date(customStart).toLocaleDateString('en-GB')} to ${new Date(customEnd).toLocaleDateString('en-GB')}` };
     }
     
     return { start: null, end: null, label: 'Lifetime' };
  }, [timeFilter, selectedMonth, customStart, customEnd]);

  const activeTransactions = sharedData ? sharedData.transactions : transactions;
  const activeSettings = sharedData ? sharedData.settings : settings;

  const dateFilteredTransactions = useMemo(() => {
     let filtered = activeTransactions;
     if (dateBounds.start) filtered = filtered.filter(t => t.date >= dateBounds.start);
     if (dateBounds.end) filtered = filtered.filter(t => t.date <= dateBounds.end);
     return filtered;
  }, [activeTransactions, dateBounds]);

  const displayTransactions = useMemo(() => {
    if (!searchQuery) return dateFilteredTransactions;
    const query = searchQuery.toLowerCase();
    return dateFilteredTransactions.filter(t => 
      (t.reason || '').toLowerCase().includes(query) || 
      (t.tag || '').toLowerCase().includes(query) ||
      (t.person || '').toLowerCase().includes(query) ||
      (t.type || '').toLowerCase().includes(query)
    );
  }, [dateFilteredTransactions, searchQuery]);

  const lifetimeBalance = activeTransactions.reduce((acc, t) => {
    if (t.type === 'income' || t.type === 'settle_received') return acc + Number(t.amount);
    if (t.type === 'expense' || t.type === 'lent' || t.type === 'settle_gave') return acc - Number(t.amount);
    return acc; 
  }, 0);

  const periodIncome = dateFilteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
  const periodWasted = dateFilteredTransactions.filter(t => t.type === 'expense' || t.type === 'borrowed').reduce((acc, t) => acc + Number(t.amount), 0);

  const friendLedgers = useMemo(() => {
    const ledgers = {};
    activeTransactions.forEach(t => {
      if (!t.person) return;
      if (!ledgers[t.person]) ledgers[t.person] = { netBalance: 0, history: [] };
      
      const ledger = ledgers[t.person];
      if (t.type === 'lent') ledger.netBalance += Number(t.amount);
      if (t.type === 'borrowed') ledger.netBalance -= Number(t.amount);
      if (t.type === 'settle_received') ledger.netBalance -= Number(t.amount);
      if (t.type === 'settle_gave') ledger.netBalance += Number(t.amount);
      ledger.history.push(t);
    });
    return ledgers;
  }, [activeTransactions]);

  const totalOwedToMe = Object.values(friendLedgers).filter(l => l.netBalance > 0).reduce((acc, l) => acc + l.netBalance, 0);
  const totalIOwe = Object.values(friendLedgers).filter(l => l.netBalance < 0).reduce((acc, l) => acc + Math.abs(l.netBalance), 0);

  const handleGoogleLogin = async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); } 
    catch (e) { await signInAnonymously(auth); }
  };

  const updateSettings = async (newSettings) => {
    if (!user) return;
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'preferences'), updated);
  };

  const addTransaction = async (data) => {
    if (!user) return;
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), {
      ...data, createdAt: new Date().toISOString()
    });
  };

  const updateTransaction = async (id, data) => {
    if (!user) return;
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', id), data);
    setEditingTransaction(null);
  };

  const deleteTransaction = async (id) => {
    if (!user) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', id));
  };

  const handleImportJSON = (jsonString) => {
    try {
      const data = JSON.parse(jsonString);
      if (data.transactions && data.settings) {
        setSharedData(data);
        setShowImportModal(false);
      } else throw new Error("Invalid format");
    } catch (e) {
      alert("Invalid JSON data. Please paste a valid report block.");
    }
  };

  if (loading) return <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>Loading...</div>;

  if (!user && !sharedData) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${darkMode ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
        <div className={`max-w-md w-full p-8 rounded-3xl shadow-2xl ${darkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}>
          <div className="flex justify-center mb-6 text-rose-500"><Wine size={56} /></div>
          <h1 className="text-4xl font-black text-center mb-2 tracking-tighter">WASTED</h1>
          <p className="text-center mb-10 opacity-70 font-medium">Track where your money vanishes.</p>
          <div className="space-y-4">
            <button onClick={handleGoogleLogin} className="w-full py-4 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold transition-transform hover:scale-[1.02] shadow-lg flex justify-center">
              Continue with Google
            </button>
            <button onClick={() => setShowImportModal(true)} className={`w-full py-4 px-4 border-2 border-dashed rounded-2xl font-bold transition-transform hover:scale-[1.02] flex justify-center items-center gap-2 ${darkMode ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-300 hover:bg-gray-50'}`}>
              <ClipboardPaste size={18} /> View a Shared Report
            </button>
          </div>
        </div>
        
        {showImportModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
             <div className={`w-full max-w-lg p-6 rounded-[2rem] shadow-2xl ${darkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}>
                <div className="flex justify-between items-center mb-4">
                   <h3 className="font-black text-xl">Paste Shared JSON</h3>
                   <button onClick={() => setShowImportModal(false)} className="p-2 rounded-full hover:bg-gray-500/20"><X size={20}/></button>
                </div>
                <textarea id="import-json" className={`w-full h-48 p-4 rounded-xl font-mono text-sm border outline-none mb-4 ${darkMode ? 'bg-gray-950 border-gray-800' : 'bg-gray-50 border-gray-300'}`} placeholder='{"transactions": [...]}'></textarea>
                <button onClick={() => handleImportJSON(document.getElementById('import-json').value)} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl">Import & View</button>
             </div>
          </div>
        )}
      </div>
    );
  }

  const toggleTheme = () => setDarkMode(!darkMode);
  const themeClasses = darkMode ? 'bg-gray-950 text-gray-100 border-gray-800' : 'bg-gray-50 text-gray-900 border-gray-200';
  const cardClasses = darkMode ? 'bg-gray-900 border border-gray-800 shadow-lg' : 'bg-white border border-gray-100 shadow-sm';

  return (
    <div className={`min-h-screen flex ${themeClasses} transition-colors duration-200`}>
      <aside className={`hidden md:flex flex-col w-64 border-r ${darkMode ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white'} p-4`}>
        <div className="flex items-center gap-3 font-black text-2xl mb-10 px-2 text-rose-500 tracking-tight">
          <Wine /> WASTED
        </div>
        <nav className="flex-1 space-y-2">
          <NavItem icon={<LayoutDashboard />} label="Dashboard" active={currentView === 'dashboard'} onClick={() => { setCurrentView('dashboard'); setSelectedFriendProfile(null); }} dark={darkMode} />
          <NavItem icon={<PieChartIcon />} label="Analytics" active={currentView === 'analytics' || currentView === 'tagDetails'} onClick={() => { setCurrentView('analytics'); setSelectedFriendProfile(null); }} dark={darkMode} />
          <NavItem icon={<HandCoins />} label="Debts & IOUs" active={currentView === 'debts' || currentView === 'friendProfile'} onClick={() => setCurrentView('debts')} dark={darkMode} />
        </nav>
        <div className="pt-4 border-t border-gray-700/30 flex justify-between items-center px-2">
          <button onClick={toggleTheme} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}>
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <div className="text-xs font-bold opacity-50 truncate max-w-[120px]">{sharedData ? 'Guest Viewer' : (user?.email || 'Anonymous')}</div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className={`md:hidden flex items-center justify-between p-4 border-b ${darkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'}`}>
          <div className="flex items-center gap-2 font-black text-lg text-rose-500 tracking-tight"><Wine size={20}/> WASTED</div>
          <button onClick={toggleTheme} className="p-2">{darkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 relative">
          
          {sharedData && (
             <div className="mb-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex justify-between items-center">
                <span className="font-bold text-amber-600 flex items-center gap-2"><Ghost size={18}/> Viewing Shared Sandbox</span>
                <button onClick={() => setSharedData(null)} className="px-4 py-2 bg-amber-600 text-white rounded-lg font-bold text-sm">Exit Sandbox</button>
             </div>
          )}

          {/* Global Top Bar: Search & Time Filter */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
             <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full xl:w-auto">
                <div className={`flex items-center p-1 rounded-xl border ${darkMode ? 'bg-gray-900/50 border-gray-800' : 'bg-gray-100 border-gray-200'}`}>
                   {['lifetime', 'monthly', 'weekly', 'custom'].map(tf => (
                      <button 
                         key={tf} onClick={() => setTimeFilter(tf)} 
                         className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-bold capitalize transition-all ${timeFilter === tf ? (darkMode ? 'bg-gray-800 text-white shadow' : 'bg-white text-gray-900 shadow') : 'opacity-60 hover:opacity-100'}`}
                      >
                         {tf}
                      </button>
                   ))}
                </div>
                
                {timeFilter === 'monthly' && (
                   <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className={`p-2 px-3 text-sm font-bold rounded-xl border outline-none ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-300'}`} />
                )}

                {timeFilter === 'custom' && (
                   <button onClick={() => setShowCustomPicker(true)} className={`flex items-center gap-2 p-2 px-4 text-sm font-bold rounded-xl border ${darkMode ? 'bg-gray-900 border-gray-800 hover:bg-gray-800' : 'bg-white border-gray-300 hover:bg-gray-50'}`}>
                      <CalendarIcon size={16} /> {new Date(customStart).toLocaleDateString('en-GB')} - {new Date(customEnd).toLocaleDateString('en-GB')}
                   </button>
                )}
             </div>

             <div className="flex items-center gap-3">
                <div className={`flex flex-1 xl:flex-none items-center px-3 py-2 rounded-xl border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                   <Search size={16} className="opacity-50 mr-2" />
                   <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full xl:w-48" />
                </div>
                {!sharedData && (
                   <button onClick={() => setShowShareModal(true)} title="Export JSON Report" className={`p-2.5 rounded-xl border flex items-center gap-2 ${darkMode ? 'bg-rose-900/30 text-rose-400 border-rose-800/50 hover:bg-rose-900/50' : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'}`}>
                      <Share2 size={18} /> <span className="hidden sm:inline text-sm font-bold">Export JSON</span>
                   </button>
                )}
             </div>
          </div>

          {/* Views Routing */}
          {currentView === 'dashboard' && <DashboardView 
            balance={lifetimeBalance} income={periodIncome} expense={periodWasted} 
            transactions={displayTransactions} addTx={addTransaction} deleteTx={deleteTransaction} editTx={setEditingTransaction}
            settings={activeSettings} updateSettings={updateSettings} cardClasses={cardClasses} dark={darkMode} dateBounds={dateBounds}
            readOnly={!!sharedData}
          />}
          
          {currentView === 'analytics' && <AnalyticsView 
            transactions={dateFilteredTransactions} settings={activeSettings} dateBounds={dateBounds}
            onTagClick={(tag) => { setSelectedTagDetail(tag); setCurrentView('tagDetails'); }}
            cardClasses={cardClasses} dark={darkMode}
          />}
          
          {currentView === 'debts' && <DebtsView 
            friendLedgers={friendLedgers} owedToMe={totalOwedToMe} iOwe={totalIOwe}
            onSelectFriend={(name) => { setSelectedFriendProfile(name); setCurrentView('friendProfile'); }}
            cardClasses={cardClasses} dark={darkMode}
          />}

          {currentView === 'friendProfile' && selectedFriendProfile && <FriendProfileView
             friendName={selectedFriendProfile} ledger={friendLedgers[selectedFriendProfile]}
             onBack={() => { setSelectedFriendProfile(null); setCurrentView('debts'); }}
             addTx={addTransaction} editTx={setEditingTransaction} deleteTx={deleteTransaction}
             cardClasses={cardClasses} dark={darkMode} readOnly={!!sharedData} settings={activeSettings}
          />}

          {currentView === 'tagDetails' && <TagDetailsView 
            tag={selectedTagDetail} transactions={dateFilteredTransactions} settings={activeSettings} 
            editTx={setEditingTransaction} deleteTx={deleteTransaction} dateBounds={dateBounds} readOnly={!!sharedData}
            onBack={() => { setSelectedTagDetail(null); setCurrentView('analytics'); }} cardClasses={cardClasses} dark={darkMode}
          />}
        </div>

        <nav className={`md:hidden flex justify-around p-3 border-t pb-safe ${darkMode ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white'}`}>
          <MobileNavItem icon={<LayoutDashboard/>} active={currentView === 'dashboard'} onClick={() => { setCurrentView('dashboard'); setSelectedFriendProfile(null); }} dark={darkMode} />
          <MobileNavItem icon={<PieChartIcon/>} active={currentView === 'analytics' || currentView === 'tagDetails'} onClick={() => { setCurrentView('analytics'); setSelectedFriendProfile(null); }} dark={darkMode} />
          <MobileNavItem icon={<HandCoins/>} active={currentView === 'debts' || currentView === 'friendProfile'} onClick={() => setCurrentView('debts')} dark={darkMode} />
        </nav>
      </main>

      {/* Global Modals */}
      {showShareModal && <JSONShareModal transactions={dateFilteredTransactions} settings={activeSettings} dateBounds={dateBounds} onClose={() => setShowShareModal(false)} dark={darkMode} />}
      {editingTransaction && !sharedData && <EditTransactionModal tx={editingTransaction} settings={activeSettings} onSave={updateTransaction} onClose={() => setEditingTransaction(null)} dark={darkMode} />}
      {showCustomPicker && <CustomDateModal start={customStart} end={customEnd} onSave={(s, e) => { setCustomStart(s); setCustomEnd(e); setShowCustomPicker(false); }} onClose={() => setShowCustomPicker(false)} dark={darkMode} />}
    </div>
  );
}

const NavItem = ({ icon, label, active, onClick, dark }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold ${
    active ? (dark ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-50 text-rose-600') : (dark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600')
  }`}>
    {icon} <span>{label}</span>
  </button>
);

const MobileNavItem = ({ icon, active, onClick, dark }) => (
  <button onClick={onClick} className={`p-3 rounded-xl ${
    active ? (dark ? 'text-rose-400 bg-rose-500/15' : 'text-rose-600 bg-rose-50') : (dark ? 'text-gray-500' : 'text-gray-400')
  }`}>
    {icon}
  </button>
);

const CustomDateModal = ({ start, end, onSave, onClose, dark }) => {
   const [s, setS] = useState(start);
   const [e, setE] = useState(end);

   return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
         <div className={`w-full max-w-sm p-6 rounded-[2rem] shadow-2xl ${dark ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}>
            <h3 className="font-black text-xl mb-6">Select Date Range</h3>
            <div className="space-y-4">
               <div>
                  <label className="block text-xs font-bold uppercase opacity-60 mb-2">Start Date</label>
                  <input type="date" value={s} onChange={e=>setS(e.target.value)} className={`w-full p-3 rounded-xl border outline-none font-bold ${dark ? 'bg-gray-950 border-gray-800' : 'bg-gray-50 border-gray-200'}`} />
               </div>
               <div>
                  <label className="block text-xs font-bold uppercase opacity-60 mb-2">End Date</label>
                  <input type="date" value={e} onChange={ev=>setE(ev.target.value)} className={`w-full p-3 rounded-xl border outline-none font-bold ${dark ? 'bg-gray-950 border-gray-800' : 'bg-gray-50 border-gray-200'}`} />
               </div>
            </div>
            <div className="flex gap-3 mt-8">
               <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold bg-gray-500/10 hover:bg-gray-500/20">Cancel</button>
               <button onClick={() => onSave(s, e)} className="flex-1 py-3 rounded-xl font-bold bg-rose-600 text-white hover:bg-rose-700">Apply</button>
            </div>
         </div>
      </div>
   );
};

const JSONShareModal = ({ transactions, settings, dateBounds, onClose, dark }) => {
   const [copied, setCopied] = useState(false);
   
   const payload = useMemo(() => {
      // Strip internal IDs and clean up data for sharing
      const safeTx = transactions.map(({ id, createdAt, ...rest }) => rest);
      return JSON.stringify({ transactions: safeTx, settings }, null, 2);
   }, [transactions, settings]);

   const copyToClipboard = () => {
      navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
   }

   return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
         <div className={`w-full max-w-lg p-6 rounded-[2rem] shadow-2xl ${dark ? 'bg-gray-900 border border-gray-800 text-white' : 'bg-white text-gray-900'}`}>
            <div className="flex justify-between items-center mb-4">
               <h3 className="font-black text-2xl tracking-tight">Export JSON Report</h3>
               <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-500/20 transition-colors"><X size={20}/></button>
            </div>
            <p className="text-sm opacity-70 mb-4">Copy this block and send it. They can paste it on the login screen to view your tracker interactively for the selected period ({dateBounds.label}).</p>
            
            <div className={`p-4 rounded-xl border h-48 overflow-y-auto mb-4 font-mono text-xs ${dark ? 'bg-gray-950 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
               <pre>{payload}</pre>
            </div>

            <button onClick={copyToClipboard} className={`w-full py-4 rounded-2xl font-black text-lg transition-colors flex justify-center items-center gap-2 ${copied ? 'bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
               {copied ? <CheckCircle2 /> : <Copy />}
               {copied ? 'Copied to Clipboard!' : 'Copy JSON'}
            </button>
         </div>
      </div>
   )
}


const DashboardView = ({ balance, income, expense, transactions, addTx, deleteTx, editTx, settings, updateSettings, cardClasses, dark, dateBounds, readOnly }) => {
  // Base Form State
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [tag, setTag] = useState(settings.tags[0]?.name || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState('expense'); 
  
  // Advanced Modals
  const [showTagModal, setShowTagModal] = useState(false);
  const [showQAModal, setShowQAModal] = useState(false);
  const [showFriendModal, setShowFriendModal] = useState(false);

  // Sub-expense State (Itemized)
  const [subItems, setSubItems] = useState([]);
  
  // Lent Splitwise State
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [splitMode, setSplitMode] = useState('equal'); // equal, custom
  const [customSplits, setCustomSplits] = useState({});

  // Reset states when type changes
  useEffect(() => {
     setSubItems([]);
     setSelectedFriends([]);
     setCustomSplits({});
  }, [type]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || readOnly) return;
    const totalNum = Number(amount);

    // 1. Handle Complex Splitwise Lent
    if (type === 'lent') {
       if (selectedFriends.length === 0) return alert("Select at least one friend.");
       let totalSplit = 0;
       
       selectedFriends.forEach(f => {
          let share = splitMode === 'equal' ? (totalNum / selectedFriends.length) : (Number(customSplits[f]) || 0);
          totalSplit += share;
          if (share > 0) {
             addTx({ type: 'lent', amount: share, person: f, reason: reason || 'Split Bill', date });
          }
       });

       if (splitMode === 'custom' && Math.abs(totalSplit - totalNum) > 0.01) {
          alert(`Custom splits (₹${totalSplit}) do not match total amount (₹${totalNum}).`);
          return;
       }
    } 
    // 2. Handle Sub-itemized Expenses
    else if (type === 'expense' && subItems.length > 0) {
       if (!tag) return alert("Please select a tag.");
       let subTotal = 0;
       subItems.forEach(item => {
          const itemAmt = Number(item.amount);
          if (itemAmt > 0 && item.reason) {
             subTotal += itemAmt;
             addTx({ type: 'expense', amount: itemAmt, reason: item.reason, tag, date });
          }
       });
       
       const remaining = totalNum - subTotal;
       if (remaining > 0) {
          addTx({ type: 'expense', amount: remaining, reason: reason || 'Remaining Balance', tag, date });
       }
    } 
    // 3. Handle Standard Simple Transactions
    else {
       const txData = { amount: totalNum, type, date, reason };
       if (type === 'expense' || type === 'borrowed') {
          if (!tag) return alert("Please select a tag.");
          txData.tag = tag;
       }
       if (type === 'borrowed') {
          if (selectedFriends.length === 0) return alert("Please select a person.");
          txData.person = selectedFriends[0]; // Single borrow only
       }
       addTx(txData);
    }

    // Reset Form
    setAmount(''); setReason(''); setSubItems([]); setSelectedFriends([]); setCustomSplits({});
  };

  const handleFriendToggle = (f) => {
     if (type === 'borrowed') {
        setSelectedFriends([f]); // Borrow is single-select
     } else {
        setSelectedFriends(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
     }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`p-6 rounded-3xl ${cardClasses}`}>
          <div className="text-sm font-bold opacity-60 mb-1 tracking-wider uppercase">Lifetime Bank Balance</div>
          <div className={`text-4xl font-black tracking-tight ${balance >= 0 ? (dark ? 'text-white' : 'text-gray-900') : 'text-rose-500'}`}>
            ₹{balance.toLocaleString('en-IN')}
          </div>
        </div>
        <div className={`p-6 rounded-3xl ${cardClasses}`}>
          <div className="flex items-center gap-2 text-sm font-bold opacity-60 mb-1 tracking-wider uppercase"><ArrowDownRight size={16} className="text-emerald-500"/> Income ({dateBounds.label})</div>
          <div className="text-3xl font-black text-emerald-500 tracking-tight">₹{income.toLocaleString('en-IN')}</div>
        </div>
        <div className={`p-6 rounded-3xl ${cardClasses}`}>
          <div className="flex items-center gap-2 text-sm font-bold opacity-60 mb-1 tracking-wider uppercase"><ArrowUpRight size={16} className="text-rose-500"/> Wasted ({dateBounds.label})</div>
          <div className="text-3xl font-black text-rose-500 tracking-tight">₹{expense.toLocaleString('en-IN')}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* LOG ENTRY PANEL */}
        {!readOnly && (
          <div className="space-y-6 xl:col-span-1">
            <div className={`p-6 rounded-3xl ${cardClasses}`}>
              <h3 className="font-bold text-xl mb-5">Log Entry</h3>
              <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* Type Switcher */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-gray-500/10 rounded-xl">
                  <button type="button" onClick={() => setType('expense')} className={`py-2 text-sm font-bold rounded-lg transition-colors ${type === 'expense' ? 'bg-rose-500 text-white shadow' : 'opacity-70 hover:opacity-100'}`}>Expense</button>
                  <button type="button" onClick={() => setType('income')} className={`py-2 text-sm font-bold rounded-lg transition-colors ${type === 'income' ? 'bg-emerald-500 text-white shadow' : 'opacity-70 hover:opacity-100'}`}>Income</button>
                  <button type="button" onClick={() => setType('borrowed')} className={`py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-1 ${type === 'borrowed' ? 'bg-amber-500 text-white shadow' : 'opacity-70 hover:opacity-100'}`}><Ghost size={14}/> Borrow</button>
                  <button type="button" onClick={() => setType('lent')} className={`py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-1 ${type === 'lent' ? 'bg-indigo-500 text-white shadow' : 'opacity-70 hover:opacity-100'}`}><HandCoins size={14}/> Lent</button>
                </div>
                
                {/* Amount */}
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Total Amount (₹)" className={`w-full p-4 text-2xl font-black rounded-2xl border outline-none transition-colors ${dark ? 'bg-gray-950 border-gray-800 text-white focus:border-rose-500' : 'bg-gray-50 border-gray-200 focus:border-rose-500'}`} required />
                
                {/* Expense Sub-Items */}
                {type === 'expense' && (
                   <div className={`p-3 rounded-2xl border ${dark ? 'bg-gray-950/50 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex justify-between items-center mb-2">
                         <span className="text-xs font-bold uppercase opacity-60">Itemize (Optional)</span>
                         <button type="button" onClick={() => setSubItems([...subItems, { id: Date.now(), reason: '', amount: '' }])} className="text-xs font-bold text-rose-500 flex items-center gap-1"><Plus size={12}/> Add Sub-item</button>
                      </div>
                      {subItems.map((item, idx) => (
                         <div key={item.id} className="flex gap-2 mb-2">
                            <input type="text" placeholder="Item name" value={item.reason} onChange={e => { const n = [...subItems]; n[idx].reason = e.target.value; setSubItems(n); }} className={`flex-1 p-2 text-sm rounded-lg border outline-none ${dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`} />
                            <input type="number" placeholder="₹" value={item.amount} onChange={e => { const n = [...subItems]; n[idx].amount = e.target.value; setSubItems(n); }} className={`w-20 p-2 text-sm rounded-lg border outline-none ${dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`} />
                            <button type="button" onClick={() => setSubItems(subItems.filter(s => s.id !== item.id))} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg"><X size={14}/></button>
                         </div>
                      ))}
                      {subItems.length > 0 && (
                         <div className="text-xs font-bold opacity-60 mt-2 text-right">
                            Remaining: ₹{Math.max(0, Number(amount) - subItems.reduce((acc, i) => acc + Number(i.amount), 0))}
                         </div>
                      )}
                   </div>
                )}

                {/* Tags */}
                {(type === 'expense' || type === 'borrowed') && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold uppercase opacity-60">Category Tag</label>
                        <button type="button" onClick={() => setShowTagModal(true)} className="text-xs font-bold text-rose-500 hover:underline">Manage</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {settings.tags.map(t => (
                        <button 
                          key={t.id} type="button" onClick={() => setTag(t.name)}
                          className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all ${tag === t.name ? 'ring-2 ring-offset-2 ring-gray-400 scale-105' : 'opacity-80 hover:opacity-100 hover:scale-105'}`}
                          style={{ backgroundColor: t.color, color: '#fff', outline: 'none' }}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Friends / Splitwise */}
                {(type === 'borrowed' || type === 'lent') && (
                   <div>
                      <div className="flex justify-between items-center mb-2">
                         <label className="text-xs font-bold uppercase opacity-60">{type === 'lent' ? 'Select Friends (Multi)' : 'Select Friend'}</label>
                         <button type="button" onClick={() => setShowFriendModal(true)} className="text-xs font-bold text-indigo-500 hover:underline">Manage</button>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                         {settings.friends.map(f => (
                            <button key={f.id} type="button" onClick={() => handleFriendToggle(f.name)}
                               className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-colors ${selectedFriends.includes(f.name) ? 'bg-indigo-500 border-indigo-500 text-white' : (dark ? 'bg-gray-900 border-gray-700' : 'bg-gray-100 border-gray-300')}`}
                            >
                               {f.name}
                            </button>
                         ))}
                      </div>

                      {type === 'lent' && selectedFriends.length > 0 && (
                         <div className={`p-4 rounded-2xl border ${dark ? 'bg-gray-950/50 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex justify-between items-center mb-4">
                               <span className="text-xs font-bold uppercase">Split Method</span>
                               <div className="flex bg-gray-500/20 rounded-lg p-1">
                                  <button type="button" onClick={() => setSplitMode('equal')} className={`px-2 py-1 text-xs font-bold rounded ${splitMode === 'equal' ? 'bg-indigo-500 text-white' : 'opacity-70'}`}>Equal</button>
                                  <button type="button" onClick={() => setSplitMode('custom')} className={`px-2 py-1 text-xs font-bold rounded ${splitMode === 'custom' ? 'bg-indigo-500 text-white' : 'opacity-70'}`}>Custom</button>
                               </div>
                            </div>
                            
                            {selectedFriends.map(f => (
                               <div key={f} className="flex justify-between items-center mb-2 text-sm font-bold">
                                  <span>{f}</span>
                                  {splitMode === 'equal' ? (
                                     <span>₹{(Number(amount) / selectedFriends.length).toFixed(2)}</span>
                                  ) : (
                                     <input type="number" placeholder="₹" value={customSplits[f] || ''} onChange={e => setCustomSplits({...customSplits, [f]: e.target.value})} className={`w-24 p-2 rounded-lg border text-right outline-none ${dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`} />
                                  )}
                               </div>
                            ))}
                         </div>
                      )}
                   </div>
                )}

                <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Main Reason (Optional)" className={`w-full p-3 rounded-xl border ${dark ? 'bg-gray-950 border-gray-800 text-white' : 'bg-gray-50 border-gray-200'} focus:outline-none`} />
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`w-full p-3 rounded-xl border font-bold ${dark ? 'bg-gray-950 border-gray-800 text-white' : 'bg-gray-50 border-gray-200'} focus:outline-none`} />
                
                <button type="submit" className={`w-full py-4 text-white rounded-2xl font-black text-lg transition-transform hover:scale-[1.02] active:scale-[0.98] ${type==='income'?'bg-emerald-600':type==='borrowed'?'bg-amber-600':type==='lent'?'bg-indigo-600':'bg-rose-600'} shadow-lg`}>
                  Save Transaction
                </button>
              </form>
            </div>

            <div className={`p-6 rounded-3xl ${cardClasses}`}>
              <div className="flex justify-between items-center mb-4">
                 <h3 className="font-bold">Quick Adds</h3>
                 <button onClick={() => setShowQAModal(true)} className="p-1.5 rounded-lg bg-gray-500/10"><Settings size={16}/></button>
              </div>
              <div className="flex flex-wrap gap-2">
                {settings.quickAdds.map(qa => {
                   const tagConfig = settings.tags.find(t => t.name === qa.tag) || { color: '#888' };
                   return (
                     <button key={qa.id} onClick={() => addTx({amount: qa.amount, tag: qa.tag, reason: qa.reason, type: 'expense', date: new Date().toISOString().split('T')[0]})} className={`px-4 py-2.5 rounded-2xl text-sm flex flex-col items-start gap-1 transition-transform hover:scale-105 ${dark ? 'bg-gray-950 border border-gray-800' : 'bg-white border border-gray-200 shadow-sm'}`}>
                       <span className="font-black">₹{qa.amount}</span>
                       <span className="font-medium text-xs opacity-80" style={{color: tagConfig.color}}>{qa.tag}</span>
                     </button>
                   );
                })}
              </div>
            </div>
          </div>
        )}

        <div className={`p-6 rounded-3xl ${readOnly ? 'xl:col-span-3' : 'xl:col-span-2'} flex flex-col h-[700px] ${cardClasses}`}>
          <div className="flex justify-between items-center mb-6">
             <h3 className="font-bold text-xl">Ledger Activity ({dateBounds.label})</h3>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {transactions.length === 0 ? (
              <div className="h-full flex items-center justify-center opacity-50 font-medium">No transactions in this period.</div>
            ) : (
              transactions.map(t => <TransactionRow key={t.id} t={t} settings={settings} dark={dark} onEdit={() => editTx(t)} onDelete={() => deleteTx(t.id)} readOnly={readOnly} />)
            )}
          </div>
        </div>
      </div>

      {showTagModal && <TagManagerModal settings={settings} updateSettings={updateSettings} onClose={() => setShowTagModal(false)} dark={dark} />}
      {showQAModal && <QuickAddManagerModal settings={settings} updateSettings={updateSettings} onClose={() => setShowQAModal(false)} dark={dark} />}
      {showFriendModal && <FriendManagerModal settings={settings} updateSettings={updateSettings} onClose={() => setShowFriendModal(false)} dark={dark} />}
    </div>
  );
};

const TransactionRow = ({ t, settings, dark, onEdit, onDelete, readOnly }) => {
  const isExpenseType = t.type === 'expense' || t.type === 'borrowed';
  const tagConfig = isExpenseType ? (settings.tags.find(x => x.name === t.tag) || { color: '#888' }) : null;
  
  let label = t.reason || t.tag || 'Transaction';
  let sublabel = t.tag;
  let color = '#888';
  let amountPrefix = '-';
  let amountColor = dark ? 'text-white' : 'text-gray-900';

  if (t.type === 'expense') {
     color = tagConfig.color;
  } else if (t.type === 'income') {
     color = '#22c55e'; amountPrefix = '+'; amountColor = 'text-emerald-500';
     label = t.reason || 'Income'; sublabel = 'Added to Balance';
  } else if (t.type === 'borrowed') {
     color = '#f59e0b'; label = t.reason || `${t.tag} (Credit)`; sublabel = `Ghost Exp. (Owe ${t.person})`;
  } else if (t.type === 'lent') {
     color = '#6366f1'; label = t.reason || `Lent Money`; sublabel = `To ${t.person}`;
  } else if (t.type === 'settle_gave') {
     color = '#f43f5e'; label = `Paid ${t.person}`; sublabel = t.reason || 'Debt Settlement';
  } else if (t.type === 'settle_received') {
     color = '#22c55e'; amountPrefix = '+'; amountColor = 'text-emerald-500';
     label = `Received from ${t.person}`; sublabel = t.reason || 'Debt Settlement';
  }

  return (
    <div className={`flex items-center justify-between p-4 md:p-5 rounded-2xl border group transition-colors ${dark ? 'border-gray-800 bg-gray-950/40 hover:bg-gray-800' : 'border-gray-100 bg-gray-50/50 hover:bg-white shadow-sm hover:shadow'}`}>
      <div className="flex items-center gap-4">
        <div className="w-2.5 h-12 rounded-full" style={{backgroundColor: color}}></div>
        <div>
          <div className="font-bold text-base md:text-lg flex items-center gap-2">
             {label}
             {t.type === 'borrowed' && <Ghost size={14} className="text-amber-500"/>}
          </div>
          <div className="text-xs font-medium opacity-60 flex items-center gap-2 mt-1">
            <span>{new Date(t.date).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'})}</span>
            {sublabel && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border" style={{borderColor: `${color}55`, color: color}}>{sublabel}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className={`font-black text-lg md:text-xl tracking-tight ${amountColor}`}>
          {amountPrefix}₹{Number(t.amount).toLocaleString('en-IN')}
        </div>
        {!readOnly && (
           <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex flex-col md:flex-row gap-1 md:gap-2">
              <button onClick={onEdit} className="p-2 rounded-lg bg-gray-500/10 hover:bg-gray-500/20 text-gray-500 transition-colors"><Pencil size={14}/></button>
              <button onClick={onDelete} className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-colors"><Trash2 size={14}/></button>
           </div>
        )}
      </div>
    </div>
  )
}

const AnalyticsView = ({ transactions, settings, onTagClick, dateBounds, cardClasses, dark }) => {
  const [hoveredCategory, setHoveredCategory] = useState(null);
  
  const expenses = transactions.filter(t => t.type === 'expense' || t.type === 'borrowed');
  
  const tagDataMap = expenses.reduce((acc, t) => {
    if (!acc[t.tag]) acc[t.tag] = { total: 0, maxAmount: 0 };
    acc[t.tag].total += Number(t.amount);
    if (Number(t.amount) > acc[t.tag].maxAmount) acc[t.tag].maxAmount = Number(t.amount);
    return acc;
  }, {});

  const pieData = Object.keys(tagDataMap).map(key => {
    const config = settings.tags.find(t => t.name === key) || { color: '#888' };
    return { name: key, value: tagDataMap[key].total, maxExpenseInTag: tagDataMap[key].maxAmount, color: config.color };
  }).sort((a,b) => b.value - a.value);

  const totalSpend = pieData.reduce((acc, item) => acc + item.value, 0);

  // Calendar Heatmap Logic
  const dailySpend = {};
  expenses.forEach(t => {
    const dateStr = t.date.split('T')[0];
    dailySpend[dateStr] = (dailySpend[dateStr] || 0) + Number(t.amount);
  });
  const maxDailySpend = Math.max(0, ...Object.values(dailySpend));
  
  const calBaseDate = dateBounds.start ? new Date(dateBounds.start) : new Date();
  const currentYear = calBaseDate.getFullYear();
  const currentMonth = calBaseDate.getMonth();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
  const calendarDays = Array(firstDayOfWeek).fill(null).concat(Array.from({length: daysInMonth}, (_, i) => i + 1));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`p-6 rounded-3xl ${cardClasses} h-[450px] flex flex-col`}>
          <h3 className="font-bold text-xl mb-4">Wasted by Category</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={90} outerRadius={130} paddingAngle={5} dataKey="value" stroke="none">
                  {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <RechartsTooltip formatter={(value) => `₹${value.toLocaleString()}`} contentStyle={{ backgroundColor: dark ? '#111827' : '#fff', borderRadius: '16px', border: dark ? '1px solid #374151' : '1px solid #e5e7eb', color: dark ? '#fff' : '#000', fontWeight: 'bold' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="flex-1 flex items-center justify-center opacity-50 font-medium">No expenses to display.</div>}
        </div>

        <div className={`p-6 rounded-3xl ${cardClasses} h-[450px] flex flex-col`}>
           <h3 className="font-bold text-xl mb-4">Category Breakdown</h3>
           <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1 relative">
              {pieData.map(item => (
                <div 
                  key={item.name} 
                  className="relative flex flex-col gap-1.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/50 p-4 rounded-2xl transition-colors group"
                  onMouseEnter={() => setHoveredCategory(item.name)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  onClick={() => onTagClick(item.name)}
                >
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-3 font-bold text-base">
                      <span className="w-3 h-3 rounded-full shadow-sm" style={{backgroundColor: item.color}}></span>
                      {item.name}
                    </span>
                    <span className="font-black text-lg">₹{item.value.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 mt-1 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${Math.min((item.value / (totalSpend || 1)) * 100, 100)}%`, backgroundColor: item.color }}></div>
                  </div>
                  
                  {hoveredCategory === item.name && (
                     <div className="absolute top-full left-0 w-full mt-2 p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-3xl z-50 pointer-events-none">
                        <div className="text-xs font-black uppercase tracking-wider mb-4 opacity-70 flex justify-between">
                           <span>Top {item.name} Expenses</span>
                           <span className="text-rose-500">Click to view all</span>
                        </div>
                        <div className="space-y-4 max-h-56 overflow-hidden">
                           {expenses.filter(e => e.tag === item.name)
                              .sort((a,b) => b.amount - a.amount)
                              .slice(0, 5)
                              .map(t => (
                                 <div key={t.id}>
                                    <div className="flex justify-between items-center text-sm mb-1.5">
                                       <span className="truncate max-w-[150px] font-bold">{t.reason || t.tag}</span>
                                       <span className="font-black opacity-80" style={{color: item.color}}>₹{Number(t.amount).toLocaleString()}</span>
                                    </div>
                                    <div className="w-full bg-gray-100 dark:bg-gray-800/50 rounded-full h-2 overflow-hidden">
                                       <div className="h-full rounded-full" style={{width: `${(t.amount/item.maxExpenseInTag)*100}%`, backgroundColor: item.color}} />
                                    </div>
                                 </div>
                              ))
                           }
                        </div>
                     </div>
                  )}
                </div>
              ))}
           </div>
        </div>
      </div>

      <div className={`p-6 rounded-3xl ${cardClasses}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
           <h3 className="font-bold text-xl flex items-center gap-3"><CalendarDays size={24} className="text-rose-500"/> Spending Heatmap</h3>
           <span className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm font-bold opacity-80">{calBaseDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
        </div>
        <div className="grid grid-cols-7 gap-2 md:gap-4 max-w-3xl mx-auto">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="text-center text-xs font-black tracking-widest opacity-50 mb-2 uppercase">{d}</div>)}
          {calendarDays.map((day, idx) => {
             if (!day) return <div key={`empty-${idx}`} className="aspect-square" />;
             
             const monthStr = String(currentMonth + 1).padStart(2, '0');
             const dayStr = String(day).padStart(2, '0');
             const dStr = `${currentYear}-${monthStr}-${dayStr}`;
             const spend = dailySpend[dStr] || 0;
             const intensity = maxDailySpend > 0 ? (spend / maxDailySpend) : 0;
             const hasSpend = spend > 0;
             
             return (
               <div key={`day-${day}-${idx}`} className="aspect-square rounded-2xl flex flex-col items-center justify-center relative group transition-transform hover:scale-110 cursor-pointer shadow-sm" 
                    style={{ 
                      backgroundColor: hasSpend ? `rgba(244, 63, 94, ${intensity * 0.85 + 0.15})` : (dark ? '#1f2937' : '#f3f4f6'),
                      color: hasSpend ? '#fff' : 'inherit'
                    }}>
                 <span className="text-sm font-bold">{day}</span>
                 {hasSpend && (
                    <div className="absolute bottom-full mb-3 bg-gray-900 text-white text-sm font-black px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 shadow-2xl">
                       ₹{spend.toLocaleString('en-IN')} spent
                    </div>
                 )}
               </div>
             )
          })}
        </div>
      </div>
    </div>
  );
};

const TagDetailsView = ({ tag, transactions, settings, onBack, editTx, deleteTx, dateBounds, cardClasses, dark, readOnly }) => {
  const tagExpenses = transactions.filter(t => (t.type === 'expense' || t.type === 'borrowed') && t.tag === tag).sort((a,b) => b.amount - a.amount);
  const maxAmt = Math.max(0, ...tagExpenses.map(t => Number(t.amount)));
  const tagConfig = settings.tags.find(t => t.name === tag) || { color: '#888' };

  return (
     <div className={`p-6 rounded-3xl ${cardClasses} flex flex-col h-[calc(100vh-140px)] relative`}>
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-200 dark:border-gray-800">
           <button onClick={onBack} className="p-3 rounded-2xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><ChevronLeft size={20}/></button>
           <h2 className="text-3xl font-black flex items-center gap-3 tracking-tight">
              <span className="w-5 h-5 rounded-full shadow-md" style={{backgroundColor: tagConfig.color}}></span>
              {tag} 
              <span className="opacity-50 text-xl font-bold ml-2 hidden md:inline">({dateBounds.label})</span>
           </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
           {tagExpenses.map(t => (
              <div key={t.id} className="flex flex-col gap-3 p-5 rounded-2xl border border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-all group shadow-sm hover:shadow-md">
                 <div className="flex justify-between items-start">
                    <div>
                       <div className="font-bold text-xl flex items-center gap-2">
                          {t.reason || t.tag}
                          {t.type === 'borrowed' && <Ghost size={16} className="text-amber-500" title={`Ghost Expense from ${t.person}`} />}
                       </div>
                       <div className="text-xs font-medium opacity-60 flex items-center gap-2 mt-1">
                          <CalendarIcon size={12}/> {new Date(t.date).toLocaleDateString('en-GB', {weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'})}
                       </div>
                    </div>
                    <div className="flex items-center gap-4">
                       <div className="font-black text-2xl tracking-tighter" style={{color: tagConfig.color}}>₹{Number(t.amount).toLocaleString('en-IN')}</div>
                       {!readOnly && (
                          <div className="opacity-100 md:opacity-0 group-hover:opacity-100 flex gap-1">
                              <button onClick={() => editTx(t)} className="p-2 rounded-lg hover:bg-gray-500/20 text-gray-500"><Pencil size={16}/></button>
                              <button onClick={() => deleteTx(t.id)} className="p-2 rounded-lg hover:bg-rose-500/20 text-rose-500"><Trash2 size={16}/></button>
                          </div>
                       )}
                    </div>
                 </div>
                 <div className="w-full bg-gray-200 dark:bg-gray-800/80 rounded-full h-3 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{width: `${(t.amount/maxAmt)*100}%`, backgroundColor: tagConfig.color}} />
                 </div>
              </div>
           ))}
           {tagExpenses.length === 0 && <div className="opacity-50 text-center py-20 font-bold text-lg">No expenses found for this category in this period.</div>}
        </div>
     </div>
  );
};

const DebtsView = ({ friendLedgers, owedToMe, iOwe, onSelectFriend, cardClasses, dark }) => {
  const activeFriends = Object.entries(friendLedgers).filter(([_, ledger]) => ledger.netBalance !== 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`p-8 rounded-3xl border-b-4 border-emerald-500 ${cardClasses}`}>
          <div className="text-sm font-bold uppercase tracking-widest opacity-60 mb-2">Lifetime Owed to Me</div>
          <div className="text-4xl font-black text-emerald-500 tracking-tight">₹{owedToMe.toLocaleString('en-IN')}</div>
        </div>
        <div className={`p-8 rounded-3xl border-b-4 border-rose-500 ${cardClasses}`}>
          <div className="text-sm font-bold uppercase tracking-widest opacity-60 mb-2">Lifetime I Owe Others</div>
          <div className="text-4xl font-black text-rose-500 tracking-tight">₹{iOwe.toLocaleString('en-IN')}</div>
        </div>
      </div>

      <div className={`p-6 md:p-8 rounded-3xl ${cardClasses}`}>
         <div className="flex justify-between items-center mb-8">
            <h3 className="font-bold text-xl">Active Ledgers</h3>
            <div className="text-xs font-bold opacity-60 flex items-center gap-2 bg-gray-500/10 px-3 py-1.5 rounded-full"><ArrowRightLeft size={14}/> Auto-Synced with Balance</div>
         </div>
         
         <div className="space-y-4">
            {activeFriends.length === 0 && <div className="opacity-50 py-12 text-center font-bold text-lg border-2 border-dashed border-gray-500/20 rounded-3xl">No active debts. You're all settled up!</div>}
            {activeFriends.map(([friendName, ledger]) => {
               const owesMe = ledger.netBalance > 0;
               const absBal = Math.abs(ledger.netBalance);

               return (
                  <div key={friendName} onClick={() => onSelectFriend(friendName)} className={`p-6 rounded-3xl border transition-all shadow-sm cursor-pointer hover:scale-[1.01] ${dark ? 'border-gray-800 bg-gray-950/40 hover:bg-gray-800/80' : 'border-gray-200 bg-white hover:border-indigo-300'}`}>
                     <div className="flex justify-between items-center">
                        <div className="font-black text-2xl flex items-center gap-3">
                           <div className={`w-3 h-3 rounded-full ${owesMe ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                           {friendName}
                        </div>
                        <div className={`text-right font-black text-xl md:text-2xl tracking-tight ${owesMe ? 'text-emerald-500' : 'text-rose-500'}`}>
                           {owesMe ? 'Owes you ' : 'You owe '} ₹{absBal.toLocaleString('en-IN')}
                        </div>
                     </div>
                  </div>
               )
            })}
         </div>
      </div>
    </div>
  );
};

const FriendProfileView = ({ friendName, ledger, onBack, addTx, editTx, deleteTx, cardClasses, dark, readOnly, settings }) => {
   const [settleAmount, setSettleAmount] = useState('');
   const [settleDate, setSettleDate] = useState(new Date().toISOString().split('T')[0]);

   const netBalance = ledger?.netBalance || 0;
   const owesMe = netBalance > 0;
   const absBal = Math.abs(netBalance);
   const history = ledger?.history.sort((a,b) => new Date(b.date) - new Date(a.date)) || [];

   const handleSettle = () => {
      if(!settleAmount) return;
      addTx({
         type: owesMe ? 'settle_received' : 'settle_gave',
         amount: Number(settleAmount),
         person: friendName,
         reason: 'Debt Settlement',
         date: settleDate
      });
      setSettleAmount('');
   };

   return (
      <div className="space-y-6">
         <div className={`p-8 rounded-3xl ${cardClasses} flex items-center gap-4 border-b-4 ${netBalance === 0 ? 'border-gray-500' : owesMe ? 'border-emerald-500' : 'border-rose-500'}`}>
            <button onClick={onBack} className="p-3 rounded-2xl bg-gray-500/10 hover:bg-gray-500/20"><ChevronLeft size={20}/></button>
            <div className="flex-1">
               <h2 className="text-3xl font-black">{friendName}'s Profile</h2>
               <div className={`font-bold mt-1 ${netBalance === 0 ? 'opacity-50' : owesMe ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {netBalance === 0 ? 'All Settled Up' : `${owesMe ? 'Owes you' : 'You owe them'} ₹${absBal.toLocaleString('en-IN')}`}
               </div>
            </div>
         </div>

         {!readOnly && netBalance !== 0 && (
            <div className={`p-6 rounded-3xl border border-indigo-500/30 ${dark ? 'bg-indigo-950/20' : 'bg-indigo-50'}`}>
               <h4 className="font-bold mb-4 uppercase tracking-widest text-xs opacity-70">Record a Settlement</h4>
               <div className="flex flex-col md:flex-row gap-4 items-center">
                  <input type="number" placeholder={`Max ₹${absBal}`} max={absBal} value={settleAmount} onChange={e=>setSettleAmount(e.target.value)} className={`flex-1 p-4 rounded-xl border font-bold outline-none ${dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`} />
                  <input type="date" value={settleDate} onChange={e=>setSettleDate(e.target.value)} className={`flex-1 p-4 rounded-xl border font-bold outline-none ${dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`} />
                  <button onClick={() => setSettleAmount(absBal)} className="p-4 rounded-xl font-bold bg-gray-500/10 hover:bg-gray-500/20">Full</button>
                  <button onClick={handleSettle} className="px-8 py-4 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700">Settle</button>
               </div>
            </div>
         )}

         <div className={`p-6 rounded-3xl ${cardClasses}`}>
            <h3 className="font-bold text-xl mb-6">Ledger History</h3>
            <div className="space-y-3">
               {history.length === 0 ? (
                  <div className="opacity-50 py-10 text-center font-bold">No past transactions.</div>
               ) : (
                  history.map(t => <TransactionRow key={t.id} t={t} settings={settings} dark={dark} onEdit={() => editTx(t)} onDelete={() => deleteTx(t.id)} readOnly={readOnly} />)
               )}
            </div>
         </div>
      </div>
   );
}


const EditTransactionModal = ({ tx, settings, onSave, onClose, dark }) => {
   const [formData, setFormData] = useState({
      amount: tx.amount,
      type: tx.type,
      reason: tx.reason || '',
      tag: tx.tag || '',
      person: tx.person || '',
      date: tx.date.split('T')[0]
   });

   const handleSave = () => {
      onSave(tx.id, { ...formData, amount: Number(formData.amount) });
   };

   return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
         <div className={`w-full max-w-md p-8 rounded-[2rem] shadow-2xl ${dark ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-8">
               <h3 className="font-black text-2xl tracking-tight">Edit Entry</h3>
               <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-500/20 transition-colors"><X size={20}/></button>
            </div>
            
            <div className="space-y-5">
               <div>
                  <label className="text-xs font-bold uppercase tracking-wider opacity-70 block mb-2">Amount</label>
                  <input type="number" value={formData.amount} onChange={e=>setFormData({...formData, amount: e.target.value})} className={`w-full p-4 text-xl font-bold rounded-2xl border outline-none ${dark ? 'bg-gray-950 border-gray-800' : 'bg-gray-50 border-gray-200'}`} />
               </div>
               
               {(formData.type === 'expense' || formData.type === 'borrowed') && (
                  <div>
                     <label className="text-xs font-bold uppercase tracking-wider opacity-70 block mb-2">Tag</label>
                     <select value={formData.tag} onChange={e=>setFormData({...formData, tag: e.target.value})} className={`w-full p-4 font-bold rounded-2xl border outline-none ${dark ? 'bg-gray-950 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                        {settings.tags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                     </select>
                  </div>
               )}

               {['borrowed', 'lent', 'settle_gave', 'settle_received'].includes(formData.type) && (
                  <div>
                     <label className="text-xs font-bold uppercase tracking-wider opacity-70 block mb-2">Person</label>
                     <select value={formData.person} onChange={e=>setFormData({...formData, person: e.target.value})} className={`w-full p-4 font-bold rounded-2xl border outline-none ${dark ? 'bg-gray-950 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                        {settings.friends.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                     </select>
                  </div>
               )}

               <div>
                  <label className="text-xs font-bold uppercase tracking-wider opacity-70 block mb-2">Reason</label>
                  <input type="text" value={formData.reason} onChange={e=>setFormData({...formData, reason: e.target.value})} className={`w-full p-4 font-bold rounded-2xl border outline-none ${dark ? 'bg-gray-950 border-gray-800' : 'bg-gray-50 border-gray-200'}`} />
               </div>

               <div>
                  <label className="text-xs font-bold uppercase tracking-wider opacity-70 block mb-2">Date</label>
                  <input type="date" value={formData.date} onChange={e=>setFormData({...formData, date: e.target.value})} className={`w-full p-4 font-bold rounded-2xl border outline-none ${dark ? 'bg-gray-950 border-gray-800' : 'bg-gray-50 border-gray-200'}`} />
               </div>
               
               <button onClick={handleSave} className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white font-black text-lg rounded-2xl mt-4 transition-transform hover:scale-[1.02] active:scale-[0.98]">Save Changes</button>
            </div>
         </div>
      </div>
   );
}

const FriendManagerModal = ({ settings, updateSettings, onClose, dark }) => {
   const [newFriend, setNewFriend] = useState('');

   const addFriend = () => {
      if(!newFriend.trim()) return;
      const updated = [...settings.friends, { id: Date.now().toString(), name: newFriend.trim() }];
      updateSettings({ friends: updated });
      setNewFriend('');
   };

   const deleteFriend = (id) => updateSettings({ friends: settings.friends.filter(f => f.id !== id) });

   return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
         <div className={`w-full max-w-md p-8 rounded-[2rem] shadow-2xl ${dark ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-8">
               <h3 className="font-black text-2xl">Manage Friends</h3>
               <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-500/20"><X size={20}/></button>
            </div>
            
            <div className="space-y-3 max-h-64 overflow-y-auto mb-8 pr-2 custom-scrollbar">
               {settings.friends.map(f => (
                  <div key={f.id} className={`flex justify-between items-center p-4 rounded-2xl border ${dark ? 'border-gray-800 bg-gray-950' : 'border-gray-100 bg-gray-50'}`}>
                     <span className="font-bold flex items-center gap-3"><Users size={18} className="text-indigo-500"/> {f.name}</span>
                     <button onClick={() => deleteFriend(f.id)} className="text-rose-500 p-2 rounded-lg hover:bg-rose-500/10 transition-colors"><Trash2 size={16}/></button>
                  </div>
               ))}
               {settings.friends.length === 0 && <div className="text-sm font-medium opacity-50 text-center py-6 border-2 border-dashed border-gray-500/20 rounded-2xl">No friends added yet.</div>}
            </div>

            <div className={`p-4 rounded-2xl border flex gap-2 ${dark ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-gray-50'}`}>
               <input type="text" value={newFriend} onChange={e=>setNewFriend(e.target.value)} placeholder="Friend's Name" className={`flex-1 p-3 font-bold rounded-xl border outline-none ${dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`} />
               <button onClick={addFriend} className="px-6 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black rounded-xl hover:scale-105 transition-transform">Add</button>
            </div>
         </div>
      </div>
   );
};

const TagManagerModal = ({ settings, updateSettings, onClose, dark }) => {
   const [newTagName, setNewTagName] = useState('');
   const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);

   const addTag = () => {
      if(!newTagName.trim()) return;
      const updatedTags = [...settings.tags, { id: Date.now().toString(), name: newTagName.trim(), color: newTagColor }];
      updateSettings({ tags: updatedTags });
      setNewTagName('');
   };

   const deleteTag = (id) => updateSettings({ tags: settings.tags.filter(t => t.id !== id) });

   return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
         <div className={`w-full max-w-md p-8 rounded-[2rem] shadow-2xl ${dark ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-8">
               <h3 className="font-black text-2xl">Manage Tags</h3>
               <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-500/20"><X size={20}/></button>
            </div>
            
            <div className="space-y-3 max-h-64 overflow-y-auto mb-8 pr-2 custom-scrollbar">
               {settings.tags.map(t => (
                  <div key={t.id} className={`flex justify-between items-center p-4 rounded-2xl border ${dark ? 'border-gray-800 bg-gray-950' : 'border-gray-100 bg-gray-50'}`}>
                     <span className="flex items-center gap-3 font-bold"><span className="w-4 h-4 rounded-full shadow-sm" style={{backgroundColor: t.color}}></span> {t.name}</span>
                     <button onClick={() => deleteTag(t.id)} className="text-rose-500 p-2 rounded-lg hover:bg-rose-500/10 transition-colors"><Trash2 size={16}/></button>
                  </div>
               ))}
            </div>

            <div className={`p-5 rounded-3xl border ${dark ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-gray-50'}`}>
               <h4 className="font-black text-sm uppercase tracking-wider mb-4 opacity-70">Add New Tag</h4>
               <input type="text" value={newTagName} onChange={e=>setNewTagName(e.target.value)} placeholder="Tag Name" className={`w-full p-4 font-bold rounded-2xl border mb-4 outline-none ${dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`} />
               <div className="flex flex-wrap gap-3 mb-6">
                  {PRESET_COLORS.map(c => (
                     <button key={c} onClick={() => setNewTagColor(c)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform ${newTagColor === c ? 'scale-125 ring-2 ring-offset-2 ring-gray-400' : 'hover:scale-110'}`} style={{backgroundColor: c}}></button>
                  ))}
               </div>
               <button onClick={addTag} className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black rounded-2xl hover:scale-[1.02] transition-transform">Create Tag</button>
            </div>
         </div>
      </div>
   );
};

const QuickAddManagerModal = ({ settings, updateSettings, onClose, dark }) => {
   const [amt, setAmt] = useState('');
   const [tag, setTag] = useState(settings.tags[0]?.name || '');
   const [reason, setReason] = useState('');

   const addQA = () => {
      if(!amt || !tag) return;
      const updatedQA = [...settings.quickAdds, { id: Date.now().toString(), amount: Number(amt), tag, reason }];
      updateSettings({ quickAdds: updatedQA });
      setAmt(''); setReason('');
   };

   const deleteQA = (id) => updateSettings({ quickAdds: settings.quickAdds.filter(q => q.id !== id) });

   return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
         <div className={`w-full max-w-md p-8 rounded-[2rem] shadow-2xl ${dark ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-8">
               <h3 className="font-black text-2xl">Manage Quick Adds</h3>
               <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-500/20"><X size={20}/></button>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-8">
               {settings.quickAdds.map(qa => (
                  <div key={qa.id} className={`pl-4 pr-2 py-2 rounded-xl flex items-center gap-3 border shadow-sm ${dark ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'}`}>
                     <span className="text-sm font-bold">₹{qa.amount} {qa.tag}</span>
                     <button onClick={() => deleteQA(qa.id)} className="text-rose-500 p-1.5 rounded-lg hover:bg-rose-500/10"><X size={14}/></button>
                  </div>
               ))}
               {settings.quickAdds.length === 0 && <div className="text-sm font-medium opacity-50 w-full text-center py-4 border-2 border-dashed border-gray-500/20 rounded-xl">No quick adds yet.</div>}
            </div>

            <div className={`p-5 rounded-3xl border ${dark ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-gray-50'}`}>
               <h4 className="font-black text-sm uppercase tracking-wider mb-4 opacity-70">New Quick Add</h4>
               <input type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="Amount (₹)" className={`w-full p-4 font-bold rounded-2xl border mb-3 outline-none ${dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`} />
               <select value={tag} onChange={e=>setTag(e.target.value)} className={`w-full p-4 font-bold rounded-2xl border mb-3 outline-none ${dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}>
                  {settings.tags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
               </select>
               <input type="text" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Preset Reason (Optional)" className={`w-full p-4 font-bold rounded-2xl border mb-6 outline-none ${dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`} />
               <button onClick={addQA} className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black rounded-2xl hover:scale-[1.02] transition-transform">Save Quick Add</button>
            </div>
         </div>
      </div>
   );
}