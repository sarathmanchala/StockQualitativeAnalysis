import React, { useState, useEffect } from 'react';
import { 
    User, Mail, Calendar, ShieldCheck, Crown, LogOut, CheckCircle, 
    AlertCircle, Key, RefreshCw, ArrowRight, Lock, Check, Eye, EyeOff, UserPlus, LogIn 
} from 'lucide-react';
import { fetchCurrentUser, logoutUser, loginUser, registerUser } from '../services/api';

export default function AccountSettingsView({ onNavigate, onLogoutSuccess, onLoginSuccess, authPrompt, onClearAuthPrompt }) {
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Auth Mode: 'signin' or 'signup'
    const [authMode, setAuthMode] = useState('signin');

    // Login Form State
    const [loginUsername, setLoginUsername] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [loginLoading, setLoginLoading] = useState(false);
    const [loginError, setLoginError] = useState(null);
    const [loginSuccess, setLoginSuccess] = useState(false);

    // Sign Up Form State
    const [registerUsername, setRegisterUsername] = useState('');
    const [registerPassword, setRegisterPassword] = useState('');
    const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
    const [showRegisterPassword, setShowRegisterPassword] = useState(false);
    const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);
    const [registerLoading, setRegisterLoading] = useState(false);
    const [registerError, setRegisterError] = useState(null);
    const [registerSuccessMessage, setRegisterSuccessMessage] = useState(null);

    const loadUser = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchCurrentUser();
            setUserData(data);
            if (data && data.is_authenticated && data.user && onLoginSuccess) {
                onLoginSuccess(data.user);
            }
        } catch (err) {
            console.error('Failed to load user info:', err);
            setError(err.message || 'Unable to load account information.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUser();
    }, []);

    const handleLogout = async () => {
        if (!window.confirm('Are you sure you want to log out of your Finlytics AI session?')) return;
        try {
            await logoutUser();
            setUserData({ is_authenticated: false, user: null });
            if (onLogoutSuccess) onLogoutSuccess();
            else if (onNavigate) onNavigate('overview');
        } catch (err) {
            alert(`Logout failed: ${err.message}`);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginLoading(true);
        setLoginError(null);
        try {
            const res = await loginUser(loginUsername, loginPassword);
            setLoginSuccess(true);
            setTimeout(() => {
                setLoginSuccess(false);
                loadUser();
                if (onLoginSuccess) {
                    onLoginSuccess(res.user || { username: loginUsername });
                }
            }, 400);
        } catch (err) {
            setLoginError(err.message || 'Login failed. Check credentials.');
        } finally {
            setLoginLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setRegisterError(null);
        setRegisterSuccessMessage(null);

        // Client-side validations
        const cleanUser = registerUsername.trim();
        if (cleanUser.length < 3) {
            setRegisterError('Username must be at least 3 characters long.');
            return;
        }
        if (registerPassword.length < 6) {
            setRegisterError('Password must be at least 6 characters long.');
            return;
        }
        if (registerPassword !== registerConfirmPassword) {
            setRegisterError('Passwords do not match. Please verify your confirmation password.');
            return;
        }

        setRegisterLoading(true);
        try {
            const res = await registerUser(cleanUser, registerPassword, registerConfirmPassword);
            setRegisterSuccessMessage(
                res.message || `Account for "${cleanUser}" created successfully! Please sign in with your credentials.`
            );
            // Pre-fill username for Sign In and clear password fields
            setLoginUsername(cleanUser);
            setRegisterPassword('');
            setRegisterConfirmPassword('');
            setAuthMode('signin');
        } catch (err) {
            setRegisterError(err.message || 'Registration failed. Please choose another username.');
        } finally {
            setRegisterLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-16 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-3"></div>
                <p className="text-slate-400 text-sm">Loading account details...</p>
            </div>
        );
    }

    const { is_authenticated, user, subscription } = userData || {};

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in">
            {/* HEADER */}
            <div className="border-b border-slate-800 pb-5">
                <div className="flex items-center gap-2 mb-1">
                    <User className="w-6 h-6 text-blue-400" />
                    <h1 className="text-2xl font-bold text-white tracking-tight">Account & Security Settings</h1>
                </div>
                <p className="text-slate-400 text-sm">
                    Manage your analyst profile, inspect subscription entitlement, and control session authentication.
                </p>
            </div>

            {/* ERROR */}
            {error && (
                <div className="bg-red-950/40 border border-red-800/80 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                        <p className="text-sm text-red-200">{error}</p>
                    </div>
                    <button
                        onClick={loadUser}
                        className="text-xs text-red-300 hover:text-white font-semibold px-3 py-1 bg-red-900/40 rounded border border-red-700/60"
                    >
                        Retry
                    </button>
                </div>
            )}

            {is_authenticated && user ? (
                <div className="space-y-6">
                    {/* USER PROFILE CARD */}
                    <div className="bg-[#131B2F] border border-slate-800 rounded-2xl p-6 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-blue-500/20">
                                    {(user.first_name ? user.first_name[0] : user.username[0] || 'A').toUpperCase()}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-bold text-white">
                                            {user.first_name ? `${user.first_name} ${user.last_name || ''}` : user.username}
                                        </h2>
                                        <span className="text-[10px] bg-blue-500/20 text-blue-400 font-semibold px-2 py-0.5 rounded-full border border-blue-500/30">
                                            Verified
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                                        {user.email || 'No email associated'}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={handleLogout}
                                className="inline-flex items-center gap-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/30 text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                            >
                                <LogOut className="w-4 h-4" /> Sign Out
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                            <div className="bg-[#0A0F1C] border border-slate-800 p-3.5 rounded-xl">
                                <span className="text-slate-500 block mb-1">Username Handle</span>
                                <span className="font-mono font-semibold text-white">{user.username}</span>
                            </div>
                            <div className="bg-[#0A0F1C] border border-slate-800 p-3.5 rounded-xl">
                                <span className="text-slate-500 block mb-1">Member Since</span>
                                <span className="text-white font-medium">
                                    {user.date_joined ? new Date(user.date_joined).toLocaleDateString([], { month: 'long', year: 'numeric' }) : '2024'}
                                </span>
                            </div>
                            <div className="bg-[#0A0F1C] border border-slate-800 p-3.5 rounded-xl">
                                <span className="text-slate-500 block mb-1">Account Role</span>
                                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                    <ShieldCheck className="w-3.5 h-3.5" /> Equity Analyst
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* SUBSCRIPTION DETAILS */}
                    <div className="bg-[#131B2F] border border-slate-800 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Crown className="w-5 h-5 text-amber-400" />
                                <h3 className="text-lg font-bold text-white">Active Subscription</h3>
                            </div>
                            <span className="text-xs px-2.5 py-1 rounded-full font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                {subscription?.tier || 'Free'} Plan
                            </span>
                        </div>

                        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                            Your account is synchronized with the backend entitlement engine. Real-time report generation limits and document retrieval quotas are enforced per authenticated profile.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                            <div className="bg-[#0A0F1C] border border-slate-800 p-4 rounded-xl space-y-2">
                                <span className="text-xs font-semibold text-slate-400 block uppercase">
                                    Included Features
                                </span>
                                <div className="space-y-1.5 text-xs text-slate-300">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                        <span>Unlimited Financial Statement Calculations</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                        <span>Full 6-Module Quantitative Valuation</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                        <span>15-Section Research PDF Reports (50-page max)</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-[#0A0F1C] border border-slate-800 p-4 rounded-xl space-y-2">
                                <span className="text-xs font-semibold text-slate-400 block uppercase">
                                    Account Entitlements
                                </span>
                                <div className="space-y-1.5 text-xs text-slate-300">
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-400">Reports Generation:</span>
                                        <span className="font-semibold text-white">Active</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-400">Watchlist Quota:</span>
                                        <span className="font-semibold text-white">Unlimited</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-400">Audit History Retention:</span>
                                        <span className="font-semibold text-white">Full Persistence</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => onNavigate && onNavigate('subscription')}
                            className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs py-2.5 px-6 rounded-lg inline-flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/10 cursor-pointer"
                        >
                            <Crown className="w-3.5 h-3.5 fill-slate-950" />
                            View Plan Comparison & Upgrade Tiers
                        </button>
                    </div>
                </div>
            ) : (
                /* GUEST SIGN IN / SIGN UP CARD */
                <div className="bg-[#131B2F] border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-md mx-auto shadow-xl">
                    {/* AUTH REQUIRED PROMPT BANNER */}
                    {authPrompt && (
                        <div className="bg-amber-950/40 border border-amber-600/50 rounded-xl p-3.5 mb-6 flex items-start justify-between gap-2.5 animate-in fade-in">
                            <div className="flex items-start gap-2.5">
                                <Lock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="text-xs font-bold text-amber-200 uppercase tracking-wide">Authentication Required</h4>
                                    <p className="text-xs text-amber-300/90 mt-0.5 leading-snug">{authPrompt}</p>
                                </div>
                            </div>
                            {onClearAuthPrompt && (
                                <button
                                    onClick={onClearAuthPrompt}
                                    className="text-amber-400 hover:text-amber-200 text-xs px-1 hover:bg-amber-900/30 rounded"
                                    title="Dismiss notice"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    )}

                    {/* SEGMENTED SWITCH: SIGN IN / SIGN UP */}
                    <div className="flex p-1 bg-[#0A0F1C] rounded-xl border border-slate-800 mb-6">
                        <button
                            type="button"
                            onClick={() => {
                                setAuthMode('signin');
                                setLoginError(null);
                            }}
                            className={`flex-1 flex items-center justify-center gap-2 text-xs font-semibold py-2 rounded-lg transition-all ${
                                authMode === 'signin'
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <LogIn className="w-3.5 h-3.5" /> Sign In
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setAuthMode('signup');
                                setRegisterError(null);
                            }}
                            className={`flex-1 flex items-center justify-center gap-2 text-xs font-semibold py-2 rounded-lg transition-all ${
                                authMode === 'signup'
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <UserPlus className="w-3.5 h-3.5" /> Sign Up
                        </button>
                    </div>

                    <div className="text-center mb-6">
                        <div className="w-12 h-12 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mx-auto mb-3">
                            {authMode === 'signin' ? <Lock className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />}
                        </div>
                        <h2 className="text-xl font-bold text-white">
                            {authMode === 'signin' ? 'Sign In to Finlytics AI' : 'Create an Analyst Account'}
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">
                            {authMode === 'signin'
                                ? 'Access your personal watchlist, research history, and 15-section reports.'
                                : 'Sign up to build your watchlist and generate institutional research reports.'}
                        </p>
                    </div>

                    {/* SUCCESS BANNER */}
                    {registerSuccessMessage && (
                        <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-lg p-3 mb-4 text-xs text-emerald-200 flex items-start gap-2">
                            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                            <span>{registerSuccessMessage}</span>
                        </div>
                    )}

                    {loginSuccess && (
                        <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-lg p-3 mb-4 text-xs text-emerald-200 flex items-center gap-2">
                            <Check className="w-4 h-4 text-emerald-400" /> Login successful! Loading dashboard...
                        </div>
                    )}

                    {/* SIGN IN FORM */}
                    {authMode === 'signin' ? (
                        <div>
                            {loginError && (
                                <div className="bg-red-950/40 border border-red-800/80 rounded-lg p-3 mb-4 text-xs text-red-200">
                                    {loginError}
                                </div>
                            )}

                            <form onSubmit={handleLogin} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">Username</label>
                                    <input
                                        type="text"
                                        value={loginUsername}
                                        onChange={(e) => setLoginUsername(e.target.value)}
                                        placeholder="Enter your username"
                                        required
                                        className="w-full bg-[#0A0F1C] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                                    <div className="relative">
                                        <input
                                            type={showLoginPassword ? 'text' : 'password'}
                                            value={loginPassword}
                                            onChange={(e) => setLoginPassword(e.target.value)}
                                            placeholder="Enter your password"
                                            required
                                            className="w-full bg-[#0A0F1C] border border-slate-700 rounded-lg pl-3 pr-10 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowLoginPassword((prev) => !prev)}
                                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                                            tabIndex="-1"
                                            title={showLoginPassword ? "Hide password" : "Show password"}
                                        >
                                            {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loginLoading || !loginUsername || !loginPassword}
                                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-lg transition-colors shadow-md flex items-center justify-center gap-2"
                                >
                                    {loginLoading ? 'Signing In...' : 'Sign In'}
                                </button>
                            </form>

                            <div className="text-center mt-5 pt-4 border-t border-slate-800 text-xs text-slate-400">
                                Don't have an account yet?{' '}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAuthMode('signup');
                                        setRegisterError(null);
                                    }}
                                    className="text-blue-400 hover:underline font-semibold"
                                >
                                    Sign Up here
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* SIGN UP FORM */
                        <div>
                            {registerError && (
                                <div className="bg-red-950/40 border border-red-800/80 rounded-lg p-3 mb-4 text-xs text-red-200">
                                    {registerError}
                                </div>
                            )}

                            <form onSubmit={handleRegister} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Username *
                                    </label>
                                    <input
                                        type="text"
                                        value={registerUsername}
                                        onChange={(e) => setRegisterUsername(e.target.value)}
                                        placeholder="Choose a unique username"
                                        required
                                        minLength="3"
                                        className="w-full bg-[#0A0F1C] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                    />
                                    <span className="text-[11px] text-slate-500 mt-0.5 block">Minimum 3 characters</span>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Password *
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showRegisterPassword ? 'text' : 'password'}
                                            value={registerPassword}
                                            onChange={(e) => setRegisterPassword(e.target.value)}
                                            placeholder="Create a strong password"
                                            required
                                            minLength="6"
                                            className="w-full bg-[#0A0F1C] border border-slate-700 rounded-lg pl-3 pr-10 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowRegisterPassword((prev) => !prev)}
                                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                                            tabIndex="-1"
                                            title={showRegisterPassword ? "Hide password" : "Show password"}
                                        >
                                            {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <span className="text-[11px] text-slate-500 mt-0.5 block">Minimum 6 characters</span>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Confirm Password *
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showRegisterConfirmPassword ? 'text' : 'password'}
                                            value={registerConfirmPassword}
                                            onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                                            placeholder="Re-enter your password"
                                            required
                                            minLength="6"
                                            className="w-full bg-[#0A0F1C] border border-slate-700 rounded-lg pl-3 pr-10 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowRegisterConfirmPassword((prev) => !prev)}
                                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                                            tabIndex="-1"
                                            title={showRegisterConfirmPassword ? "Hide password" : "Show password"}
                                        >
                                            {showRegisterConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={
                                        registerLoading ||
                                        !registerUsername ||
                                        !registerPassword ||
                                        !registerConfirmPassword
                                    }
                                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-lg transition-colors shadow-md flex items-center justify-center gap-2"
                                >
                                    {registerLoading ? 'Creating Account...' : 'Create Account'}
                                </button>
                            </form>

                            <div className="text-center mt-5 pt-4 border-t border-slate-800 text-xs text-slate-400">
                                Already have an account?{' '}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAuthMode('signin');
                                        setLoginError(null);
                                    }}
                                    className="text-blue-400 hover:underline font-semibold"
                                >
                                    Sign In here
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}