import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownLeft, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight,
  BarChart3, Bell, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleHelp, Download, FileDown, Filter, Home, LogOut, Menu, MoreHorizontal,
  Plus, Search, Settings, ShieldCheck, Sparkles, Target, TrendingDown,
  TrendingUp, Wallet, X, Eye, EyeOff, Pencil, Trash2, CreditCard, Landmark,
  Coffee, Car, ShoppingBag, HeartPulse, GraduationCap, Briefcase, Plane,
  Gift, CircleDollarSign, Utensils, Smartphone, House, SlidersHorizontal
} from 'lucide-react';
import { isSupabaseConfigured, supabase, usernameEmail } from './lib/supabase';

const money = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n || 0));
const shortMoney = (n) => {
  const v = Number(n || 0);
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}k`;
  return money(v);
};
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;
const CATEGORIES = ['Food & dining', 'Transport', 'Shopping', 'Bills & utilities', 'Health', 'Education', 'Travel', 'Entertainment', 'Home', 'Salary', 'Freelance', 'Other'];
const categoryIcon = (category = '') => {
  const c = category.toLowerCase();
  if (c.includes('food') || c.includes('dining')) return Utensils;
  if (c.includes('transport')) return Car;
  if (c.includes('shop')) return ShoppingBag;
  if (c.includes('bill')) return Smartphone;
  if (c.includes('health')) return HeartPulse;
  if (c.includes('education')) return GraduationCap;
  if (c.includes('travel')) return Plane;
  if (c.includes('home')) return House;
  if (c.includes('salary') || c.includes('freelance')) return Briefcase;
  return CircleDollarSign;
};
const blankTransaction = { name: '', amount: '', type: 'expense', category: 'Food & dining', transaction_date: today(), note: '' };
const navItems = [
  { id: 'overview', label: 'Overview', icon: Home },
  { id: 'transactions', label: 'Transactions', icon: ArrowDownLeft },
  { id: 'budgets', label: 'Budgets', icon: SlidersHorizontal },
  { id: 'savings', label: 'Savings goals', icon: Target },
  { id: 'insights', label: 'Insights', icon: BarChart3 },
];

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('overview');
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [goal, setGoal] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [modal, setModal] = useState('');
  const [editing, setEditing] = useState(null);
  const [txForm, setTxForm] = useState(blankTransaction);
  const [budgetForm, setBudgetForm] = useState({ category: CATEGORIES[0], amount: '' });
  const [goalForm, setGoalForm] = useState({ name: '', target: '', saved: '0' });
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [toast, setToast] = useState('');
  const [mobileNav, setMobileNav] = useState(false);

  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(''), 2800); };

  const loadData = useCallback(async (userId) => {
    if (!supabase || !userId) return;
    const [tx, bg, sg, pr] = await Promise.all([
      supabase.from('transactions').select('*').order('transaction_date', { ascending: false }).limit(500),
      supabase.from('budgets').select('*').order('created_at', { ascending: false }),
      supabase.from('savings_goals').select('*').order('updated_at', { ascending: false }).limit(1),
      supabase.from('profiles').select('username').eq('id', userId).maybeSingle()
    ]);
    if (tx.error) notify('Could not load transactions.');
    else setTransactions(tx.data || []);
    if (!bg.error) setBudgets(bg.data || []);
    if (!sg.error) setGoal(sg.data?.[0] || null);
    if (!pr.error) setProfile(pr.data || null);
  }, []);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadData(data.session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next?.user) loadData(next.user.id);
      else { setProfile(null); setTransactions([]); setBudgets([]); setGoal(null); }
    });
    return () => listener.subscription.unsubscribe();
  }, [loadData]);

  const currentMonth = today().slice(0, 7);
  const monthTx = useMemo(() => transactions.filter(t => (t.transaction_date || '').slice(0, 7) === currentMonth), [transactions, currentMonth]);
  const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expenses = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const balance = income - expenses;
  const recent = transactions.slice(0, 5);

  const doAuth = async (e) => {
    e.preventDefault(); setAuthError('');
    const username = authForm.username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(username)) { setAuthError('Use 3–24 letters, numbers or underscores for your username.'); return; }
    if (authForm.password.length < 8) { setAuthError('Your password must be at least 8 characters.'); return; }
    setAuthBusy(true);
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.functions.invoke('register-username', { body: { username, password: authForm.password } });
        if (error) throw new Error(error.message || 'Could not create your account.');
        if (data?.error) throw new Error(data.error);
        const { error: loginError } = await supabase.auth.signInWithPassword({ email: usernameEmail(username), password: authForm.password });
        if (loginError) throw loginError;
        notify('Your Monograph is ready.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: usernameEmail(username), password: authForm.password });
        if (error) throw new Error('Username or password is incorrect.');
      }
    } catch (err) { setAuthError(err.message || 'Something went wrong. Please try again.'); }
    finally { setAuthBusy(false); }
  };

  const signOut = async () => { await supabase.auth.signOut(); setPage('overview'); };

  const saveTransaction = async (e) => {
    e.preventDefault();
    const payload = { ...txForm, amount: Number(txForm.amount), user_id: session.user.id, name: txForm.name.trim(), note: txForm.note.trim() };
    const result = editing
      ? await supabase.from('transactions').update(payload).eq('id', editing.id).select().single()
      : await supabase.from('transactions').insert(payload).select().single();
    if (result.error) { notify(result.error.message); return; }
    setTransactions(prev => editing ? prev.map(t => t.id === editing.id ? result.data : t).sort((a,b) => b.transaction_date.localeCompare(a.transaction_date)) : [result.data, ...prev].sort((a,b) => b.transaction_date.localeCompare(a.transaction_date)));
    setModal(''); setEditing(null); setTxForm(blankTransaction); notify(editing ? 'Transaction updated.' : 'Transaction added.');
  };

  const deleteTransaction = async (id) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) notify(error.message); else { setTransactions(prev => prev.filter(t => t.id !== id)); notify('Transaction deleted.'); }
  };

  const saveBudget = async (e) => {
    e.preventDefault();
    const payload = { user_id: session.user.id, category: budgetForm.category, amount: Number(budgetForm.amount), month: monthStart() };
    const { data, error } = await supabase.from('budgets').upsert(payload, { onConflict: 'user_id,category,month' }).select().single();
    if (error) { notify(error.message); return; }
    setBudgets(prev => [data, ...prev.filter(b => !(b.category === data.category && b.month === data.month))]);
    setModal(''); setBudgetForm({ category: CATEGORIES[0], amount: '' }); notify('Budget saved.');
  };

  const saveGoal = async (e) => {
    e.preventDefault();
    const payload = { user_id: session.user.id, name: goalForm.name.trim(), target: Number(goalForm.target), saved: Number(goalForm.saved || 0), updated_at: new Date().toISOString() };
    const result = goal
      ? await supabase.from('savings_goals').update(payload).eq('id', goal.id).select().single()
      : await supabase.from('savings_goals').insert(payload).select().single();
    if (result.error) { notify(result.error.message); return; }
    setGoal(result.data); setModal(''); notify('Savings goal updated.');
  };

  const openTransaction = (item = null) => {
    setEditing(item);
    setTxForm(item ? { name: item.name, amount: String(item.amount), type: item.type, category: item.category, transaction_date: item.transaction_date, note: item.note || '' } : blankTransaction);
    setModal('transaction');
  };

  const exportCSV = () => {
    const rows = [['Date','Name','Type','Category','Amount','Note'], ...transactions.map(t => [t.transaction_date,t.name,t.type,t.category,t.amount,t.note || ''])];
    const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'monograph-transactions.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const filteredTransactions = transactions.filter(t => {
    const matches = `${t.name} ${t.category} ${t.note || ''}`.toLowerCase().includes(search.toLowerCase());
    return matches && (filterType === 'all' || t.type === filterType);
  });

  if (loading) return <div className="loading-screen"><div className="brand-mark">M.</div><span>Preparing your space</span></div>;
  if (!session) return <AuthScreen mode={authMode} setMode={m => { setAuthMode(m); setAuthError(''); }} form={authForm} setForm={setAuthForm} onSubmit={doAuth} busy={authBusy} error={authError} showPassword={showPassword} setShowPassword={setShowPassword} configured={isSupabaseConfigured} />;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup"><div className="brand-mark">M.</div><div><div className="brand-name">MONOGRAPH</div><div className="brand-caption">PERSONAL FINANCE</div></div><button className="icon-btn mobile-close" onClick={() => setMobileNav(false)}><X size={18}/></button></div>
        <div className="side-label">WORKSPACE</div>
        <nav className="side-nav">{navItems.map(item => <button key={item.id} className={`nav-link ${page === item.id ? 'active' : ''}`} onClick={() => { setPage(item.id); setMobileNav(false); }}><item.icon size={18}/><span>{item.label}</span>{item.id === 'transactions' && <span className="nav-count">{transactions.length}</span>}</button>)}</nav>
        <div className="sidebar-bottom">
          <div className="privacy-card"><ShieldCheck size={17}/><div><strong>Your data stays yours.</strong><span>Private by design, protected by your account.</span></div></div>
          <button className={`nav-link ${page === 'settings' ? 'active' : ''}`} onClick={() => { setPage('settings'); setMobileNav(false); }}><Settings size={18}/><span>Settings</span></button>
          <div className="user-row"><div className="avatar">{(profile?.username || 'U').slice(0,1).toUpperCase()}</div><div className="user-meta"><strong>{profile?.username || 'Your account'}</strong><span>Personal workspace</span></div><button className="icon-btn" title="Sign out" onClick={signOut}><LogOut size={17}/></button></div>
        </div>
      </aside>
      {mobileNav && <div className="scrim" onClick={() => setMobileNav(false)} />}
      <main className="main-area">
        <header className="topbar"><div className="topbar-left"><button className="icon-btn menu-toggle" onClick={() => setMobileNav(true)}><Menu size={20}/></button><div className="breadcrumb">Workspace <ChevronRight size={14}/> <strong>{navItems.find(n => n.id === page)?.label || (page === 'settings' ? 'Settings' : 'Overview')}</strong></div></div><div className="topbar-right"><span className="date-chip"><CalendarDays size={15}/>{new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</span><button className="icon-btn" title="Export transactions" onClick={exportCSV}><Download size={18}/></button><div className="avatar small">{(profile?.username || 'U').slice(0,1).toUpperCase()}</div></div></header>
        <div className="page-content">
          {page === 'overview' && <Overview income={income} expenses={expenses} balance={balance} transactions={transactions} monthTx={monthTx} recent={recent} budgets={budgets} goal={goal} openTransaction={openTransaction} setPage={setPage} />}
          {page === 'transactions' && <Transactions items={filteredTransactions} search={search} setSearch={setSearch} filterType={filterType} setFilterType={setFilterType} openTransaction={openTransaction} deleteTransaction={deleteTransaction} />}
          {page === 'budgets' && <Budgets budgets={budgets} transactions={monthTx} onAdd={() => { setBudgetForm({category:CATEGORIES[0],amount:''}); setModal('budget'); }} />}
          {page === 'savings' && <Savings goal={goal} onEdit={() => { setGoalForm(goal ? {name:goal.name,target:String(goal.target),saved:String(goal.saved)} : {name:'',target:'',saved:'0'}); setModal('goal'); }} />}
          {page === 'insights' && <Insights transactions={transactions} monthTx={monthTx} />}
          {page === 'settings' && <SettingsPage username={profile?.username} exportCSV={exportCSV} signOut={signOut} />}
        </div>
      </main>
      {modal === 'transaction' && <Modal title={editing ? 'Edit transaction' : 'New transaction'} onClose={() => setModal('')}><form className="form-stack" onSubmit={saveTransaction}><div className="type-switch"><button type="button" className={txForm.type === 'expense' ? 'selected expense' : ''} onClick={() => setTxForm({...txForm,type:'expense'})}>Expense</button><button type="button" className={txForm.type === 'income' ? 'selected income' : ''} onClick={() => setTxForm({...txForm,type:'income'})}>Income</button></div><Field label="Description"><input required maxLength="120" placeholder="e.g. Coffee with friends" value={txForm.name} onChange={e=>setTxForm({...txForm,name:e.target.value})}/></Field><div className="form-grid"><Field label="Amount (₹)"><input required type="number" min="1" step="0.01" placeholder="0.00" value={txForm.amount} onChange={e=>setTxForm({...txForm,amount:e.target.value})}/></Field><Field label="Date"><input required type="date" value={txForm.transaction_date} onChange={e=>setTxForm({...txForm,transaction_date:e.target.value})}/></Field></div><Field label="Category"><select value={txForm.category} onChange={e=>setTxForm({...txForm,category:e.target.value})}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></Field><Field label="Note (optional)"><textarea rows="2" placeholder="Add a little context..." value={txForm.note} onChange={e=>setTxForm({...txForm,note:e.target.value})}/></Field><div className="modal-actions"><button type="button" className="btn-secondary" onClick={()=>setModal('')}>Cancel</button><button className="btn-primary" type="submit">Save transaction <ArrowRight size={16}/></button></div></form></Modal>}
      {modal === 'budget' && <Modal title="Set a monthly budget" onClose={() => setModal('')}><form className="form-stack" onSubmit={saveBudget}><Field label="Category"><select value={budgetForm.category} onChange={e=>setBudgetForm({...budgetForm,category:e.target.value})}>{CATEGORIES.filter(c=>!['Salary','Freelance'].includes(c)).map(c=><option key={c}>{c}</option>)}</select></Field><Field label="Monthly limit (₹)"><input required type="number" min="1" value={budgetForm.amount} onChange={e=>setBudgetForm({...budgetForm,amount:e.target.value})} placeholder="e.g. 8000"/></Field><div className="modal-actions"><button type="button" className="btn-secondary" onClick={()=>setModal('')}>Cancel</button><button className="btn-primary">Save budget <ArrowRight size={16}/></button></div></form></Modal>}
      {modal === 'goal' && <Modal title={goal ? 'Edit savings goal' : 'Create a savings goal'} onClose={() => setModal('')}><form className="form-stack" onSubmit={saveGoal}><Field label="What are you saving for?"><input required maxLength="80" value={goalForm.name} onChange={e=>setGoalForm({...goalForm,name:e.target.value})} placeholder="e.g. A little escape to the mountains"/></Field><div className="form-grid"><Field label="Target amount (₹)"><input required type="number" min="1" value={goalForm.target} onChange={e=>setGoalForm({...goalForm,target:e.target.value})} placeholder="50000"/></Field><Field label="Already saved (₹)"><input type="number" min="0" value={goalForm.saved} onChange={e=>setGoalForm({...goalForm,saved:e.target.value})}/></Field></div><div className="modal-actions"><button type="button" className="btn-secondary" onClick={()=>setModal('')}>Cancel</button><button className="btn-primary">Save goal <ArrowRight size={16}/></button></div></form></Modal>}
      {toast && <div className="toast"><Check size={16}/>{toast}</div>}
    </div>
  );
}

function AuthScreen({mode,setMode,form,setForm,onSubmit,busy,error,showPassword,setShowPassword,configured}) {
  return <div className="auth-layout"><div className="auth-left"><div className="auth-brand"><div className="brand-mark">M.</div><span>MONOGRAPH</span></div><div className="auth-copy"><div className="eyebrow light"><span/> A CLEARER VIEW OF YOUR MONEY</div><h1>Money, without<br/><em>the noise.</em></h1><p>A thoughtful space to understand where it goes, what matters, and what comes next.</p><div className="auth-visual"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit-core"><span>₹</span></div><div className="float-note note-a"><TrendingUp size={15}/> A little more clarity</div><div className="float-note note-b"><Target size={15}/> Your goals, in sight</div></div></div><div className="auth-foot"><span>PRIVATE BY DESIGN</span><span>YOUR FINANCIAL LIFE, IN FOCUS</span></div></div><div className="auth-right"><div className="auth-form-wrap"><div className="auth-mobile-brand"><div className="brand-mark">M.</div><span>MONOGRAPH</span></div><div className="eyebrow"><span/> YOUR PERSONAL MONEY SPACE</div><h2>{mode === 'login' ? 'Welcome back.' : 'Start with a clean slate.'}</h2><p className="auth-sub">{mode === 'login' ? 'Pick up where you left off.' : 'Create your private workspace in a moment.'}</p><form onSubmit={onSubmit} className="form-stack auth-form"><Field label="Username"><input autoComplete="username" required minLength="3" maxLength="24" placeholder="your_username" value={form.username} onChange={e=>setForm({...form,username:e.target.value.replace(/\s/g,'')})}/></Field><Field label="Password"><div className="password-wrap"><input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength="8" type={showPassword?'text':'password'} placeholder="At least 8 characters" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/><button type="button" className="password-toggle" onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></Field>{error && <div className="form-error">{error}</div>}<button disabled={busy || !configured} className="btn-primary auth-submit">{busy ? 'Please wait…' : mode === 'login' ? 'Enter your workspace' : 'Create my workspace'} <ArrowRight size={17}/></button></form>{!configured && <div className="setup-warning">The app is waiting for its Supabase environment variables. Add them in Vercel project settings to enable accounts.</div>}<div className="auth-switch">{mode === 'login' ? 'New to Monograph?' : 'Already have an account?'} <button onClick={()=>setMode(mode==='login'?'signup':'login')}>{mode==='login'?'Create an account':'Sign in'}</button></div><div className="auth-security"><ShieldCheck size={16}/><span>Your data is private to your account and protected by database-level access rules.</span></div><div className="auth-legal">By continuing, you agree to use MONOGRAPH responsibly. <span>© 2026 MONOGRAPH</span></div></div></div></div>;
}

function Field({label,children}) { return <label className="field"><span>{label}</span>{children}</label>; }
function Modal({title,onClose,children}) { return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal-card"><div className="modal-head"><div><div className="eyebrow">MONOGRAPH / WORKSPACE</div><h3>{title}</h3></div><button className="icon-btn" onClick={onClose}><X size={19}/></button></div>{children}</div></div>; }

function PageHeading({eyebrow,title,description,action}) { return <div className="page-heading"><div><div className="eyebrow"><span/>{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>; }
function MetricCard({label,value,caption,icon:Icon,tone='neutral',trend}) { return <div className="metric-card"><div className="metric-top"><span>{label}</span><div className={`metric-icon ${tone}`}><Icon size={18}/></div></div><div className="metric-value">{value}</div><div className="metric-caption">{trend && <span className={trend==='up'?'trend-up':'trend-down'}>{trend==='up'?<TrendingUp size={13}/>:<TrendingDown size={13}/>}</span>}{caption}</div></div>; }

function Overview({income,expenses,balance,transactions,monthTx,recent,budgets,goal,openTransaction,setPage}) {
  const max = Math.max(income,expenses,1);
  const spendByCategory = monthTx.filter(t=>t.type==='expense').reduce((a,t)=>({...a,[t.category]:(a[t.category]||0)+Number(t.amount)}),{});
  const topCategories = Object.entries(spendByCategory).sort((a,b)=>b[1]-a[1]).slice(0,4);
  const days = ['M','T','W','T','F','S','S'];
  const monthName = new Date().toLocaleDateString('en-IN',{month:'long',year:'numeric'});
  return <><PageHeading eyebrow="YOUR FINANCIAL SNAPSHOT" title="A little more in perspective." description={`Here's how your money is moving in ${monthName}.`} action={<button className="btn-primary" onClick={()=>openTransaction()}><Plus size={17}/> Add transaction</button>}/><div className="metrics-grid"><MetricCard label="Money in" value={money(income)} caption="Income this month" icon={ArrowDownLeft} tone="green" trend="up"/><MetricCard label="Money out" value={money(expenses)} caption="Expenses this month" icon={ArrowUpRight} tone="coral" trend="down"/><MetricCard label="Net cash flow" value={money(balance)} caption="Income minus expenses" icon={Activity} tone="blue"/><MetricCard label="All transactions" value={transactions.length} caption="Across your workspace" icon={Wallet} tone="violet"/></div><div className="overview-grid"><section className="panel cashflow-panel"><div className="panel-heading"><div><div className="eyebrow">THIS MONTH</div><h3>Cash flow</h3></div><span className="soft-chip">{monthName}</span></div><div className="cashflow-total"><strong>{money(balance)}</strong><span>Net movement</span></div><div className="flow-bars"><div className="flow-row"><div className="flow-label"><span className="dot green-dot"/>Income</div><div className="bar-track"><div className="bar-fill income-fill" style={{width:`${income/max*100}%`}}/></div><strong>{shortMoney(income)}</strong></div><div className="flow-row"><div className="flow-label"><span className="dot coral-dot"/>Expenses</div><div className="bar-track"><div className="bar-fill expense-fill" style={{width:`${expenses/max*100}%`}}/></div><strong>{shortMoney(expenses)}</strong></div></div><div className="panel-footnote"><Sparkles size={15}/> Small patterns become useful decisions.</div></section><section className="panel category-panel"><div className="panel-heading"><div><div className="eyebrow">WHERE IT GOES</div><h3>Top spending</h3></div><button className="text-link" onClick={()=>setPage('insights')}>See insights <ArrowRight size={14}/></button></div>{topCategories.length ? <div className="category-list">{topCategories.map(([name,value],i)=>{const Icon=categoryIcon(name);return <div className="category-row" key={name}><div className={`category-icon cat-${i}`}><Icon size={17}/></div><div className="category-info"><strong>{name}</strong><div className="mini-track"><span style={{width:`${value/Math.max(...topCategories.map(x=>x[1]))*100}%`}}/></div></div><strong>{shortMoney(value)}</strong></div>})}</div> : <EmptyMini text="Your spending patterns will appear here."/>}</section><section className="panel recent-panel"><div className="panel-heading"><div><div className="eyebrow">THE LATEST</div><h3>Recent activity</h3></div><button className="text-link" onClick={()=>setPage('transactions')}>All transactions <ArrowRight size={14}/></button></div>{recent.length ? <TransactionList items={recent.slice(0,4)} compact/> : <EmptyMini text="Your first transaction is a good place to begin."/>}</section><section className="panel goal-preview"><div className="panel-heading"><div><div className="eyebrow">A FUTURE YOU'RE BUILDING</div><h3>Savings goal</h3></div><Target size={19} className="muted-icon"/></div>{goal ? <><div className="goal-amount">{money(goal.saved)} <span>of {money(goal.target)}</span></div><div className="goal-track"><span style={{width:`${Math.min(100,goal.saved/goal.target*100)}%`}}/></div><div className="goal-foot"><span>{Math.round(goal.saved/goal.target*100)}% there</span><button className="text-link" onClick={()=>setPage('savings')}>View goal <ArrowRight size={14}/></button></div></> : <EmptyMini text="Give a future plan a number and a name." action={()=>setPage('savings')} actionLabel="Create a goal"/>}</section></div></>;
}

function TransactionList({items,compact=false,onEdit,onDelete}) {
  return <div className="transaction-list">{items.map(t=>{const Icon=categoryIcon(t.category);return <div className="transaction-row" key={t.id}><div className="transaction-icon"><Icon size={17}/></div><div className="transaction-info"><strong>{t.name}</strong><span>{t.category} <i/> {new Date(t.transaction_date+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span></div><strong className={t.type==='income'?'amount-positive':'amount-negative'}>{t.type==='income'?'+':'−'}{money(t.amount)}</strong>{!compact && <div className="row-actions"><button className="icon-btn" title="Edit" onClick={()=>onEdit(t)}><Pencil size={15}/></button><button className="icon-btn danger-hover" title="Delete" onClick={()=>onDelete(t.id)}><Trash2 size={15}/></button></div>}</div>})}</div>;
}

function Transactions({items,search,setSearch,filterType,setFilterType,openTransaction,deleteTransaction}) {
  return <><PageHeading eyebrow="YOUR MONEY, LINE BY LINE" title="Transactions." description="Every in and out, kept in one clear place." action={<button className="btn-primary" onClick={()=>openTransaction()}><Plus size={17}/> Add transaction</button>}/><div className="panel table-panel"><div className="table-toolbar"><div className="search-box"><Search size={17}/><input placeholder="Search transactions…" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button className="icon-btn" onClick={()=>setSearch('')}><X size={14}/></button>}</div><div className="filter-pills">{['all','income','expense'].map(v=><button key={v} className={filterType===v?'selected':''} onClick={()=>setFilterType(v)}>{v==='all'?'All':v[0].toUpperCase()+v.slice(1)}</button>)}</div></div>{items.length ? <><div className="table-header"><span>TRANSACTION</span><span>AMOUNT</span><span>ACTION</span></div><TransactionList items={items} onEdit={openTransaction} onDelete={deleteTransaction}/></> : <div className="empty-state"><div className="empty-icon"><Search size={22}/></div><h3>Nothing in this view.</h3><p>Try another search, or add a transaction to get started.</p></div>}</div></>;
}

function Budgets({budgets,transactions,onAdd}) {
  const expenses = transactions.filter(t=>t.type==='expense');
  const spentFor = category => expenses.filter(t=>t.category===category).reduce((s,t)=>s+Number(t.amount),0);
  const totalBudget = budgets.reduce((s,b)=>s+Number(b.amount),0);
  const totalSpent = budgets.reduce((s,b)=>s+spentFor(b.category),0);
  return <><PageHeading eyebrow="A PLAN FOR THE MONTH" title="Budgets." description="Set a gentle boundary for the things you spend on." action={<button className="btn-primary" onClick={onAdd}><Plus size={17}/> Add budget</button>}/><div className="budget-summary"><div><span>Planned this month</span><strong>{money(totalBudget)}</strong></div><div><span>Spent so far</span><strong>{money(totalSpent)}</strong></div><div><span>Still available</span><strong className={totalBudget-totalSpent<0?'amount-negative':''}>{money(totalBudget-totalSpent)}</strong></div></div>{budgets.length ? <div className="budget-grid">{budgets.map(b=>{const spent=spentFor(b.category),pct=Math.min(100,spent/Number(b.amount)*100),over=spent>Number(b.amount),Icon=categoryIcon(b.category);return <div className="panel budget-card" key={b.id}><div className="budget-card-top"><div className="category-icon"><Icon size={18}/></div><span className={over?'status-over':'status-ok'}>{over?'Over limit':'On track'}</span></div><h3>{b.category}</h3><div className="budget-numbers"><strong>{money(spent)}</strong><span>of {money(b.amount)}</span></div><div className="budget-track"><span className={over?'over-fill':''} style={{width:`${pct}%`}}/></div><div className="budget-card-foot"><span>{Math.round(pct)}% used</span><span>{money(Math.max(0,Number(b.amount)-spent))} left</span></div></div>})}</div> : <div className="panel empty-state"><div className="empty-icon"><SlidersHorizontal size={22}/></div><h3>Make room for what matters.</h3><p>Create a monthly budget for a category and keep your spending in view.</p><button className="btn-secondary" onClick={onAdd}><Plus size={16}/> Create first budget</button></div>}</>;
}

function Savings({goal,onEdit}) {
  const pct=goal?Math.min(100,Number(goal.saved)/Number(goal.target)*100):0;
  return <><PageHeading eyebrow="THE LONGER VIEW" title="Savings goals." description="Give something you're looking forward to a place to grow." action={<button className="btn-primary" onClick={onEdit}><Pencil size={16}/>{goal?'Edit goal':'Create a goal'}</button>}/>{goal?<div className="savings-layout"><div className="panel savings-card"><div className="eyebrow">YOUR CURRENT GOAL</div><div className="savings-illustration"><div className="savings-orb"><Target size={36}/></div><div className="spark spark-one"/><div className="spark spark-two"/><div className="spark spark-three"/></div><h2>{goal.name}</h2><p>Every small contribution moves the horizon closer.</p><div className="savings-progress"><div className="savings-progress-top"><strong>{money(goal.saved)}</strong><span>{money(goal.target)} target</span></div><div className="goal-track"><span style={{width:`${pct}%`}}/></div><div className="goal-foot"><span>{pct.toFixed(0)}% complete</span><span>{money(Math.max(0,goal.target-goal.saved))} to go</span></div></div></div><div className="panel savings-note"><div className="eyebrow">A SMALL REMINDER</div><h3>Progress is still progress, even when it is quiet.</h3><p>Update the amount saved whenever you make a contribution. Your goal is personal, and the pace is yours.</p><button className="btn-secondary" onClick={onEdit}><Pencil size={15}/> Update progress</button></div></div>:<div className="panel empty-state"><div className="empty-icon"><Target size={22}/></div><h3>What are you moving towards?</h3><p>A trip, a new laptop, a little breathing room. Give your goal a name and a target.</p><button className="btn-primary" onClick={onEdit}><Plus size={16}/> Create savings goal</button></div>}</>;
}

function Insights({transactions,monthTx}) {
  const byCategory=monthTx.filter(t=>t.type==='expense').reduce((a,t)=>({...a,[t.category]:(a[t.category]||0)+Number(t.amount)}),{});
  const cats=Object.entries(byCategory).sort((a,b)=>b[1]-a[1]);
  const income=monthTx.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const expense=monthTx.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
  const total= cats.reduce((s,x)=>s+x[1],0)||1;
  const average=transactions.length?transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0)/Math.max(1,transactions.filter(t=>t.type==='expense').length):0;
  return <><PageHeading eyebrow="PATTERNS, NOT PRESSURE" title="Insights." description="A few useful signals from the numbers you've collected."/><div className="metrics-grid insight-metrics"><MetricCard label="Income this month" value={money(income)} caption="Money received" icon={TrendingUp} tone="green"/><MetricCard label="Expenses this month" value={money(expense)} caption="Money spent" icon={TrendingDown} tone="coral"/><MetricCard label="Average expense" value={money(average)} caption="Per recorded expense" icon={Activity} tone="blue"/><MetricCard label="Savings rate" value={income?Math.max(0,((income-expense)/income)*100).toFixed(0)+'%':'—'} caption="Net income / income" icon={Target} tone="violet"/></div><div className="insights-grid"><div className="panel"><div className="eyebrow">SPENDING BREAKDOWN</div><h3>Where your money went</h3>{cats.length? <div className="insight-bars">{cats.map(([name,val],i)=><div className="insight-bar-row" key={name}><div><span>{name}</span><strong>{money(val)}</strong></div><div className="mini-track"><span style={{width:`${val/total*100}%`}}/></div></div>)}</div>:<EmptyMini text="Add a few expenses to reveal your spending mix."/>}</div><div className="panel insight-note"><div className="insight-note-icon"><Sparkles size={20}/></div><div className="eyebrow">A NOTE TO KEEP</div><h3>Awareness is a useful first step.</h3><p>Look for recurring patterns rather than judging individual purchases. The goal is to make choices with more context, not to make every choice smaller.</p></div></div></>;
}

function SettingsPage({username,exportCSV,signOut}) {
  return <><PageHeading eyebrow="YOUR SPACE, YOUR RULES" title="Settings." description="A few details about your personal workspace."/><div className="settings-grid"><section className="panel settings-card"><div className="settings-icon"><ShieldCheck size={20}/></div><div><div className="eyebrow">ACCOUNT</div><h3>{username || 'Your account'}</h3><p>Username-based sign-in. Your password is securely managed by Supabase Auth.</p></div></section><section className="panel settings-card"><div className="settings-icon"><FileDown size={20}/></div><div><div className="eyebrow">YOUR DATA</div><h3>Take your records with you.</h3><p>Download your transaction history as a CSV file for your own records.</p><button className="btn-secondary" onClick={exportCSV}><Download size={16}/> Export transactions</button></div></section><section className="panel settings-card"><div className="settings-icon"><LogOut size={20}/></div><div><div className="eyebrow">SESSION</div><h3>Finished for now?</h3><p>Sign out of this browser. Your records remain saved to your account.</p><button className="btn-secondary" onClick={signOut}>Sign out <ArrowRight size={15}/></button></div></section></div><div className="settings-footnote"><ShieldCheck size={16}/> MONOGRAPH uses database-level row security so each signed-in account can access only its own financial records.</div></>;
}

function EmptyMini({text,action,actionLabel}) { return <div className="empty-mini"><p>{text}</p>{action&&<button className="text-link" onClick={action}>{actionLabel} <ArrowRight size={14}/></button>}</div>; }

export default App;
