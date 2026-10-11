import React, { useState, useEffect, useMemo } from 'react';
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, 
} from 'recharts';
import { 
  LayoutDashboard, PieChart as PieChartIcon, HandCoins,
  Moon, Sun, Search, Share2, ArrowUpRight, ArrowDownRight, 
  CheckCircle2, Wine, Calendar as CalendarIcon, X, Settings, ChevronLeft, Plus,
  Pencil, Trash2, Users, Ghost, ArrowRightLeft, CalendarDays, Link as LinkIcon
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {

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
  quickAdds: [
    { id: 'qa1', amount: 20, tag: 'Drinks', reason: 'Tea/Coffee' }
  ],
  friends: []
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  
  // Shared URL parsing (Bulletproof against Vercel 404s)
  const urlParams = new URLSearchParams(window.location.search);
  const shareUid = urlParams.get('share');
  const shareStart = urlParams.get('s');
  const shareEnd = urlParams.get('e');
  const isSharedMode = !!shareUid;
  const [sharedData, setSharedData] = useState(null);
  const [sharedOwnerName, setSharedOwnerName] = useState("Someone");
  
  // App State
  const [transactions, setTransactions] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  
  // UI & Time Filter State
  const [currentView, setCurrentView] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagDetail, setSelectedTagDetail] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  
  const [timeFilter, setTimeFilter] = useState('monthly'); // lifetime, monthly, weekly, custom
  const [customDate, setCustomDate] = useState({ 
     start: new Date().toISOString().split('T')[0], 
     end: new Date().toISOString().split('T')[0] 
  });

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else if (typeof __firebase_config !== 'undefined') {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth init failed", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // If in Share Mode, we don't need the user to be logged in. We fetch directly.
    if (isSharedMode) {
      const txRef = collection(db, 'artifacts', appId, 'users', shareUid, 'transactions');
      const unsubTx = onSnapshot(txRef, (snapshot) => {
        const data = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(t => t.date >= shareStart && t.date <= shareEnd);
        data.sort((a, b) => new Date(b.date) - new Date(a.date));
        setSharedData(data);
      }, (error) => console.error("Error fetching shared tx:", error));
      
      // Attempt to get owner's basic settings for tags/name, ignoring errors if missing
      const settingsRef = doc(db, 'artifacts', appId, 'users', shareUid, 'settings', 'preferences');
      onSnapshot(settingsRef, (docSnap) => {
         if(docSnap.exists()) {
             setSettings({ ...DEFAULT_SETTINGS, ...docSnap.data() });
         }
      });

      return () => unsubTx();
    }

    if (!user) return;

    const userId = user.uid;
    const txRef = collection(db, 'artifacts', appId, 'users', userId, 'transactions');
    const unsubTx = onSnapshot(txRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(data);
    }, (error) => console.error("Error fetching tx:", error));

    const settingsRef = doc(db, 'artifacts', appId, 'users', userId, 'settings', 'preferences');
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        setSettings({ ...DEFAULT_SETTINGS, ...docSnap.data() });
      } else {
        setDoc(settingsRef, DEFAULT_SETTINGS);
      }
    }, (error) => console.error("Error fetching settings:", error));

    return () => { unsubTx(); unsubSettings(); };
  }, [user, isSharedMode, shareUid, shareStart, shareEnd]);

  const dateBounds = useMemo(() => {
     const today = new Date();
     const formatDate = (d) => {
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().split('T')[0];
     };
     
     if (timeFilter === 'weekly') {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
        d.setDate(diff);
        const start = new Date(d);
        const end = new Date(d);
        end.setDate(end.getDate() + 6);
        return { start: formatDate(start), end: formatDate(end), label: 'This Week' };
     }
     
     if (timeFilter === 'monthly') {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return { start: formatDate(start), end: formatDate(end), label: 'This Month' };
     }
     
     if (timeFilter === 'custom') {
        return { start: customDate.start, end: customDate.end, label: 'Custom Period' };
     }
     
     return { start: null, end: null, label: 'Lifetime' };
  }, [timeFilter, customDate]);

  // The transactions filtered by the selected TIME PERIOD
  const dateFilteredTransactions = useMemo(() => {
     let filtered = transactions;
     if (dateBounds.start) filtered = filtered.filter(t => t.date >= dateBounds.start);
     if (dateBounds.end) filtered = filtered.filter(t => t.date <= dateBounds.end);
     return filtered;
  }, [transactions, dateBounds]);

  // The transactions filtered by Time Period AND Search Query (for display lists)
  const displayTransactions = useMemo(() => {
    if (!searchQuery) return dateFilteredTransactions;
    return dateFilteredTransactions.filter(t => 
      (t.reason || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (t.tag || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.person || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [dateFilteredTransactions, searchQuery]);

  // NOTE: Bank Balance is ALWAYS LIFETIME. It makes no sense to have a "weekly" bank balance.
  const lifetimeBalance = transactions.reduce((acc, t) => {
    if (t.type === 'income' || t.type === 'settle_received') return acc + Number(t.amount);
    if (t.type === 'expense' || t.type === 'lent' || t.type === 'settle_gave') return acc - Number(t.amount);
    return acc; 
  }, 0);

  // Income and Wasted are based on the FILTERED time period.
  const periodIncome = dateFilteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
  const periodWasted = dateFilteredTransactions.filter(t => t.type === 'expense' || t.type === 'borrowed').reduce((acc, t) => acc + Number(t.amount), 0);

  // Splitwise-style Ledger by Person (ALWAYS LIFETIME for accurate current debts)
  const friendLedgers = useMemo(() => {
    const ledgers = {};
    transactions.forEach(t => {
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
  }, [transactions]);

  const totalOwedToMe = Object.values(friendLedgers).filter(l => l.netBalance > 0).reduce((acc, l) => acc + l.netBalance, 0);
  const totalIOwe = Object.values(friendLedgers).filter(l => l.netBalance < 0).reduce((acc, l) => acc + Math.abs(l.netBalance), 0);

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      await signInAnonymously(auth);
    }
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


  if (loading) return <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>Loading...</div>;

  if (isSharedMode && sharedData) {
    const totalWasted = sharedData.filter(t => t.type === 'expense' || t.type === 'borrowed').reduce((acc, t) => acc + Number(t.amount), 0);
    return (
      <div className={`min-h-screen p-4 md:p-8 ${darkMode ? 'bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
         <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center space-y-2 mb-8">
               <div className="flex justify-center text-rose-500 mb-4"><Wine size={56} /></div>
               <h1 className="text-3xl font-black tracking-tight">Wasted Report</h1>
               <p className="opacity-70 font-medium">
                  {shareStart === '2000-01-01' ? 'Lifetime History' : `${new Date(shareStart).toLocaleDateString('en-GB')} to ${new Date(shareEnd).toLocaleDateString('en-GB')}`}
               </p>
            </div>
            <div className={`p-8 rounded-3xl text-center shadow-xl ${darkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200'}`}>
               <div className="text-sm opacity-60 mb-2 font-bold uppercase tracking-widest">Total Wasted</div>
               <div className="text-5xl font-black text-rose-500 tracking-tighter">₹{totalWasted.toLocaleString('en-IN')}</div>
            </div>
            <div className="space-y-3 pt-4">
               {sharedData.length === 0 ? (
                  <div className="text-center opacity-50 py-12 border-2 border-dashed rounded-3xl border-gray-500/20">No expenses logged in this period.</div>
               ) : (
                  sharedData.map(t => {
                     const isExp = t.type === 'expense' || t.type === 'borrowed';
                     const tagCfg = settings.tags.find(x => x.name === t.tag) || { color: '#888' };
                     const color = isExp ? tagCfg.color : '#22c55e';
                     return (
                     <div key={t.id} className={`flex justify-between items-center p-5 rounded-2xl border ${darkMode ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white'}`}>
                        <div className="flex gap-4 items-center">
                           <div className="w-2 h-10 rounded-full" style={{backgroundColor: color}}></div>
                           <div>
                              <div className="font-bold text-lg">{t.reason || t.tag || t.type}</div>
                              <div className="text-xs opacity-60 mt-1">{new Date(t.date).toLocaleDateString('en-GB')} &bull; {t.tag || t.type}</div>
                           </div>
                        </div>
                        <div className={`font-black text-xl ${['income', 'settle_received', 'lent'].includes(t.type) ? 'text-emerald-500' : (darkMode ? 'text-white' : 'text-gray-900')}`}>
                           ₹{Number(t.amount).toLocaleString('en-IN')}
                        </div>
                     </div>
                  )})
               )}
            </div>
            <div className="text-center mt-12 pb-12">
               <button onClick={() => window.location.href = '/'} className="px-6 py-3 rounded-full bg-rose-500/10 text-rose-500 font-bold hover:bg-rose-500/20 transition-colors">Build your own tracker</button>
            </div>
         </div>
      </div>
    );
  }

  if (!isSharedMode && (!user || (user.isAnonymous && typeof __initial_auth_token === 'undefined'))) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${darkMode ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
        <div className={`max-w-md w-full p-8 rounded-3xl shadow-2xl ${darkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}>
          <div className="flex justify-center mb-6 text-rose-500">
            <Wine size={56} />
          </div>
          <h1 className="text-4xl font-black text-center mb-2 tracking-tighter">WASTED</h1>
          <p className="text-center mb-10 opacity-70 font-medium">Track where your money vanishes.</p>
          <button onClick={handleGoogleLogin} className="w-full py-4 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold transition-transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20">
            Continue with Google
          </button>
        </div>
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
          <NavItem icon={<LayoutDashboard />} label="Dashboard" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} dark={darkMode} />
          <NavItem icon={<PieChartIcon />} label="Analytics" active={currentView === 'analytics' || currentView === 'tagDetails'} onClick={() => setCurrentView('analytics')} dark={darkMode} />
          <NavItem icon={<HandCoins />} label="Debts & IOUs" active={currentView === 'debts'} onClick={() => setCurrentView('debts')} dark={darkMode} />
        </nav>
        <div className="pt-4 border-t border-gray-700/30 flex justify-between items-center px-2">
          <button onClick={toggleTheme} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}>
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <div className="text-xs font-bold opacity-50 truncate max-w-[120px]">{user.email || 'Anonymous'}</div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className={`md:hidden flex items-center justify-between p-4 border-b ${darkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'}`}>
          <div className="flex items-center gap-2 font-black text-lg text-rose-500 tracking-tight"><Wine size={20}/> WASTED</div>
          <button onClick={toggleTheme} className="p-2">{darkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 relative">
          
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
                
                {timeFilter === 'custom' && (
                   <div className="flex items-center gap-2">
                      <input type="date" value={customDate.start} onChange={e=>setCustomDate({...customDate, start: e.target.value})} className={`p-2 text-sm rounded-lg border outline-none ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-300'}`}/>
                      <span className="opacity-50 text-sm">to</span>
                      <input type="date" value={customDate.end} onChange={e=>setCustomDate({...customDate, end: e.target.value})} className={`p-2 text-sm rounded-lg border outline-none ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-300'}`}/>
                   </div>
                )}
             </div>

             <div className="flex items-center gap-3">
                <div className={`flex flex-1 xl:flex-none items-center px-3 py-2 rounded-xl border ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                   <Search size={16} className="opacity-50 mr-2" />
                   <input type="text" placeholder="Search entries..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full xl:w-48" />
                </div>
                <button onClick={() => setShowShareModal(true)} title="Share this Report" className={`p-2.5 rounded-xl border flex items-center gap-2 ${darkMode ? 'bg-rose-900/30 text-rose-400 border-rose-800/50 hover:bg-rose-900/50' : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'}`}>
                   <Share2 size={18} /> <span className="hidden sm:inline text-sm font-bold">Share Report</span>
                </button>
             </div>
          </div>

          {currentView === 'dashboard' && <DashboardView 
            balance={lifetimeBalance} income={periodIncome} expense={periodWasted} 
            transactions={displayTransactions} addTx={addTransaction} deleteTx={deleteTransaction} editTx={setEditingTransaction}
            settings={settings} updateSettings={updateSettings} cardClasses={cardClasses} dark={darkMode} dateBounds={dateBounds}
          />}
          
          {currentView === 'analytics' && <AnalyticsView 
            transactions={dateFilteredTransactions} settings={settings} dateBounds={dateBounds}
            onTagClick={(tag) => { setSelectedTagDetail(tag); setCurrentView('tagDetails'); }}
            cardClasses={cardClasses} dark={darkMode}
          />}
          
          {currentView === 'debts' && <DebtsView 
            friendLedgers={friendLedgers} owedToMe={totalOwedToMe} iOwe={totalIOwe}
            addTx={addTransaction} settings={settings} updateSettings={updateSettings} 
            cardClasses={cardClasses} dark={darkMode}
          />}

          {currentView === 'tagDetails' && <TagDetailsView 
            tag={selectedTagDetail} transactions={dateFilteredTransactions} settings={settings} 
            editTx={setEditingTransaction} deleteTx={deleteTransaction} dateBounds={dateBounds}
            onBack={() => { setSelectedTagDetail(null); setCurrentView('analytics'); }} cardClasses={cardClasses} dark={darkMode}
          />}
        </div>

        <nav className={`md:hidden flex justify-around p-3 border-t pb-safe ${darkMode ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white'}`}>
          <MobileNavItem icon={<LayoutDashboard/>} active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} dark={darkMode} />
          <MobileNavItem icon={<PieChartIcon/>} active={currentView === 'analytics' || currentView === 'tagDetails'} onClick={() => setCurrentView('analytics')} dark={darkMode} />
          <MobileNavItem icon={<HandCoins/>} active={currentView === 'debts'} onClick={() => setCurrentView('debts')} dark={darkMode} />
        </nav>
      </main>

      {/* Global Modals */}
      {showShareModal && <ShareModal user={user} currentBounds={dateBounds} onClose={() => setShowShareModal(false)} dark={darkMode} />}
      {editingTransaction && <EditTransactionModal tx={editingTransaction} settings={settings} onSave={updateTransaction} onClose={() => setEditingTransaction(null)} dark={darkMode} />}
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


const DashboardView = ({ balance, income, expense, transactions, addTx, deleteTx, editTx, settings, updateSettings, cardClasses, dark, dateBounds }) => {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [tag, setTag] = useState(settings.tags[0]?.name || '');
  const [person, setPerson] = useState(settings.friends[0]?.name || '');
  const [type, setType] = useState('expense'); 
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [showTagModal, setShowTagModal] = useState(false);
  const [showQAModal, setShowQAModal] = useState(false);
  const [showFriendModal, setShowFriendModal] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount) return;
    const txData = { amount: Number(amount), type, date, reason };
    
    if (type === 'expense' || type === 'borrowed') {
       if (!tag) return alert("Please select a tag.");
       txData.tag = tag;
    }
    if (type === 'borrowed' || type === 'lent') {
       if (!person) return alert("Please select a person.");
       txData.person = person;
    }

    addTx(txData);
    setAmount(''); setReason('');
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
        <div className="space-y-6 xl:col-span-1">
          <div className={`p-6 rounded-3xl ${cardClasses}`}>
            <h3 className="font-bold text-xl mb-5">Log Entry</h3>
            <form onSubmit={handleSubmit} className="space-y-5">
              
              <div className="grid grid-cols-2 gap-2 p-1 bg-gray-500/10 rounded-xl">
                <button type="button" onClick={() => setType('expense')} className={`py-2 text-sm font-bold rounded-lg transition-colors ${type === 'expense' ? 'bg-rose-500 text-white shadow' : 'opacity-70 hover:opacity-100'}`}>Expense</button>
                <button type="button" onClick={() => setType('income')} className={`py-2 text-sm font-bold rounded-lg transition-colors ${type === 'income' ? 'bg-emerald-500 text-white shadow' : 'opacity-70 hover:opacity-100'}`}>Income</button>
                <button type="button" onClick={() => setType('borrowed')} className={`py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-1 ${type === 'borrowed' ? 'bg-amber-500 text-white shadow' : 'opacity-70 hover:opacity-100'}`}><Ghost size={14}/> Borrowed</button>
                <button type="button" onClick={() => setType('lent')} className={`py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-1 ${type === 'lent' ? 'bg-indigo-500 text-white shadow' : 'opacity-70 hover:opacity-100'}`}><HandCoins size={14}/> Lent</button>
              </div>
              
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount (₹)" className={`w-full p-4 text-xl font-bold rounded-2xl border ${dark ? 'bg-gray-950 border-gray-800 text-white' : 'bg-gray-50 border-gray-200'} focus:outline-none focus:border-rose-500`} required />
              
              {(type === 'expense' || type === 'borrowed') && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                     <label className="text-xs font-bold opacity-60">Category Tag</label>
                     <button type="button" onClick={() => setShowTagModal(true)} className="text-xs font-bold text-rose-500 hover:underline">Manage Tags</button>
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

              {(type === 'borrowed' || type === 'lent') && (
                 <div>
                    <div className="flex justify-between items-center mb-2">
                       <label className="text-xs font-bold opacity-60">Friend / Person</label>
                       <button type="button" onClick={() => setShowFriendModal(true)} className="text-xs font-bold text-rose-500 hover:underline">Manage Friends</button>
                    </div>
                    <select value={person} onChange={e=>setPerson(e.target.value)} className={`w-full p-3 font-bold rounded-xl border ${dark ? 'bg-gray-950 border-gray-800' : 'bg-gray-50 border-gray-200'} outline-none`}>
                       <option value="" disabled>Select a person...</option>
                       {settings.friends.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                    </select>
                 </div>
              )}

              <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (Optional)" className={`w-full p-3 rounded-xl border ${dark ? 'bg-gray-950 border-gray-800 text-white' : 'bg-gray-50 border-gray-200'} focus:outline-none focus:border-rose-500`} />
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`w-full p-3 rounded-xl border font-medium ${dark ? 'bg-gray-950 border-gray-800 text-white' : 'bg-gray-50 border-gray-200'} focus:outline-none focus:border-rose-500`} />
              
              <button type="submit" className={`w-full py-4 text-white rounded-2xl font-black text-lg transition-transform hover:scale-[1.02] active:scale-[0.98] bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-500/20`}>
                Save Transaction
              </button>
            </form>
          </div>

          <div className={`p-6 rounded-3xl ${cardClasses}`}>
            <div className="flex justify-between items-center mb-4">
               <h3 className="font-bold">Quick Adds</h3>
               <button onClick={() => setShowQAModal(true)} className="p-1.5 rounded-lg bg-gray-500/10 hover:bg-gray-500/20 transition-colors"><Settings size={16}/></button>
            </div>
            <div className="flex flex-wrap gap-2">
              {settings.quickAdds.map(qa => {
                 const tagConfig = settings.tags.find(t => t.name === qa.tag) || { color: '#888' };
                 return (
                   <button key={qa.id} onClick={() => addTx({amount: qa.amount, tag: qa.tag, reason: qa.reason, type: 'expense', date: new Date().toISOString().split('T')[0]})} className={`px-4 py-2.5 rounded-2xl text-sm flex flex-col items-start gap-1 transition-transform hover:scale-105 active:scale-95 ${dark ? 'bg-gray-950 border border-gray-800 hover:border-gray-700' : 'bg-white border border-gray-200 shadow-sm hover:border-gray-300'}`}>
                     <span className="font-black">₹{qa.amount}</span>
                     <span className="font-medium text-xs opacity-80" style={{color: tagConfig.color}}>{qa.tag}</span>
                     {qa.reason && <span className="text-[10px] font-medium opacity-60 truncate max-w-[100px]">{qa.reason}</span>}
                   </button>
                 );
              })}
              {settings.quickAdds.length === 0 && <span className="text-sm font-medium opacity-50">No quick adds configured.</span>}
            </div>
          </div>
        </div>

        <div className={`p-6 rounded-3xl xl:col-span-2 flex flex-col h-[700px] ${cardClasses}`}>
          <div className="flex justify-between items-center mb-6">
             <h3 className="font-bold text-xl">Ledger Activity ({dateBounds.label})</h3>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {transactions.length === 0 ? (
              <div className="h-full flex items-center justify-center opacity-50 font-medium">No transactions in this period.</div>
            ) : (
              transactions.map(t => <TransactionRow key={t.id} t={t} settings={settings} dark={dark} onEdit={() => editTx(t)} onDelete={() => deleteTx(t.id)} />)
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

const TransactionRow = ({ t, settings, dark, onEdit, onDelete }) => {
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
     color = '#22c55e';
     amountPrefix = '+';
     amountColor = 'text-emerald-500';
     label = t.reason || 'Income';
     sublabel = 'Added to Balance';
  } else if (t.type === 'borrowed') {
     color = '#f59e0b';
     label = t.reason || `${t.tag} (Credit)`;
     sublabel = `Ghost Exp. (Owe ${t.person})`;
  } else if (t.type === 'lent') {
     color = '#6366f1';
     label = t.reason || `Lent Money`;
     sublabel = `To ${t.person}`;
  } else if (t.type === 'settle_gave') {
     color = '#f43f5e';
     label = `Paid ${t.person}`;
     sublabel = t.reason || 'Debt Settlement';
  } else if (t.type === 'settle_received') {
     color = '#22c55e';
     amountPrefix = '+';
     amountColor = 'text-emerald-500';
     label = `Received from ${t.person}`;
     sublabel = t.reason || 'Debt Settlement';
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
        <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex flex-col md:flex-row gap-1 md:gap-2">
           <button onClick={onEdit} className="p-2 rounded-lg bg-gray-500/10 hover:bg-gray-500/20 text-gray-500 transition-colors"><Pencil size={14}/></button>
           <button onClick={onDelete} className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-colors"><Trash2 size={14}/></button>
        </div>
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

  // Calendar Heatmap Logic - Deriving limits dynamically based on current transactions
  const dailySpend = {};
  expenses.forEach(t => {
    const dateStr = t.date.split('T')[0];
    dailySpend[dateStr] = (dailySpend[dateStr] || 0) + Number(t.amount);
  });
  const maxDailySpend = Math.max(0, ...Object.values(dailySpend));
  
  // Decide which month to show. Default to Current Month if lifetime, or the month of the "start" bound.
  const calBaseDate = dateBounds.start ? new Date(dateBounds.start) : new Date();
  const currentYear = calBaseDate.getFullYear();
  const currentMonth = calBaseDate.getMonth();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
  const calendarDays = Array(firstDayOfWeek).fill(null).concat(Array.from({length: daysInMonth}, (_, i) => i + 1));
  const monthName = calBaseDate.toLocaleString('default', { month: 'long', year: 'numeric' });

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
                                       <span className="truncate max-w-[150px] font-bold">{t.reason || t.tag} {t.type==='borrowed' && '(Ghost)'}</span>
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
              {pieData.length === 0 && <div className="opacity-50 font-medium text-center py-10">No categories found.</div>}
           </div>
        </div>
      </div>

      <div className={`p-6 rounded-3xl ${cardClasses}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
           <h3 className="font-bold text-xl flex items-center gap-3"><CalendarDays size={24} className="text-rose-500"/> Spending Heatmap</h3>
           <span className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm font-bold opacity-80">{monthName}</span>
        </div>
        <div className="grid grid-cols-7 gap-2 md:gap-4 max-w-3xl mx-auto">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="text-center text-xs font-black tracking-widest opacity-50 mb-2 uppercase">{d}</div>)}
          {calendarDays.map((day, idx) => {
             if (!day) return <div key={`empty-${idx}`} className="aspect-square" />;
             
             // Build date string correctly adjusting for timezone issues manually
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

const TagDetailsView = ({ tag, transactions, settings, onBack, editTx, deleteTx, dateBounds, cardClasses, dark }) => {
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
                       <div className="opacity-100 md:opacity-0 group-hover:opacity-100 flex gap-1">
                           <button onClick={() => editTx(t)} className="p-2 rounded-lg hover:bg-gray-500/20 text-gray-500"><Pencil size={16}/></button>
                           <button onClick={() => deleteTx(t.id)} className="p-2 rounded-lg hover:bg-rose-500/20 text-rose-500"><Trash2 size={16}/></button>
                       </div>
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

const DebtsView = ({ friendLedgers, owedToMe, iOwe, addTx, settings, updateSettings, cardClasses, dark }) => {
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');
  
  const activeFriends = Object.entries(friendLedgers).filter(([_, ledger]) => ledger.netBalance !== 0);

  const handleSettle = (friendName, netBalance) => {
     if(!settleAmount) return;
     const isReceiving = netBalance > 0; 
     
     addTx({
        type: isReceiving ? 'settle_received' : 'settle_gave',
        amount: Number(settleAmount),
        person: friendName,
        reason: 'Debt Settlement',
        date: new Date().toISOString().split('T')[0]
     });
     setSettleAmount('');
     setSelectedFriend(null);
  };

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
               const isSelected = selectedFriend === friendName;

               return (
                  <div key={friendName} className={`p-6 rounded-3xl border transition-all shadow-sm ${dark ? 'border-gray-800 bg-gray-950/40' : 'border-gray-200 bg-white'}`}>
                     <div className="flex justify-between items-center cursor-pointer" onClick={() => setSelectedFriend(isSelected ? null : friendName)}>
                        <div className="font-black text-2xl flex items-center gap-3">
                           <div className={`w-3 h-3 rounded-full ${owesMe ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                           {friendName}
                        </div>
                        <div className={`text-right font-black text-xl md:text-2xl tracking-tight ${owesMe ? 'text-emerald-500' : 'text-rose-500'}`}>
                           {owesMe ? 'Owes you ' : 'You owe '} ₹{absBal.toLocaleString('en-IN')}
                        </div>
                     </div>
                     
                     {isSelected && (
                        <div className="mt-6 pt-6 border-t border-gray-700/30 flex flex-col md:flex-row gap-4 items-center">
                           <div className="flex-1 w-full text-sm font-bold opacity-70">
                              Record a partial or full settlement payment:
                           </div>
                           <div className="flex w-full md:w-auto gap-2">
                              <input 
                                 type="number" value={settleAmount} onChange={e=>setSettleAmount(e.target.value)} 
                                 placeholder={`Max ₹${absBal}`} max={absBal}
                                 className={`w-32 p-3 font-bold rounded-xl border outline-none focus:border-indigo-500 ${dark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-300'}`}
                              />
                              <button onClick={() => setSettleAmount(absBal)} className="px-4 py-3 text-sm font-bold rounded-xl bg-gray-500/10 hover:bg-gray-500/20 transition-colors">Full</button>
                              <button onClick={() => handleSettle(friendName, ledger.netBalance)} className="px-6 py-3 font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">Settle</button>
                           </div>
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
      onSave(tx.id, {
         ...formData,
         amount: Number(formData.amount)
      });
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

const ShareModal = ({ user, currentBounds, onClose, dark }) => {
   const [link, setLink] = useState('');
   const [copied, setCopied] = useState(false);

   const start = currentBounds.start || '2000-01-01'; // Default for lifetime
   const end = currentBounds.end || '2100-01-01';     // Default for lifetime

   const generate = () => {
      // Vercel Proof URL generation using URL params natively. Never 404s.
      const url = `${window.location.origin}/?share=${user.uid}&s=${start}&e=${end}`;
      setLink(url);
   }

   const copyToClipboard = () => {
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
   }

   return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
         <div className={`w-full max-w-sm p-8 rounded-[2rem] shadow-2xl ${dark ? 'bg-gray-900 border border-gray-800 text-white' : 'bg-white text-gray-900'}`}>
            <div className="flex justify-between items-center mb-6">
               <h3 className="font-black text-2xl tracking-tight">Share Report</h3>
               <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-500/20 transition-colors"><X size={20}/></button>
            </div>
            
            <div className="space-y-6">
               <div className={`p-4 rounded-2xl text-center border-2 border-dashed ${dark ? 'bg-gray-950 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">Time Period to Share</div>
                  <div className="font-black text-lg text-rose-500">{currentBounds.label}</div>
                  {currentBounds.start && (
                     <div className="text-xs font-medium opacity-60 mt-1">{new Date(currentBounds.start).toLocaleDateString('en-GB')} - {new Date(currentBounds.end).toLocaleDateString('en-GB')}</div>
                  )}
               </div>
               
               <p className="text-sm font-medium opacity-70 text-center px-4">
                  This will generate a secure, read-only link containing your expenses for the selected period. Your bank balance and debts will remain hidden.
               </p>

               <button onClick={generate} className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-lg transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2">
                  <LinkIcon size={20}/> Generate Link
               </button>
               
               {link && (
                  <div className="mt-6 p-1 rounded-2xl bg-gray-500/10 border border-gray-500/20 flex flex-col items-center">
                     <div className="p-4 w-full break-all text-xs md:text-sm font-medium opacity-80 text-center select-all">
                        {link}
                     </div>
                     <button onClick={copyToClipboard} className={`w-full py-3 rounded-xl font-bold transition-colors ${copied ? 'bg-emerald-500 text-white' : (dark ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-white hover:bg-gray-100 text-gray-900 shadow-sm')}`}>
                        {copied ? 'Copied!' : 'Copy to Clipboard'}
                     </button>
                  </div>
               )}
            </div>
         </div>
      </div>
   )
}