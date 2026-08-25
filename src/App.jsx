import React, { useState, useEffect, useMemo } from 'react';
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis
} from 'recharts';
import { 
  LayoutDashboard, PieChart as PieChartIcon, HandCoins,
  Moon, Sun, Search, Share2, ArrowUpRight, ArrowDownRight, 
  CheckCircle2, Wine, Calendar as CalendarIcon, X, Settings, ChevronLeft, Plus
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "mock-key", authDomain: "mock.firebaseapp.com", projectId: "mock-project"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'wasted-tracker';

const PRESET_COLORS = ['#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#94a3b8'];

const DEFAULT_TAGS = [
  { id: 't1', name: 'Food', color: '#f97316' },
  { id: 't2', name: 'Transport', color: '#3b82f6' },
  { id: 't3', name: 'Bills', color: '#eab308' },
  { id: 't4', name: 'Shopping', color: '#ec4899' },
  { id: 't5', name: 'Housing', color: '#8b5cf6' },
  { id: 't6', name: 'Drinks', color: '#f43f5e' }
];

const DEFAULT_QUICK_ADDS = [
  { id: 'qa1', amount: 20, tag: 'Drinks', reason: 'Tea/Coffee' },
  { id: 'qa2', amount: 150, tag: 'Transport', reason: 'Cab/Auto' }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  
  // Shared URL parsing
  const urlParams = new URLSearchParams(window.location.search);
  const shareUid = urlParams.get('share');
  const shareStart = urlParams.get('s');
  const shareEnd = urlParams.get('e');
  const isSharedMode = !!shareUid;
  const [sharedData, setSharedData] = useState(null);
  
  // App State
  const [transactions, setTransactions] = useState([]);
  const [debts, setDebts] = useState([]);
  const [settings, setSettings] = useState({ tags: DEFAULT_TAGS, quickAdds: DEFAULT_QUICK_ADDS });
  
  // UI State
  const [currentView, setCurrentView] = useState('dashboard'); // dashboard, analytics, debts, tagDetails
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagDetail, setSelectedTagDetail] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
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
    if (!user) return;

    // If viewing a shared link, ONLY fetch the shared data
    if (isSharedMode) {
      const txRef = collection(db, 'artifacts', appId, 'users', shareUid, 'transactions');
      const unsubTx = onSnapshot(txRef, (snapshot) => {
        const data = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(t => t.date >= shareStart && t.date <= shareEnd);
        data.sort((a, b) => new Date(b.date) - new Date(a.date));
        setSharedData(data);
      }, (error) => console.error("Error fetching shared tx:", error));
      
      return () => unsubTx();
    }

    const userId = user.uid;

    const txRef = collection(db, 'artifacts', appId, 'users', userId, 'transactions');
    const unsubTx = onSnapshot(txRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(data);
    }, (error) => console.error("Error fetching tx:", error));

    const debtsRef = collection(db, 'artifacts', appId, 'users', userId, 'debts');
    const unsubDebts = onSnapshot(debtsRef, (snapshot) => {
      setDebts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Error fetching debts:", error));

    const settingsRef = doc(db, 'artifacts', appId, 'users', userId, 'settings', 'preferences');
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data());
      } else {
        setDoc(settingsRef, { tags: DEFAULT_TAGS, quickAdds: DEFAULT_QUICK_ADDS });
      }
    }, (error) => console.error("Error fetching settings:", error));

    return () => { unsubTx(); unsubDebts(); unsubSettings(); };
  }, [user]);

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

  const deleteTransaction = async (id) => {
    if (!user) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', id));
  };

  const addDebt = async (data) => {
    if (!user) return;
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'debts'), {
      ...data, settledAmount: 0, status: 'pending', createdAt: new Date().toISOString()
    });
  };

  const updateDebtSettlement = async (id, newSettledAmount, totalAmount) => {
    if (!user) return;
    const status = newSettledAmount >= totalAmount ? 'settled' : 'pending';
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'debts', id), {
      settledAmount: newSettledAmount, status
    });
  };

  const filteredTransactions = useMemo(() => {
    if (!searchQuery) return transactions;
    return transactions.filter(t => 
      (t.reason || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      t.tag.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [transactions, searchQuery]);

  const currentBalance = transactions.reduce((acc, curr) => 
    curr.type === 'income' ? acc + Number(curr.amount) : acc - Number(curr.amount), 0
  );
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0);

  const totalOwedToMe = debts.filter(d => d.type === 'lent' && d.status !== 'settled')
    .reduce((acc, d) => acc + (Number(d.amount) - Number(d.settledAmount || 0)), 0);
  const totalIOwe = debts.filter(d => d.type === 'borrowed' && d.status !== 'settled')
    .reduce((acc, d) => acc + (Number(d.amount) - Number(d.settledAmount || 0)), 0);

  if (loading) {
    return <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>Loading...</div>;
  }

  // --- NEW CODE: Render the Shared Report for your mother ---
  if (isSharedMode && sharedData) {
    const totalWasted = sharedData.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0);
    return (
      <div className={`min-h-screen p-4 md:p-8 ${darkMode ? 'bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
         <div className="max-w-3xl mx-auto space-y-6">
            <div className="text-center space-y-2 mb-8">
               <div className="flex justify-center text-rose-500 mb-4"><Wine size={48} /></div>
               <h1 className="text-3xl font-black tracking-tight">Shared Expense Report</h1>
               <p className="opacity-70">From {new Date(shareStart).toLocaleDateString()} to {new Date(shareEnd).toLocaleDateString()}</p>
            </div>
            <div className={`p-6 rounded-2xl text-center shadow-lg ${darkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200'}`}>
               <div className="text-sm opacity-60 mb-2">Total Wasted in Period</div>
               <div className="text-4xl font-bold text-rose-500">₹{totalWasted.toLocaleString('en-IN')}</div>
            </div>
            <div className="space-y-3">
               {sharedData.length === 0 ? (
                  <div className="text-center opacity-50 py-8">No expenses logged in this period.</div>
               ) : (
                  sharedData.map(t => (
                     <div key={t.id} className={`flex justify-between p-4 rounded-xl border ${darkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'}`}>
                        <div>
                           <div className="font-bold">{t.reason || t.tag}</div>
                           <div className="text-xs opacity-60 mt-1">{new Date(t.date).toLocaleDateString()} &bull; {t.tag}</div>
                        </div>
                        <div className={`font-bold ${t.type === 'income' ? 'text-emerald-500' : 'text-gray-900 dark:text-gray-100'}`}>
                           {t.type === 'income' ? '+' : '-'}₹{Number(t.amount).toLocaleString('en-IN')}
                        </div>
                     </div>
                  ))
               )}
            </div>
            <div className="text-center mt-8 pb-8">
               <button onClick={() => window.location.href = '/'} className="text-rose-500 font-bold hover:underline">Build your own tracker</button>
            </div>
         </div>
      </div>
    );
  }
  // ------------------------------------------------------------

  // MODIFIED: Hide login screen if they are viewing a shared report
  if (!isSharedMode && (!user || (user.isAnonymous && typeof __initial_auth_token === 'undefined'))) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${darkMode ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
        <div className={`max-w-md w-full p-8 rounded-2xl shadow-xl ${darkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}>
          <div className="flex justify-center mb-6 text-rose-500">
            <Wine size={48} />
          </div>
          <h1 className="text-3xl font-black text-center mb-2 tracking-tight">WASTED</h1>
          <p className="text-center mb-8 opacity-70">Track where your money vanishes.</p>
          <button onClick={handleGoogleLogin} className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
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
      {/* Sidebar */}
      <aside className={`hidden md:flex flex-col w-64 border-r ${darkMode ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white'} p-4`}>
        <div className="flex items-center gap-3 font-black text-2xl mb-10 px-2 text-rose-500 tracking-tight">
          <Wine /> WASTED
        </div>
        <nav className="flex-1 space-y-2">
          <NavItem icon={<LayoutDashboard />} label="Dashboard" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} dark={darkMode} />
          <NavItem icon={<PieChartIcon />} label="Analytics" active={currentView === 'analytics'} onClick={() => setCurrentView('analytics')} dark={darkMode} />
          <NavItem icon={<HandCoins />} label="Debts & IOUs" active={currentView === 'debts'} onClick={() => setCurrentView('debts')} dark={darkMode} />
        </nav>
        <div className="pt-4 border-t border-gray-700/30 flex justify-between items-center px-2">
          <button onClick={toggleTheme} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}>
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <div className="text-xs opacity-50 truncate max-w-[120px]">{user.email || 'Anonymous'}</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className={`md:hidden flex items-center justify-between p-4 border-b ${darkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'}`}>
          <div className="flex items-center gap-2 font-black text-lg text-rose-500 tracking-tight"><Wine size={20}/> WASTED</div>
          <button onClick={toggleTheme} className="p-2">{darkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          {/* Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <h1 className="text-2xl font-bold capitalize">
              {currentView === 'tagDetails' ? `${selectedTagDetail} History` : currentView}
            </h1>
            <div className="flex items-center gap-3">
              <div className={`flex items-center px-3 py-2 rounded-lg border ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}>
                <Search size={16} className="opacity-50 mr-2" />
                <input 
                  type="text" placeholder="Search..." value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm w-24 md:w-48"
                />
              </div>
              <button onClick={() => setShowShareModal(true)} title="Share Custom Period" className={`p-2 rounded-lg border flex items-center gap-2 ${darkMode ? 'bg-rose-900/30 text-rose-400 border-rose-800/50 hover:bg-rose-900/50' : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'}`}>
                <Share2 size={18} /> <span className="hidden md:inline text-sm font-medium">Share</span>
              </button>
            </div>
          </div>

          {/* View Routing */}
          {currentView === 'dashboard' && <DashboardView 
            balance={currentBalance} income={totalIncome} expense={totalExpense} 
            transactions={filteredTransactions} addTx={addTransaction} deleteTx={deleteTransaction}
            settings={settings} updateSettings={updateSettings} cardClasses={cardClasses} dark={darkMode}
          />}
          
          {currentView === 'analytics' && <AnalyticsView 
            transactions={transactions} settings={settings}
            onTagClick={(tag) => { setSelectedTagDetail(tag); setCurrentView('tagDetails'); }}
            cardClasses={cardClasses} dark={darkMode}
          />}
          
          {currentView === 'debts' && <DebtsView 
            debts={debts} addDebt={addDebt} updateDebt={updateDebtSettlement}
            owedToMe={totalOwedToMe} iOwe={totalIOwe} cardClasses={cardClasses} dark={darkMode}
          />}

          {currentView === 'tagDetails' && <TagDetailsView 
            tag={selectedTagDetail} transactions={transactions} settings={settings}
            onBack={() => { setSelectedTagDetail(null); setCurrentView('analytics'); }}
            cardClasses={cardClasses} dark={darkMode}
          />}
        </div>

        {/* Mobile Nav */}
        <nav className={`md:hidden flex justify-around p-3 border-t pb-safe ${darkMode ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-white'}`}>
          <MobileNavItem icon={<LayoutDashboard/>} active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} dark={darkMode} />
          <MobileNavItem icon={<PieChartIcon/>} active={currentView === 'analytics' || currentView === 'tagDetails'} onClick={() => setCurrentView('analytics')} dark={darkMode} />
          <MobileNavItem icon={<HandCoins/>} active={currentView === 'debts'} onClick={() => setCurrentView('debts')} dark={darkMode} />
        </nav>
      </main>

      {/* Global Modals */}
      {showShareModal && <ShareModal user={user} onClose={() => setShowShareModal(false)} dark={darkMode} />}
    </div>
  );
}

const NavItem = ({ icon, label, active, onClick, dark }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
    active 
      ? (dark ? 'bg-rose-500/10 text-rose-400' : 'bg-rose-50 text-rose-600') 
      : (dark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600')
  }`}>
    {icon} <span className="font-medium">{label}</span>
  </button>
);

const MobileNavItem = ({ icon, active, onClick, dark }) => (
  <button onClick={onClick} className={`p-3 rounded-xl ${
    active ? (dark ? 'text-rose-400 bg-rose-500/10' : 'text-rose-600 bg-rose-50') : (dark ? 'text-gray-500' : 'text-gray-400')
  }`}>
    {icon}
  </button>
);

const DashboardView = ({ balance, income, expense, transactions, addTx, deleteTx, settings, updateSettings, cardClasses, dark }) => {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [tag, setTag] = useState(settings.tags[0]?.name || 'Food');
  const [type, setType] = useState('expense');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [showTagModal, setShowTagModal] = useState(false);
  const [showQAModal, setShowQAModal] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || !tag) return;
    addTx({ amount: Number(amount), reason, tag, type, date });
    setAmount(''); setReason('');
  };

  const handleQuickAdd = (qa) => {
    addTx({ amount: qa.amount, tag: qa.tag, reason: qa.reason, type: 'expense', date: new Date().toISOString().split('T')[0] });
  };

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`p-6 rounded-2xl ${cardClasses}`}>
          <div className="text-sm opacity-60 mb-1">Total Balance</div>
          <div className={`text-3xl font-bold ${balance >= 0 ? (dark ? 'text-white' : 'text-gray-900') : 'text-rose-500'}`}>
            ₹{balance.toLocaleString('en-IN')}
          </div>
        </div>
        <div className={`p-6 rounded-2xl ${cardClasses}`}>
          <div className="flex items-center gap-2 text-sm opacity-60 mb-1"><ArrowDownRight size={16} className="text-emerald-500"/> Total Income</div>
          <div className="text-2xl font-bold text-emerald-500">₹{income.toLocaleString('en-IN')}</div>
        </div>
        <div className={`p-6 rounded-2xl ${cardClasses}`}>
          <div className="flex items-center gap-2 text-sm opacity-60 mb-1"><ArrowUpRight size={16} className="text-rose-500"/> Total Wasted</div>
          <div className="text-2xl font-bold text-rose-500">₹{expense.toLocaleString('en-IN')}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form & Quick Actions */}
        <div className="space-y-6 lg:col-span-1">
          <div className={`p-6 rounded-2xl ${cardClasses}`}>
            <h3 className="font-bold mb-4">Log Transaction</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex rounded-lg overflow-hidden border border-gray-700/30">
                <button type="button" onClick={() => setType('expense')} className={`flex-1 py-2 text-sm font-medium transition-colors ${type === 'expense' ? 'bg-rose-500 text-white' : (dark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500')}`}>Expense</button>
                <button type="button" onClick={() => setType('income')} className={`flex-1 py-2 text-sm font-medium transition-colors ${type === 'income' ? 'bg-emerald-500 text-white' : (dark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500')}`}>Income</button>
              </div>
              
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount (₹)" className={`w-full p-4 text-lg rounded-xl border ${dark ? 'bg-gray-950 border-gray-800 text-white' : 'bg-gray-50 border-gray-200'} focus:outline-none focus:border-rose-500`} required />
              
              <div>
                <label className="text-xs font-medium opacity-60 mb-2 block">Category Tag</label>
                <div className="flex flex-wrap gap-2">
                  {settings.tags.map(t => (
                    <button 
                      key={t.id} type="button" onClick={() => setTag(t.name)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${tag === t.name ? 'ring-2 ring-offset-2 ring-rose-500 scale-105' : 'opacity-80 hover:opacity-100'}`}
                      style={{ backgroundColor: t.color, color: '#fff' }}
                    >
                      {t.name}
                    </button>
                  ))}
                  <button type="button" onClick={() => setShowTagModal(true)} className={`px-3 py-1.5 rounded-full text-sm font-medium border border-dashed flex items-center gap-1 ${dark ? 'border-gray-600 text-gray-300 hover:bg-gray-800' : 'border-gray-400 text-gray-600 hover:bg-gray-100'}`}>
                    <Settings size={14}/> Edit Tags
                  </button>
                </div>
              </div>

              <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Extended Reason (Optional)" className={`w-full p-3 rounded-xl border ${dark ? 'bg-gray-950 border-gray-800 text-white' : 'bg-gray-50 border-gray-200'} focus:outline-none focus:border-rose-500`} />
              
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`w-full p-3 rounded-xl border ${dark ? 'bg-gray-950 border-gray-800 text-white' : 'bg-gray-50 border-gray-200'} focus:outline-none focus:border-rose-500`} />
              
              <button type="submit" className={`w-full py-3 text-white rounded-xl font-bold transition-colors ${type === 'income' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                Save Entry
              </button>
            </form>
          </div>

          <div className={`p-6 rounded-2xl ${cardClasses}`}>
            <div className="flex justify-between items-center mb-4">
               <h3 className="font-bold text-sm opacity-70">Quick Adds</h3>
               <button onClick={() => setShowQAModal(true)} className="p-1 rounded bg-gray-500/10 hover:bg-gray-500/20 transition-colors"><Plus size={16}/></button>
            </div>
            <div className="flex flex-wrap gap-2">
              {settings.quickAdds.map(qa => {
                 const tagConfig = settings.tags.find(t => t.name === qa.tag) || { color: '#888' };
                 return (
                   <button key={qa.id} onClick={() => handleQuickAdd(qa)} className={`px-4 py-2 rounded-xl text-sm flex flex-col items-start gap-1 transition-transform hover:scale-105 active:scale-95 ${dark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-100 border border-gray-200'}`}>
                     <span className="font-bold">₹{qa.amount} {qa.tag}</span>
                     {qa.reason && <span className="text-xs opacity-60 truncate max-w-[100px]">{qa.reason}</span>}
                     <div className="w-full h-1 mt-1 rounded-full opacity-50" style={{backgroundColor: tagConfig.color}}></div>
                   </button>
                 );
              })}
              {settings.quickAdds.length === 0 && <span className="text-xs opacity-50">No quick adds configured.</span>}
            </div>
          </div>
        </div>

        {/* Right Column: List */}
        <div className={`p-6 rounded-2xl lg:col-span-2 flex flex-col h-full min-h-[500px] max-h-[800px] ${cardClasses}`}>
          <h3 className="font-bold mb-4">Recent Activity</h3>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {transactions.length === 0 ? (
              <div className="h-full flex items-center justify-center opacity-50 text-sm">No transactions yet. Start logging!</div>
            ) : (
              transactions.map(t => {
                const tagConfig = settings.tags.find(x => x.name === t.tag) || { color: '#888' };
                return (
                  <div key={t.id} className={`flex items-center justify-between p-4 rounded-xl border ${dark ? 'border-gray-800 bg-gray-950/50' : 'border-gray-100 bg-gray-50/50'}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-10 rounded-full" style={{backgroundColor: t.type === 'income' ? '#22c55e' : tagConfig.color}}></div>
                      <div>
                        <div className="font-bold">{t.reason || t.tag}</div>
                        <div className="text-xs opacity-60 flex items-center gap-2 mt-1">
                          <span>{new Date(t.date).toLocaleDateString('en-GB', {day: '2-digit', month: 'short'})}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{backgroundColor: `${tagConfig.color}33`, color: tagConfig.color}}>{t.tag}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`font-bold text-lg ${t.type === 'income' ? 'text-emerald-500' : 'text-gray-900 dark:text-gray-100'}`}>
                        {t.type === 'income' ? '+' : '-'}₹{Number(t.amount).toLocaleString('en-IN')}
                      </div>
                      <button onClick={() => deleteTransaction(t.id)} className="opacity-0 hover:opacity-100 transition-opacity text-rose-500 p-2 rounded-lg hover:bg-rose-500/10">
                        <X size={16}/>
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {showTagModal && <TagManagerModal settings={settings} updateSettings={updateSettings} onClose={() => setShowTagModal(false)} dark={dark} />}
      {showQAModal && <QuickAddManagerModal settings={settings} updateSettings={updateSettings} onClose={() => setShowQAModal(false)} dark={dark} />}
    </div>
  );
};

const AnalyticsView = ({ transactions, settings, onTagClick, cardClasses, dark }) => {
  const [hoveredCategory, setHoveredCategory] = useState(null);
  
  const expenses = transactions.filter(t => t.type === 'expense');
  
  // Aggregate Data for Pie Chart
  const tagDataMap = expenses.reduce((acc, t) => {
    if (!acc[t.tag]) acc[t.tag] = { total: 0, maxAmount: 0 };
    acc[t.tag].total += Number(t.amount);
    if (Number(t.amount) > acc[t.tag].maxAmount) acc[t.tag].maxAmount = Number(t.amount);
    return acc;
  }, {});

  const pieData = Object.keys(tagDataMap).map(key => {
    const config = settings.tags.find(t => t.name === key) || { color: '#888' };
    return {
      name: key,
      value: tagDataMap[key].total,
      maxExpenseInTag: tagDataMap[key].maxAmount,
      color: config.color
    };
  }).sort((a,b) => b.value - a.value);

  const totalMonthlySpend = pieData.reduce((acc, item) => acc + item.value, 0);

  // Calendar Heatmap Data Generation
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
  
  const calendarDays = Array(firstDayOfWeek).fill(null).concat(Array.from({length: daysInMonth}, (_, i) => i + 1));
  
  const dailySpend = {};
  expenses.forEach(t => {
    const dateStr = t.date.split('T')[0];
    dailySpend[dateStr] = (dailySpend[dateStr] || 0) + Number(t.amount);
  });
  const maxDailySpend = Math.max(0, ...Object.values(dailySpend));

  return (
    <div className="space-y-6">
      {/* Top Row: Pie & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`p-6 rounded-2xl ${cardClasses} h-[400px] flex flex-col`}>
          <h3 className="font-bold mb-4">Wasted by Category</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={4} dataKey="value" stroke="none">
                  {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <RechartsTooltip formatter={(value) => `₹${value.toLocaleString()}`} contentStyle={{ backgroundColor: dark ? '#1f2937' : '#fff', borderRadius: '12px', border: 'none', color: dark ? '#fff' : '#000', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
             <div className="flex-1 flex items-center justify-center opacity-50">No data to display.</div>
          )}
        </div>

        <div className={`p-6 rounded-2xl ${cardClasses} h-[400px] flex flex-col`}>
           <h3 className="font-bold mb-4">Category Breakdown</h3>
           <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1 relative">
              {pieData.map(item => (
                <div 
                  key={item.name} 
                  className="relative flex flex-col gap-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 p-3 rounded-xl transition-colors group"
                  onMouseEnter={() => setHoveredCategory(item.name)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  onClick={() => onTagClick(item.name)}
                >
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-3 font-medium">
                      <span className="w-3 h-3 rounded-full" style={{backgroundColor: item.color}}></span>
                      {item.name}
                    </span>
                    <span className="font-bold">₹{item.value.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700/50 rounded-full h-1 mt-1">
                    <div className="h-1 rounded-full transition-all duration-500" style={{ width: `${Math.min((item.value / (totalMonthlySpend || 1)) * 100, 100)}%`, backgroundColor: item.color }}></div>
                  </div>
                  
                  {/* Hover Popover showing exact line bars */}
                  {hoveredCategory === item.name && (
                     <div className="absolute top-full left-0 md:left-auto md:-right-4 w-full md:w-72 mt-2 md:mt-0 p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-2xl z-50 pointer-events-none">
                        <div className="text-xs font-bold mb-3 opacity-70 flex justify-between">
                           <span>Top {item.name} Expenses</span>
                           <span>Click to see all</span>
                        </div>
                        <div className="space-y-3 max-h-48 overflow-hidden">
                           {expenses.filter(e => e.tag === item.name)
                              .sort((a,b) => b.amount - a.amount)
                              .slice(0, 5) // preview top 5
                              .map(t => (
                                 <div key={t.id}>
                                    <div className="flex justify-between text-xs mb-1">
                                       <span className="truncate w-32 font-medium">{t.reason || t.tag}</span>
                                       <span className="font-bold opacity-80">₹{t.amount}</span>
                                    </div>
                                    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                                       <div className="h-1.5 rounded-full" style={{width: `${(t.amount/item.maxExpenseInTag)*100}%`, backgroundColor: item.color}} />
                                    </div>
                                 </div>
                              ))
                           }
                        </div>
                     </div>
                  )}
                </div>
              ))}
              {pieData.length === 0 && <div className="opacity-50 text-sm mt-4 text-center">No categories found.</div>}
           </div>
        </div>
      </div>

      {/* Calendar Heatmap */}
      <div className={`p-6 rounded-2xl ${cardClasses}`}>
        <h3 className="font-bold mb-6 flex items-center gap-2"><CalendarIcon size={18}/> Spending Heatmap (Current Month)</h3>
        <div className="grid grid-cols-7 gap-2 md:gap-4 max-w-2xl mx-auto">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="text-center text-xs font-bold opacity-50 mb-2">{d}</div>)}
          {calendarDays.map((day, idx) => {
             if (!day) return <div key={`empty-${idx}`} />;
             const dStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
             const spend = dailySpend[dStr] || 0;
             const intensity = maxDailySpend > 0 ? (spend / maxDailySpend) : 0;
             const hasSpend = spend > 0;
             
             return (
               <div key={day} className="aspect-square rounded-xl flex flex-col items-center justify-center relative group transition-transform hover:scale-110" 
                    style={{ 
                      backgroundColor: hasSpend ? `rgba(244, 63, 94, ${intensity * 0.8 + 0.2})` : (dark ? '#1f2937' : '#f3f4f6'),
                      color: hasSpend ? '#fff' : 'inherit'
                    }}>
                 <span className="text-sm font-medium">{day}</span>
                 {hasSpend && (
                    <div className="absolute bottom-full mb-2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 shadow-lg">
                       ₹{spend.toLocaleString()} spent
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

const TagDetailsView = ({ tag, transactions, settings, onBack, cardClasses, dark }) => {
  const tagExpenses = transactions.filter(t => t.type === 'expense' && t.tag === tag).sort((a,b) => b.amount - a.amount);
  const maxAmt = Math.max(0, ...tagExpenses.map(t => Number(t.amount)));
  const tagConfig = settings.tags.find(t => t.name === tag) || { color: '#888' };

  return (
     <div className={`p-6 rounded-2xl ${cardClasses} flex flex-col h-[calc(100vh-120px)] relative`}>
        <div className="flex items-center gap-4 mb-8 border-b pb-4 border-gray-200 dark:border-gray-800">
           <button onClick={onBack} className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><ChevronLeft size={20}/></button>
           <h2 className="text-2xl font-bold flex items-center gap-3">
              <span className="w-4 h-4 rounded-full shadow-sm" style={{backgroundColor: tagConfig.color}}></span>
              {tag} Deep Dive
           </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
           {tagExpenses.map(t => (
              <div key={t.id} className="flex flex-col gap-3 p-4 rounded-xl border border-transparent hover:border-gray-200 dark:hover:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-all">
                 <div className="flex justify-between items-start">
                    <div>
                       <div className="font-bold text-lg">{t.reason || t.tag}</div>
                       <div className="text-xs opacity-60 flex items-center gap-2 mt-1">
                          <CalendarIcon size={12}/> {new Date(t.date).toLocaleDateString('en-GB', {weekday: 'short', day: '2-digit', month: 'long', year: 'numeric'})}
                       </div>
                    </div>
                    <div className="font-black text-xl" style={{color: tagConfig.color}}>₹{Number(t.amount).toLocaleString('en-IN')}</div>
                 </div>
                 <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{width: `${(t.amount/maxAmt)*100}%`, backgroundColor: tagConfig.color}} />
                 </div>
              </div>
           ))}
           {tagExpenses.length === 0 && <div className="opacity-50 text-center py-20 text-lg">No expenses found for this category.</div>}
        </div>
     </div>
  );
};

const DebtsView = ({ debts, addDebt, updateDebt, owedToMe, iOwe, cardClasses, dark }) => {
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('lent'); 
  const [reason, setReason] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    if (!person || !amount) return;
    addDebt({ person, amount: Number(amount), type, reason });
    setPerson(''); setAmount(''); setReason('');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`p-6 rounded-2xl border-l-4 border-l-emerald-500 ${cardClasses}`}>
          <div className="text-sm opacity-60 mb-1">Total People Owe Me</div>
          <div className="text-2xl font-bold text-emerald-500">₹{owedToMe.toLocaleString('en-IN')}</div>
        </div>
        <div className={`p-6 rounded-2xl border-l-4 border-l-rose-500 ${cardClasses}`}>
          <div className="text-sm opacity-60 mb-1">Total I Owe People</div>
          <div className="text-2xl font-bold text-rose-500">₹{iOwe.toLocaleString('en-IN')}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`p-6 rounded-2xl lg:col-span-1 ${cardClasses} h-fit`}>
          <h3 className="font-bold mb-4">Add IOU</h3>
          <form onSubmit={handleAdd} className="space-y-4">
             <div className="flex rounded-lg overflow-hidden border border-gray-700/30">
                <button type="button" onClick={() => setType('lent')} className={`flex-1 py-2 text-sm font-medium transition-colors ${type === 'lent' ? 'bg-emerald-500 text-white' : (dark ? 'bg-gray-800' : 'bg-gray-100')}`}>I Lent</button>
                <button type="button" onClick={() => setType('borrowed')} className={`flex-1 py-2 text-sm font-medium transition-colors ${type === 'borrowed' ? 'bg-rose-500 text-white' : (dark ? 'bg-gray-800' : 'bg-gray-100')}`}>I Borrowed</button>
              </div>
              <input type="text" value={person} onChange={e => setPerson(e.target.value)} placeholder="Person's Name" className={`w-full p-3 rounded-xl border ${dark ? 'bg-gray-950 border-gray-800 text-white' : 'bg-gray-50 border-gray-200'} outline-none`} required />
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount (₹)" className={`w-full p-3 rounded-xl border ${dark ? 'bg-gray-950 border-gray-800 text-white' : 'bg-gray-50 border-gray-200'} outline-none`} required />
              <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (e.g. Dinner split)" className={`w-full p-3 rounded-xl border ${dark ? 'bg-gray-950 border-gray-800 text-white' : 'bg-gray-50 border-gray-200'} outline-none`} />
              <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors">Record Debt</button>
          </form>
        </div>

        <div className={`p-6 rounded-2xl lg:col-span-2 ${cardClasses}`}>
          <h3 className="font-bold mb-4">Active Debts</h3>
          <div className="space-y-4">
            {debts.length === 0 && <div className="opacity-50 py-10 text-center">No active debts. You're all settled up!</div>}
            {debts.map(d => {
              const remaining = Number(d.amount) - Number(d.settledAmount);
              const isSettled = d.status === 'settled';
              return (
                <div key={d.id} className={`p-5 rounded-xl border ${dark ? 'border-gray-800 bg-gray-950/50' : 'border-gray-100 bg-gray-50/50'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-bold text-lg flex items-center gap-2">
                        {d.person} 
                        {isSettled && <CheckCircle2 size={16} className="text-emerald-500"/>}
                      </div>
                      <div className="text-sm opacity-60">{d.reason}</div>
                    </div>
                    <div className={`text-right ${d.type === 'lent' ? 'text-emerald-500' : 'text-rose-500'}`}>
                      <div className="font-bold text-lg">Total: ₹{d.amount}</div>
                      {!isSettled && <div className="text-sm font-medium opacity-80">Remaining: ₹{remaining}</div>}
                    </div>
                  </div>
                  
                  {!isSettled && (
                    <div className="mt-4 flex items-center gap-4">
                      <div className="flex-1 h-2.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 transition-all" style={{width: `${(d.settledAmount / d.amount) * 100}%`}}></div>
                      </div>
                      <div className="flex gap-2">
                         <button onClick={() => updateDebt(d.id, Number(d.settledAmount) + Math.min(100, remaining), d.amount)} className="px-3 py-1.5 text-xs font-bold bg-indigo-500/10 text-indigo-500 rounded-lg hover:bg-indigo-500/20 transition-colors">+₹100</button>
                         <button onClick={() => updateDebt(d.id, d.amount, d.amount)} className="px-3 py-1.5 text-xs font-bold bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20 transition-colors">Settle Full</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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

   const deleteTag = (id) => {
      updateSettings({ tags: settings.tags.filter(t => t.id !== id) });
   };

   return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
         <div className={`w-full max-w-md p-6 rounded-3xl shadow-2xl ${dark ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-xl">Manage Tags</h3>
               <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-500/20"><X size={20}/></button>
            </div>
            
            <div className="space-y-3 max-h-60 overflow-y-auto mb-6 pr-2">
               {settings.tags.map(t => (
                  <div key={t.id} className={`flex justify-between items-center p-3 rounded-xl border ${dark ? 'border-gray-800 bg-gray-950' : 'border-gray-100 bg-gray-50'}`}>
                     <span className="flex items-center gap-3 font-medium"><span className="w-4 h-4 rounded-full" style={{backgroundColor: t.color}}></span> {t.name}</span>
                     <button onClick={() => deleteTag(t.id)} className="text-rose-500 text-sm font-bold opacity-70 hover:opacity-100">Remove</button>
                  </div>
               ))}
            </div>

            <div className={`p-4 rounded-2xl border ${dark ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-gray-50'}`}>
               <h4 className="font-bold text-sm mb-3">Add New Tag</h4>
               <input type="text" value={newTagName} onChange={e=>setNewTagName(e.target.value)} placeholder="Tag Name" className={`w-full p-3 rounded-xl border mb-3 outline-none ${dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`} />
               <div className="flex flex-wrap gap-2 mb-4">
                  {PRESET_COLORS.map(c => (
                     <button key={c} onClick={() => setNewTagColor(c)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform ${newTagColor === c ? 'scale-125 ring-2 ring-offset-2 ring-gray-400' : ''}`} style={{backgroundColor: c}}></button>
                  ))}
               </div>
               <button onClick={addTag} className="w-full py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-xl">Create Tag</button>
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
         <div className={`w-full max-w-md p-6 rounded-3xl shadow-2xl ${dark ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-xl">Manage Quick Adds</h3>
               <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-500/20"><X size={20}/></button>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-6">
               {settings.quickAdds.map(qa => (
                  <div key={qa.id} className={`px-3 py-1.5 rounded-lg flex items-center gap-2 border ${dark ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'}`}>
                     <span className="text-sm font-medium">₹{qa.amount} {qa.tag}</span>
                     <button onClick={() => deleteQA(qa.id)} className="text-rose-500 ml-1"><X size={14}/></button>
                  </div>
               ))}
            </div>

            <div className={`p-4 rounded-2xl border ${dark ? 'border-gray-800 bg-gray-950' : 'border-gray-200 bg-gray-50'}`}>
               <h4 className="font-bold text-sm mb-3">New Quick Add</h4>
               <input type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="Amount" className={`w-full p-3 rounded-xl border mb-3 outline-none ${dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`} />
               <select value={tag} onChange={e=>setTag(e.target.value)} className={`w-full p-3 rounded-xl border mb-3 outline-none ${dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`}>
                  {settings.tags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
               </select>
               <input type="text" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Preset Reason (Optional)" className={`w-full p-3 rounded-xl border mb-4 outline-none ${dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'}`} />
               <button onClick={addQA} className="w-full py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-xl">Save Quick Add</button>
            </div>
         </div>
      </div>
   );
}

const ShareModal = ({ user, onClose, dark }) => {
   const [start, setStart] = useState('');
   const [end, setEnd] = useState('');
   const [link, setLink] = useState('');

   const generate = () => {
      if(!start || !end) return;
      // MODIFIED: Use query parameters and the actual user UID to prevent 404s
      const url = `${window.location.origin}/?share=${user.uid}&s=${start}&e=${end}`;
      setLink(url);
   }

   return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
         <div className={`w-full max-w-sm p-6 rounded-3xl shadow-2xl ${dark ? 'bg-gray-900 border border-gray-800 text-white' : 'bg-white text-gray-900'}`}>
            <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-xl">Share Time Period</h3>
               <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-500/20"><X size={20}/></button>
            </div>
            <div className="space-y-4">
               <div className="flex gap-4">
                  <div className="flex-1">
                     <label className="text-xs font-bold opacity-70 block mb-1">Start Date</label>
                     <input type="date" value={start} onChange={e=>setStart(e.target.value)} className={`w-full p-3 rounded-xl border ${dark ? 'bg-gray-950 border-gray-800' : 'bg-gray-50 border-gray-200'} outline-none focus:border-rose-500`} />
                  </div>
                  <div className="flex-1">
                     <label className="text-xs font-bold opacity-70 block mb-1">End Date</label>
                     <input type="date" value={end} onChange={e=>setEnd(e.target.value)} className={`w-full p-3 rounded-xl border ${dark ? 'bg-gray-950 border-gray-800' : 'bg-gray-50 border-gray-200'} outline-none focus:border-rose-500`} />
                  </div>
               </div>
               <button onClick={generate} className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold mt-2">Generate Shareable Link</button>
               {link && (
                  <div className="mt-4 p-4 rounded-xl bg-gray-500/10 break-all text-sm flex flex-col gap-2 border border-gray-500/20">
                     <span className="opacity-70 text-xs font-bold uppercase tracking-wider">Copy this link:</span>
                     <code className="text-rose-500 font-medium select-all">{link}</code>
                  </div>
               )}
            </div>
         </div>
      </div>
   )
}