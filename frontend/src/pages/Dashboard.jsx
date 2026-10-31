import React, { useState, useEffect } from 'react';
import { 
    Search, Loader2, AlertCircle, Settings, Check, GitCompare, 
    Database, Calculator, CheckCircle, X, Building2, ArrowRight 
} from 'lucide-react';
import { analyzeCompany, fetchPrinciples, updatePrinciple, compareCompanies } from '../services/api';
import CompanyOverview from '../components/CompanyOverview';
import MetricGrid from '../components/MetricGrid';
import HistoricalCharts from '../components/HistoricalCharts';
import PrincipleEvaluations from '../components/PrincipleEvaluations';
import AISection from '../components/AISection';
import AskFinolitics from '../components/AskFinolitics';
import ComparisonView from '../components/ComparisonView';
import CompanyDirectory from '../components/CompanyDirectory';
import ResearchReport from '../components/ResearchReport';
import MyReports from '../components/MyReports';
import SubscriptionView from '../components/SubscriptionView';
import UserDashboard from '../components/UserDashboard';
import WatchlistView from '../components/WatchlistView';
import ResearchHistoryView from '../components/ResearchHistoryView';
import AccountSettingsView from '../components/AccountSettingsView';
import QualitativeResearchView from '../components/QualitativeResearchView';
import { resolveTicker, searchDirectory } from '../data/companyDirectory';

export default function Dashboard({ 
    externalMode, 
    setExternalMode, 
    resetKey, 
    currentUser, 
    setCurrentUser, 
    authPrompt, 
    setAuthPrompt 
}) {
    const [mode, setMode] = useState('single');
    const [ticker, setTicker] = useState('');
    const [data, setData] = useState(null);
    const [ticker1, setTicker1] = useState('');
    const [ticker2, setTicker2] = useState('');
    const [compareData, setCompareData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [principles, setPrinciples] = useState([]);
    const [showConfig, setShowConfig] = useState(false);
    const [saveStatus, setSaveStatus] = useState({});

    // Suggestions state for search inputs
    const [singleSuggestions, setSingleSuggestions] = useState([]);
    const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);

    useEffect(() => {
        fetchPrinciples().then(setPrinciples).catch(console.error);
    }, []);

    useEffect(() => {
        setError(null);
        if (externalMode === 'overview') {
            setData(null);
            setCompareData(null);
            setLoading(false);
            setShowConfig(false);
            setMode('single');
        } else if (externalMode === 'single') {
            setMode('single');
            setShowConfig(false);
        } else if (externalMode === 'compare') {
            setMode('compare');
            setShowConfig(false);
        } else if (externalMode === 'config') {
            setShowConfig(true);
        } else if (externalMode === 'directory') {
            setShowConfig(false);
        }
    }, [externalMode, resetKey]);

    const switchMode = (newMode) => {
        setMode(newMode);
        setError(null);
        if (setExternalMode) setExternalMode(newMode);
    };

    const handleResetToHome = () => {
        setData(null);
        setCompareData(null);
        setError(null);
        setLoading(false);
        setShowConfig(false);
        setMode('single');
        if (setExternalMode) setExternalMode('overview');
    };

    const handlePopularClick = (t) => {
        setError(null);
        if (mode === 'compare') {
            if (!ticker1 || (ticker1 && ticker2)) {
                setTicker1(t);
                setTicker2('');
            } else {
                setTicker2(t);
            }
        } else {
            setTicker(t);
        }
    };

    const handleTickerChange = (val) => {
        setTicker(val);
        if (val.trim().length >= 1) {
            const matches = searchDirectory(val).slice(0, 5);
            setSingleSuggestions(matches);
            setIsSuggestionsOpen(true);
        } else {
            setSingleSuggestions([]);
            setIsSuggestionsOpen(false);
        }
    };

    const handleSelectSuggestion = (item) => {
        setTicker(item.ticker);
        setIsSuggestionsOpen(false);
        handleAnalyze(null, item.ticker);
    };

    const handleSelectFromDirectory = (selectedTicker, targetMode = 'single') => {
        setError(null);
        setShowConfig(false);
        if (targetMode === 'single') {
            setMode('single');
            setTicker(selectedTicker);
            if (setExternalMode) setExternalMode('single');
            handleAnalyze(null, selectedTicker);
        } else {
            setMode('compare');
            if (setExternalMode) setExternalMode('compare');
            if (!ticker1 || (ticker1 && ticker2)) {
                setTicker1(selectedTicker);
                setTicker2('');
            } else {
                setTicker2(selectedTicker);
                handleAnalyze(null, ticker1, selectedTicker);
            }
        }
    };

    const handleAnalyze = async (e, customTicker1 = null, customTicker2 = null) => {
        if (e && e.preventDefault) e.preventDefault();
        setIsSuggestionsOpen(false);
        
        const rawT = customTicker1 !== null ? customTicker1 : (mode === 'single' ? ticker : ticker1);
        const rawT2 = customTicker2 !== null ? customTicker2 : ticker2;

        if (mode === 'single' && !rawT.trim()) return;
        if (mode === 'compare' && (!rawT.trim() || !rawT2.trim())) return;
        
        // Auto-resolve abbreviations and company names to official Yahoo Finance tickers
        // e.g. "Infosys" -> "INFY.NS", "tcs" -> "TCS.NS", "Apple" -> "AAPL"
        const cleanTicker = resolveTicker(rawT);
        const cleanT1 = resolveTicker(rawT);
        const cleanT2 = resolveTicker(rawT2);

        if (mode === 'single') {
            setTicker(cleanTicker);
        } else {
            setTicker1(cleanT1);
            setTicker2(cleanT2);
        }

        setLoading(true);
        setError(null);
        setShowConfig(false);
        if (setExternalMode) setExternalMode(mode);
        
        try {
            if (mode === 'single') {
                const result = await analyzeCompany(cleanTicker);
                setData(result);
                setCompareData(null);
            } else {
                const result = await compareCompanies([cleanT1, cleanT2]);
                setCompareData(result);
                setData(null);
            }
        } catch (err) {
            setError(err.message || 'An unexpected error occurred.');
            setData(null);
            setCompareData(null);
        } finally {
            setLoading(false);
        }
    };

    const handleThresholdChange = async (identifier, newThreshold) => {
        try {
            await updatePrinciple(identifier, newThreshold);
            setSaveStatus({ ...saveStatus, [identifier]: 'saved' });
            setTimeout(() => setSaveStatus({ ...saveStatus, [identifier]: null }), 2000);
            
            const updated = await fetchPrinciples();
            setPrinciples(updated);
            
            if (mode === 'single' && data) {
                setLoading(true);
                const result = await analyzeCompany(data.company_data.profile.ticker);
                setData(result);
                setLoading(false);
            } else if (mode === 'compare' && compareData) {
                setLoading(true);
                const result = await compareCompanies([ticker1.trim(), ticker2.trim()]);
                setCompareData(result);
                setLoading(false);
            }
        } catch (err) {
            console.error('Failed to update threshold', err);
        }
    };

    const hasResults = Boolean(data || compareData);
    const showHero = !hasResults && !loading;

    // Default to login / account view if user is unauthenticated or explicitly visiting account
    if (externalMode === 'account' || !currentUser) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in">
                <AccountSettingsView 
                    onNavigate={(tab) => setExternalMode && setExternalMode(tab)}
                    onLogoutSuccess={() => {
                        if (setCurrentUser) setCurrentUser(null);
                        if (setAuthPrompt) setAuthPrompt('You have been signed out.');
                        if (setExternalMode) setExternalMode('account');
                    }}
                    onLoginSuccess={(user) => {
                        if (setCurrentUser) setCurrentUser(user);
                        if (setAuthPrompt) setAuthPrompt(null);
                        if (setExternalMode) setExternalMode('overview');
                    }}
                    authPrompt={authPrompt || (!currentUser && externalMode !== 'account' ? 'Please sign in or create an analyst account to access this feature.' : null)}
                    onClearAuthPrompt={() => setAuthPrompt && setAuthPrompt(null)}
                />
            </div>
        );
    }

    if (externalMode === 'overview' || externalMode === 'dashboard') {
        return (
            <UserDashboard 
                onNavigate={(tab) => setExternalMode && setExternalMode(tab)}
                onSelectTicker={(t) => handleSelectFromDirectory(t, 'single')}
                onOpenReport={(reportId) => {
                    if (setExternalMode) setExternalMode('my-reports');
                }}
            />
        );
    }

    if (externalMode === 'watchlist') {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in">
                <WatchlistView 
                    onSelectTicker={(t) => handleSelectFromDirectory(t, 'single')}
                    onNavigate={(tab) => setExternalMode && setExternalMode(tab)}
                    onGenerateReport={(t) => {
                        setTicker(t);
                        if (setExternalMode) setExternalMode('report');
                    }}
                />
            </div>
        );
    }

    if (externalMode === 'history') {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in">
                <ResearchHistoryView 
                    onSelectTicker={(t) => handleSelectFromDirectory(t, 'single')}
                    onNavigate={(tab) => setExternalMode && setExternalMode(tab)}
                />
            </div>
        );
    }


    if (externalMode === 'directory') {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in">
                <CompanyDirectory onSelectTicker={handleSelectFromDirectory} />
            </div>
        );
    }

    if (externalMode === 'subscription') {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in">
                <SubscriptionView 
                    onBack={() => setExternalMode && setExternalMode('report')} 
                    onNavigateGenerate={() => setExternalMode && setExternalMode('report')} 
                />
            </div>
        );
    }

    if (externalMode === 'my-reports') {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in">
                <MyReports 
                    onSelectReport={(reportId) => {
                        if (setExternalMode) setExternalMode('report');
                    }}
                    onNavigateGenerate={() => setExternalMode && setExternalMode('report')}
                />
            </div>
        );
    }

    if (externalMode === 'qualitative') {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in">
                <QualitativeResearchView 
                    initialTicker={ticker || 'LT'}
                    onSelectTicker={(t) => {
                        setTicker(t);
                        if (setExternalMode) setExternalMode('single');
                    }}
                    onNavigateReport={(t) => {
                        setTicker(t);
                        if (setExternalMode) setExternalMode('report');
                    }}
                    onNavigate={(tab) => setExternalMode && setExternalMode(tab)}
                />
            </div>
        );
    }

    if (externalMode === 'report') {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in">
                <ResearchReport initialTicker={ticker || 'TCS'} onNavigateSubscription={() => setExternalMode && setExternalMode('subscription')} />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* HERO / INITIAL SEARCH VIEW */}
            {showHero && (
                <div className="text-center py-12 px-4">
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-[#C3D2FB] mb-6 tracking-tight max-w-4xl mx-auto leading-tight">
                        {mode === 'compare' ? (
                            <>Compare companies with<br/>institutional precision &<br/>zero hallucination.</>
                        ) : (
                            <>Turn financial data into<br/>understandable investment<br/>research.</>
                        )}
                    </h1>
                    <p className="text-[#8B9CC3] text-base sm:text-lg max-w-3xl mx-auto mb-8">
                        {mode === 'compare'
                            ? "Evaluate two stocks head-to-head on financial metrics, derived growth ratios, and institutional rules."
                            : "Evaluate real statements from Yfinance against institutional principles with complete calculation transparency."}
                    </p>

                    <div className="flex justify-center gap-2 mb-6">
                        <button
                            onClick={() => switchMode('single')}
                            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${mode === 'single' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800'}`}
                        >
                            Single Analysis
                        </button>
                        <button
                            onClick={() => switchMode('compare')}
                            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center ${mode === 'compare' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800'}`}
                        >
                            <GitCompare className="h-4 w-4 mr-2" />
                            Compare Companies
                        </button>
                    </div>

                    {/* ERROR BANNER ON INITIAL / SEARCH VIEW */}
                    {error && (
                        <div className="max-w-2xl mx-auto mb-6 rounded-xl bg-red-950/40 p-4 border border-red-800/60 flex items-start justify-between shadow-lg text-left animate-in fade-in">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <h4 className="text-sm font-bold text-red-300">Analysis Error</h4>
                                    <p className="mt-0.5 text-sm text-red-200/80 leading-relaxed">{error}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                                <button 
                                    onClick={() => setError(null)}
                                    className="text-red-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-md bg-red-900/50 hover:bg-red-800/60 border border-red-700/60 transition-colors"
                                >
                                    Dismiss
                                </button>
                                <button 
                                    onClick={handleResetToHome}
                                    className="text-slate-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                                >
                                    Reset
                                </button>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleAnalyze} className="max-w-2xl mx-auto mb-8 relative">
                        {mode === 'single' ? (
                            <div className="relative">
                                <div className="relative flex items-center bg-[#131B2F] border border-[#2A344A] rounded-xl shadow-lg p-1.5 focus-within:border-blue-500 transition-colors">
                                    <div className="pl-3.5 text-slate-400">
                                        <Search className="h-5 w-5" />
                                    </div>
                                    <input
                                        type="text"
                                        value={ticker}
                                        onChange={(e) => handleTickerChange(e.target.value)}
                                        onFocus={() => { if (ticker.trim().length >= 1) setIsSuggestionsOpen(true); }}
                                        onBlur={() => setTimeout(() => setIsSuggestionsOpen(false), 250)}
                                        placeholder="Enter company name or ticker (e.g. Infosys, TCS, Apple, NVDA)"
                                        className="w-full bg-transparent border-none text-white px-4 py-3 focus:outline-none focus:ring-0 placeholder-slate-500 font-medium text-sm sm:text-base"
                                        disabled={loading}
                                    />
                                    <button
                                        type="submit"
                                        disabled={loading || !ticker.trim()}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap shadow-md disabled:opacity-50"
                                    >
                                        Analyze Company →
                                    </button>
                                </div>

                                {/* Auto-suggest dropdown */}
                                {isSuggestionsOpen && singleSuggestions.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-[#131B2F] border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 text-left">
                                        <div className="px-3.5 py-2 bg-[#0A0F1C] border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex justify-between items-center">
                                            <span>Matching Listed Companies</span>
                                            <span className="text-blue-400">Click to Select</span>
                                        </div>
                                        <div className="divide-y divide-slate-800/60 max-h-64 overflow-y-auto">
                                            {singleSuggestions.map((item) => (
                                                <div
                                                    key={item.ticker}
                                                    onMouseDown={() => handleSelectSuggestion(item)}
                                                    className="p-3 hover:bg-blue-600/10 cursor-pointer flex items-center justify-between transition-colors group"
                                                >
                                                    <div>
                                                        <div className="text-sm font-semibold text-white group-hover:text-blue-400">
                                                            {item.name}
                                                        </div>
                                                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                                                            <span>{item.exchange} • {item.country}</span>
                                                            <span>•</span>
                                                            <span className="text-slate-300">{item.sector}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <code className="text-xs font-mono font-bold text-blue-400 bg-[#0A0F1C] px-2 py-1 rounded border border-blue-500/30">
                                                            {item.ticker}
                                                        </code>
                                                        <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col sm:flex-row items-center gap-3 bg-[#131B2F] border border-[#2A344A] rounded-xl p-2 shadow-lg">
                                <input
                                    type="text"
                                    value={ticker1}
                                    onChange={(e) => setTicker1(e.target.value)}
                                    placeholder="Company 1 (e.g. TCS or TCS.NS)"
                                    className="w-full sm:w-1/2 bg-[#0A0F1C] border border-slate-700/80 rounded-lg text-white px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-500 font-medium"
                                    disabled={loading}
                                />
                                <span className="text-slate-400 font-bold text-xs uppercase px-1">VS</span>
                                <input
                                    type="text"
                                    value={ticker2}
                                    onChange={(e) => setTicker2(e.target.value)}
                                    placeholder="Company 2 (e.g. Infosys or INFY.NS)"
                                    className="w-full sm:w-1/2 bg-[#0A0F1C] border border-slate-700/80 rounded-lg text-white px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-500 font-medium"
                                    disabled={loading}
                                />
                                <button
                                    type="submit"
                                    disabled={loading || !ticker1.trim() || !ticker2.trim()}
                                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors whitespace-nowrap shadow-md disabled:opacity-50"
                                >
                                    Compare →
                                </button>
                            </div>
                        )}
                    </form>

                    <div className="flex flex-col items-center justify-center gap-3 text-sm">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            <span className="text-[#64748B]">Popular:</span>
                            {['AAPL', 'MSFT', 'NVDA', 'TCS.NS', 'RELIANCE.NS', 'INFY.NS'].map(t => (
                                <button 
                                    key={t} 
                                    onClick={() => handlePopularClick(t)} 
                                    className="bg-[#111827]/80 border border-[#1F2937] hover:bg-[#1F2937] text-slate-300 px-3.5 py-1.5 rounded-md transition-colors text-xs font-medium"
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                        <button 
                            onClick={() => { if (setExternalMode) setExternalMode('directory'); }}
                            className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 px-3.5 py-1.5 rounded-lg font-semibold transition-colors mt-1"
                        >
                            <Building2 className="w-3.5 h-3.5" />
                            Browse All Listed Companies & Abbreviations Directory →
                        </button>
                    </div>
                </div>
            )}

            {/* COMPACT TOP SEARCH BAR (VISIBLE WHEN RESULTS ARE DISPLAYED) */}
            {hasResults && !loading && (
                <div className="mb-6 bg-[#131B2F] p-5 rounded-xl shadow-sm border border-slate-800">
                    <div className="flex flex-col sm:flex-row gap-4 mb-5">
                        <div className="flex gap-2">
                            <button 
                                onClick={() => switchMode('single')} 
                                className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${mode === 'single' ? 'bg-blue-600 text-white shadow' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'}`}
                            >
                                Single Analysis
                            </button>
                            <button 
                                onClick={() => switchMode('compare')} 
                                className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center ${mode === 'compare' ? 'bg-blue-600 text-white shadow' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'}`}
                            >
                                <GitCompare className="h-4 w-4 mr-2" />
                                Compare Companies
                            </button>
                        </div>
                        <div className="flex-1"></div>
                        <button 
                            onClick={() => { if (setExternalMode) setExternalMode('directory'); }}
                            className="inline-flex items-center px-4 py-2 border text-sm font-semibold rounded-lg bg-[#1A233A] text-slate-300 border-slate-700 hover:bg-slate-800 transition-all mr-2"
                        >
                            <Building2 className="h-4 w-4 mr-2 text-blue-400" />
                            Company Directory
                        </button>
                        <button 
                            onClick={() => { setShowConfig(!showConfig); if (setExternalMode) setExternalMode(!showConfig ? 'config' : mode); }}
                            className={`inline-flex items-center px-5 py-2 border text-sm font-semibold rounded-lg transition-all ${showConfig ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-[#1A233A] text-slate-300 border-slate-700 hover:bg-slate-800'}`}
                        >
                            <Settings className="h-4 w-4 mr-2" />
                            Configure Criteria
                        </button>
                    </div>

                    <form onSubmit={handleAnalyze} className="flex flex-col sm:flex-row gap-4 relative">
                        {mode === 'single' ? (
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Search className="h-5 w-5 text-slate-500" />
                                </div>
                                <input
                                    type="text"
                                    value={ticker}
                                    onChange={(e) => handleTickerChange(e.target.value)}
                                    onFocus={() => { if (ticker.trim().length >= 1) setIsSuggestionsOpen(true); }}
                                    onBlur={() => setTimeout(() => setIsSuggestionsOpen(false), 250)}
                                    placeholder="Enter company name or ticker (e.g. Infosys, TCS, AAPL)"
                                    className="block w-full pl-11 pr-4 py-3 bg-[#0A0F1C] border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-white shadow-inner outline-none transition-shadow font-medium"
                                    disabled={loading}
                                />
                                {isSuggestionsOpen && singleSuggestions.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-[#131B2F] border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 text-left">
                                        <div className="divide-y divide-slate-800/60 max-h-60 overflow-y-auto">
                                            {singleSuggestions.map((item) => (
                                                <div
                                                    key={item.ticker}
                                                    onMouseDown={() => handleSelectSuggestion(item)}
                                                    className="p-3 hover:bg-blue-600/10 cursor-pointer flex items-center justify-between transition-colors group"
                                                >
                                                    <div>
                                                        <div className="text-sm font-semibold text-white group-hover:text-blue-400">
                                                            {item.name}
                                                        </div>
                                                        <div className="text-xs text-slate-400">
                                                            {item.exchange} • {item.sector}
                                                        </div>
                                                    </div>
                                                    <code className="text-xs font-mono font-bold text-blue-400 bg-[#0A0F1C] px-2 py-1 rounded border border-blue-500/30">
                                                        {item.ticker}
                                                    </code>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-1 gap-4">
                                <input
                                    type="text"
                                    value={ticker1}
                                    onChange={(e) => setTicker1(e.target.value)}
                                    placeholder="Company 1 (e.g. TCS or TCS.NS)"
                                    className="block w-1/2 px-4 py-3 bg-[#0A0F1C] border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-white shadow-inner outline-none transition-shadow font-medium"
                                    disabled={loading}
                                />
                                <input
                                    type="text"
                                    value={ticker2}
                                    onChange={(e) => setTicker2(e.target.value)}
                                    placeholder="Company 2 (e.g. Infosys or INFY.NS)"
                                    className="block w-1/2 px-4 py-3 bg-[#0A0F1C] border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-white shadow-inner outline-none transition-shadow font-medium"
                                    disabled={loading}
                                />
                            </div>
                        )}
                        
                        <button
                            type="submit"
                            disabled={loading || (mode === 'single' ? !ticker.trim() : (!ticker1.trim() || !ticker2.trim()))}
                            className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-semibold rounded-lg shadow text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all min-w-[140px]"
                        >
                            {loading ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : null}
                            {mode === 'single' ? 'Analyze' : 'Compare'}
                        </button>
                    </form>
                </div>
            )}

            {/* ERROR BANNER WHEN RESULTS WERE ACTIVE */}
            {hasResults && error && (
                <div className="rounded-xl bg-red-950/40 p-4 mb-6 border border-red-800/60 flex items-start justify-between shadow-lg animate-in fade-in">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                        <div>
                            <h4 className="text-sm font-bold text-red-300">Analysis Error</h4>
                            <p className="mt-0.5 text-sm text-red-200/80 leading-relaxed">{error}</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setError(null)}
                        className="text-red-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-md bg-red-900/50 hover:bg-red-800/60 border border-red-700/60 transition-colors ml-4"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* PRINCIPLES CONFIGURATION PANEL */}
            {showConfig && (
                <div className="mb-8 bg-[#131B2F] p-6 rounded-xl shadow-inner border border-slate-800 animate-in slide-in-from-top-2">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-bold text-white">Investment Principle Thresholds</h3>
                        <button
                            onClick={() => { setShowConfig(false); if (setExternalMode) setExternalMode(mode); }}
                            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                            title="Close settings"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <p className="text-sm text-slate-400 mb-6 max-w-3xl leading-relaxed">
                        Adjusting these mathematical thresholds auto-saves to the database. The system will instantly recalculate raw financial metrics and re-evaluate qualitative theses.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {principles.map(p => (
                            <div key={p.identifier} className="bg-[#0A0F1C] p-4 rounded-lg shadow-sm border border-slate-800 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-shadow">
                                <label className="block text-sm font-semibold text-slate-300 mb-2">{p.name}</label>
                                <div className="flex items-center gap-3">
                                    <span className="text-slate-400 font-mono text-sm bg-[#131B2F] px-2 py-1 rounded">{p.metric} {p.operator}</span>
                                    <input 
                                        type="number"
                                        step="0.01"
                                        defaultValue={p.threshold}
                                        onBlur={(e) => handleThresholdChange(p.identifier, e.target.value)}
                                        className="block w-full bg-transparent border-b border-slate-700 py-1 focus:border-blue-500 text-white outline-none sm:text-sm font-medium"
                                    />
                                    {saveStatus[p.identifier] === 'saved' && <Check className="h-5 w-5 text-emerald-500 animate-in zoom-in" />}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* DYNAMIC LOADING SCREEN */}
            {loading && (
                <div className="max-w-3xl mx-auto mt-12 bg-[#131B2F] border border-slate-800/60 rounded-2xl p-12 text-center shadow-2xl animate-in fade-in">
                    <div className="relative w-20 h-20 mx-auto mb-6">
                        <div className="absolute inset-0 border-4 border-[#1C2C4F] rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-t-[#3B82F6] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">
                        {mode === 'compare'
                            ? `Comparing ${(ticker1.trim() || 'Company 1').toUpperCase()} vs ${(ticker2.trim() || 'Company 2').toUpperCase()}...`
                            : `Analyzing ${(ticker.trim() || 'Company').toUpperCase()}...`}
                    </h3>
                    <p className="text-[#8B9CC3] mb-10 max-w-lg mx-auto text-sm leading-relaxed">
                        {mode === 'compare'
                            ? `Gathering official statements for ${(ticker1.trim() || 'Company 1').toUpperCase()} and ${(ticker2.trim() || 'Company 2').toUpperCase()} via Yfinance, computing comparative metrics, and evaluating principle rules.`
                            : `Gathering official statements for ${(ticker.trim() || 'Company').toUpperCase()} via Yfinance, computing derived metrics, and testing against configured principles.`}
                    </p>
                    <div className="flex flex-wrap justify-center gap-4 text-xs font-medium">
                        <div className="flex items-center gap-2 bg-[#0A0F1C] border border-slate-800 text-slate-300 px-4 py-2.5 rounded-lg">
                           <Database className="w-4 h-4 text-[#3B82F6]"/> Yfinance Statements
                        </div>
                        <div className="flex items-center gap-2 bg-[#0A0F1C] border border-slate-800 text-slate-300 px-4 py-2.5 rounded-lg">
                           <Calculator className="w-4 h-4 text-[#10B981]"/> Metric Engine
                        </div>
                        <div className="flex items-center gap-2 bg-[#0A0F1C] border border-slate-800 text-slate-300 px-4 py-2.5 rounded-lg">
                           <CheckCircle className="w-4 h-4 text-[#A855F7]"/> Principle Rules
                        </div>
                    </div>
                </div>
            )}

            {/* SINGLE ANALYSIS RESULTS */}
            {mode === 'single' && data && !loading && (
                <div className="space-y-8 transition-all duration-300 animate-in fade-in">
                    <CompanyOverview profile={data.company_data?.profile} />
                    <MetricGrid metrics={data.metrics} />
                    <HistoricalCharts historicalData={data.metrics?.historical_data} priceData={data.company_data?.historical_prices} />
                    <PrincipleEvaluations evaluation={data.evaluation} />
                    <AISection aiReport={data.ai_report} />

                    {/* Bridge to Qualitative Research */}
                    <div className="bg-gradient-to-r from-blue-900/20 via-[#131B2F] to-slate-900/40 border border-blue-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
                        <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
                                <Building2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                    Want to analyze {data.company_data?.profile?.name || ticker}'s annual reports & competitive moats?
                                </h4>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Ingest 10-K / Annual Reports to unlock pricing power analysis, client concentration, and MD&A citations.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                if (setExternalMode) setExternalMode('qualitative');
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-colors whitespace-nowrap shadow-md cursor-pointer self-stretch sm:self-auto justify-center"
                        >
                            <span>Open Qualitative Research</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                    <AskFinolitics 
                        context={data} 
                        ticker={ticker}
                        onNavigateQualitative={() => {
                            if (setExternalMode) setExternalMode('qualitative');
                        }}
                    />
                </div>
            )}

            {/* PEER COMPARISON RESULTS */}
            {mode === 'compare' && compareData && !loading && (
                <div className="transition-all duration-300 animate-in fade-in">
                    <ComparisonView data={compareData} />
                </div>
            )}
        </div>
    );
}
