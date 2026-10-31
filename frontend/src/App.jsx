import React, { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import { 
  LayoutDashboard, Search, Settings, BookOpen, Building2, 
  FileText, Layers, Crown, Bookmark, History, User, FileSearch,
  Lock, LogIn, LogOut
} from 'lucide-react';
import { fetchCurrentUser, logoutUser } from './services/api';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authPrompt, setAuthPrompt] = useState(null);
  const [activeTab, setActiveTab] = useState('account'); // Default landing page is login / account
  const [resetKey, setResetKey] = useState(0);

  // Check auth session on startup
  useEffect(() => {
    let isMounted = true;
    const verifySession = async () => {
      try {
        const data = await fetchCurrentUser();
        if (!isMounted) return;
        if (data && data.is_authenticated && data.user) {
          setCurrentUser(data.user);
          setActiveTab('overview');
        } else {
          setCurrentUser(null);
          setActiveTab('account'); // Default landing page is login
        }
      } catch (err) {
        if (!isMounted) return;
        setCurrentUser(null);
        setActiveTab('account');
      } finally {
        if (isMounted) setAuthLoading(false);
      }
    };
    verifySession();
    return () => { isMounted = false; };
  }, []);

  const handleNav = (tab, label) => {
    if (!currentUser && tab !== 'account') {
      const featureName = label || tab.charAt(0).toUpperCase() + tab.slice(1);
      setAuthPrompt(`Please sign in first to access ${featureName}.`);
      setActiveTab('account');
      return;
    }
    setAuthPrompt(null);
    setActiveTab(tab);
    setResetKey((prev) => prev + 1);
  };

  const handleDirectLogout = async () => {
    if (!window.confirm('Are you sure you want to log out of your Finlytics AI session?')) return;
    try {
      await logoutUser();
    } finally {
      setCurrentUser(null);
      setAuthPrompt('You have been signed out successfully.');
      setActiveTab('account');
      setResetKey((prev) => prev + 1);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0A0F1C] flex flex-col items-center justify-center text-slate-400">
        <div className="w-12 h-12 bg-[#3B82F6] rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-blue-500/30 mb-4 animate-pulse">
          F
        </div>
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mb-3"></div>
        <p className="text-xs text-slate-400 tracking-wide font-medium">Initializing Finlytics AI...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0F1C] font-sans text-slate-50 selection:bg-blue-500/30">
      <header className="border-b border-slate-800/60 sticky top-0 z-10 bg-[#0A0F1C]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div 
            className="flex items-center gap-3 cursor-pointer flex-shrink-0" 
            onClick={() => handleNav(currentUser ? 'overview' : 'account', 'Dashboard')}
          >
            <div className="w-8 h-8 bg-[#3B82F6] rounded-md flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/20">F</div>
            <h1 className="text-xl font-bold text-white tracking-tight">Finlytics AI</h1>
          </div>

          <nav className="flex space-x-1 overflow-x-auto py-1 no-scrollbar">
            <button 
              onClick={() => handleNav('overview', 'Dashboard')}
              className={`flex items-center gap-2 text-sm px-3.5 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'overview' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
              {!currentUser && <Lock className="w-3 h-3 text-slate-500 ml-0.5" />}
            </button>
            <button 
              onClick={() => handleNav('watchlist', 'Watchlist')}
              className={`flex items-center gap-2 text-sm px-3.5 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'watchlist' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
              <Bookmark className="w-4 h-4" />
              <span>Watchlist</span>
              {!currentUser && <Lock className="w-3 h-3 text-slate-500 ml-0.5" />}
            </button>
            <button 
              onClick={() => handleNav('history', 'Research History')}
              className={`flex items-center gap-2 text-sm px-3.5 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'history' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
              <History className="w-4 h-4" />
              <span>History</span>
              {!currentUser && <Lock className="w-3 h-3 text-slate-500 ml-0.5" />}
            </button>
            <button 
              onClick={() => handleNav('single', 'Company Deep Dive')}
              className={`flex items-center gap-2 text-sm px-3.5 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'single' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
              <Search className="w-4 h-4" />
              <span>Company Deep Dive</span>
              {!currentUser && <Lock className="w-3 h-3 text-slate-500 ml-0.5" />}
            </button>
            <button 
              onClick={() => handleNav('qualitative', 'Qualitative Research')}
              className={`flex items-center gap-2 text-sm px-3.5 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'qualitative' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
              <FileSearch className="w-4 h-4" />
              <span>Qualitative Research</span>
              {!currentUser && <Lock className="w-3 h-3 text-slate-500 ml-0.5" />}
            </button>
            <button 
              onClick={() => handleNav('compare', 'Peer Comparison')}
              className={`flex items-center gap-2 text-sm px-3.5 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'compare' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
              <Settings className="w-4 h-4" />
              <span>Peer Comparison</span>
              {!currentUser && <Lock className="w-3 h-3 text-slate-500 ml-0.5" />}
            </button>
            <button 
              onClick={() => handleNav('report', 'Institutional Report')}
              className={`flex items-center gap-2 text-sm px-3.5 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'report' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
              <FileText className="w-4 h-4" />
              <span>Institutional Report</span>
              {!currentUser && <Lock className="w-3 h-3 text-slate-500 ml-0.5" />}
            </button>
            <button 
              onClick={() => handleNav('my-reports', 'My Reports')}
              className={`flex items-center gap-2 text-sm px-3.5 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'my-reports' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
              <Layers className="w-4 h-4" />
              <span>My Reports</span>
              {!currentUser && <Lock className="w-3 h-3 text-slate-500 ml-0.5" />}
            </button>
            <button 
              onClick={() => handleNav('directory', 'Directory')}
              className={`flex items-center gap-2 text-sm px-3.5 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'directory' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
              <Building2 className="w-4 h-4" />
              <span>Directory</span>
              {!currentUser && <Lock className="w-3 h-3 text-slate-500 ml-0.5" />}
            </button>
            <button 
              onClick={() => handleNav('config', 'Principles')}
              className={`flex items-center gap-2 text-sm px-3.5 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'config' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
              <BookOpen className="w-4 h-4" />
              <span>Principles</span>
              {!currentUser && <Lock className="w-3 h-3 text-slate-500 ml-0.5" />}
            </button>
          </nav>

          <div className="flex items-center gap-2.5 flex-shrink-0">
            {currentUser ? (
              <>
                <button
                  onClick={() => handleNav('subscription', 'Subscription')}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/10 cursor-pointer"
                >
                  <Crown className="w-3.5 h-3.5 fill-slate-950" />
                  Subscribe
                </button>
                <button
                  onClick={() => handleNav('account', 'Account')}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${
                    activeTab === 'account'
                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                      : 'bg-[#131B2F] text-slate-300 hover:text-white border-slate-700/80 hover:bg-slate-800'
                  }`}
                  title="Account Settings"
                >
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  <span className="font-semibold">{currentUser.username}</span>
                </button>
                <button
                  onClick={handleDirectLogout}
                  className="text-xs text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-950/40 border border-red-900/40 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <button
                onClick={() => handleNav('account', 'Sign In')}
                className={`flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-lg font-bold transition-all shadow-md cursor-pointer ${
                  activeTab === 'account'
                    ? 'bg-blue-600 text-white shadow-blue-500/30 ring-2 ring-blue-400/40'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/10'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>
      <main>
        <Dashboard 
          externalMode={activeTab} 
          setExternalMode={handleNav} 
          resetKey={resetKey}
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          authPrompt={authPrompt}
          setAuthPrompt={setAuthPrompt}
        />
      </main>
    </div>
  );
}

export default App;
