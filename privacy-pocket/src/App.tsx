import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { ArrowDownRight, ArrowUpRight, Check, ChevronRight, CircleHelp, Copy, Database, Download, FileSearch, Fingerprint, LockKeyhole, LogOut, Plus, Shield, Trash2, Upload } from 'lucide-react';
import { aiApi, authApi, privacyApi, walletApi } from './api/client';
import './App.css';

type InventoryItem = {
  id: number;
  status: string;
  organization?: { name: string };
  dataItem?: { name: string; sensitivity?: string };
  purpose?: { description: string };
};

type PolicyAnalysis = {
  data_collected?: string[];
  purposes?: string[];
  risk_score?: string;
  summary?: string;
  source?: string;
  url?: string;
};

type DashboardCheck = {
  name: string;
  status: 'passed' | 'failed';
  durationMs: number;
  output: string;
};

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [username, setUsername] = useState(() => localStorage.getItem('username') || '');
  const [isRegister, setIsRegister] = useState(false);
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mfaPending, setMfaPending] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [scoreData, setScoreData] = useState({ score: 0, risk_level: '—' });
  const [loadingData, setLoadingData] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ organization: '', dataItem: '', purpose: '' });
  const [pageError, setPageError] = useState('');
  const [policyText, setPolicyText] = useState('');
  const [policyUrl, setPolicyUrl] = useState('');
  const [analysis, setAnalysis] = useState<PolicyAnalysis | null>(null);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [shareOrganization, setShareOrganization] = useState('');
  const [shareMappings, setShareMappings] = useState<Record<string, string[]>>({});
  const [shareConfirmed, setShareConfirmed] = useState(false);
  const [sharingBusy, setSharingBusy] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [shareMessageError, setShareMessageError] = useState(false);
  const [policyMode, setPolicyMode] = useState<'url' | 'text'>('url');
  const [privacyMessage, setPrivacyMessage] = useState('');
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; qrCodeUrl: string } | null>(null);
  const [mfaSetupCode, setMfaSetupCode] = useState('');
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaSecretCopied, setMfaSecretCopied] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'approved' | 'withdrawn'>('all');
  const [confirmErase, setConfirmErase] = useState(false);
  const [checks, setChecks] = useState<DashboardCheck[]>([]);
  const [checksBusy, setChecksBusy] = useState(false);
  const [checksCompletedAt, setChecksCompletedAt] = useState('');

  const loadData = async () => {
    setLoadingData(true);
    try {
      const [inventoryResponse, scoreResponse] = await Promise.all([
        walletApi.getInventory(),
        walletApi.getScore(),
      ]);
      setInventory(inventoryResponse.data);
      setScoreData(scoreResponse.data);
      setPageError('');
    } catch (error: any) {
      const status = error.response?.status;
      setPageError(status === 401 || status === 403
        ? 'Your session is no longer valid. Sign in again to reopen your wallet.'
        : 'We could not reach the service. Check that the backend is running, then retry.');
      if (status === 401 || status === 403) handleLogout();
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (token) void loadData();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    authApi.getMfaStatus()
      .then(({ data }) => setMfaEnabled(Boolean(data.enabled)))
      .catch(() => setMfaEnabled(false));
  }, [token]);

  const handleAuth = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setAuthError('');
    try {
      const response = mfaPending
        ? await authApi.verifyMfa(mfaCode)
        : isRegister
          ? await authApi.register(credentials)
          : await authApi.login(credentials);
      const data = response.data;
      if (data.status === 'MFA_REQUIRED') {
        if (!data.token) throw new Error('The server did not return an MFA challenge.');
        localStorage.setItem('mfaChallenge', data.token);
        setMfaPending(true);
        setAuthError('Enter the current code from your authenticator app.');
        return;
      }
      if (!data.token) throw new Error('The server did not return a sign-in token.');
      const signedInAs = data.username || credentials.username;
      localStorage.removeItem('mfaChallenge');
      localStorage.setItem('token', data.token);
      localStorage.setItem('username', signedInAs);
      setUsername(signedInAs);
      setToken(data.token);
    } catch (error: any) {
      const body = error.response?.data;
      const serverMessage = typeof body === 'string'
        ? body
        : body?.message || body?.error;
      setAuthError(serverMessage || error.message || 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('mfaChallenge');
    localStorage.removeItem('username');
    setToken(null);
    setInventory([]);
  }

  const handleAddConsent = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await walletApi.addConsent(formData);
      setShowAddModal(false);
      setFormData({ organization: '', dataItem: '', purpose: '' });
      await loadData();
    } catch {
      setPageError('We could not save this share. Check the fields and try again.');
    }
  };

  const handleWithdraw = async (id: number) => {
    try {
      await walletApi.withdrawConsent(id);
      await loadData();
    } catch {
      setPageError('We could not withdraw that consent. Please try again.');
    }
  };

  const analyzePolicy = async () => {
    setAnalysisBusy(true);
    setAnalysis(null);
    setShareMappings({});
    setShareConfirmed(false);
    setShareMessage('');
    setPageError('');
    try {
      const response = policyMode === 'url'
        ? await aiApi.analyzePolicyUrl(policyUrl)
        : await aiApi.analyzePolicy(policyText);
      setAnalysis(response.data);
    } catch (error: any) {
      setPageError(error.response?.data?.detail || error.response?.data?.error || 'Policy analysis failed. Check the AI service and try again.');
    } finally {
      setAnalysisBusy(false);
    }
  };

  const identifiedData = (analysis?.data_collected || []).filter(value => !value.toLowerCase().includes('does not clearly identify'));
  const identifiedPurposes = (analysis?.purposes || []).filter(value => !value.toLowerCase().includes('does not clearly identify'));
  const selectedShareCount = Object.values(shareMappings).reduce((sum, values) => sum + values.length, 0);

  const toggleShareMapping = (dataItem: string, purpose: string) => {
    setShareConfirmed(false);
    setShareMappings(current => {
      const selected = current[dataItem] || [];
      return {
        ...current,
        [dataItem]: selected.includes(purpose)
          ? selected.filter(value => value !== purpose)
          : [...selected, purpose],
      };
    });
  };

  const addSuggestedShares = async () => {
    if (!analysis || !shareOrganization.trim() || !shareConfirmed || selectedShareCount === 0) return;
    if (selectedShareCount > 500) {
      setShareMessage('Select no more than 500 data and purpose pairs at a time.');
      return;
    }
    setSharingBusy(true);
    setShareMessage('');
    setShareMessageError(false);
    const consents = Object.entries(shareMappings).flatMap(([dataItem, purposes]) =>
      purposes.map(purpose => ({ organization: shareOrganization.trim(), dataItem, purpose, status: 'APPROVED' })),
    );
    try {
      const { data } = await privacyApi.importPassport({ format: 'DpCon Passport', version: 1, consents });
      setShareMessage(`${data.imported} selected share${data.imported === 1 ? '' : 's'} added to your wallet.`);
      setShareMappings({});
      setShareConfirmed(false);
      await loadData();
    } catch (error: any) {
      setShareMessage(error.response?.data?.error || 'The selected shares could not be added. Please try again.');
      setShareMessageError(true);
    } finally {
      setSharingBusy(false);
    }
  };

  const runDashboardChecks = async () => {
    setChecksBusy(true);
    setChecks([]);
    setChecksCompletedAt('');
    const results: DashboardCheck[] = [];
    const run = async (name: string, check: () => Promise<string>) => {
      const started = performance.now();
      try {
        results.push({ name, status: 'passed', durationMs: 0, output: await check() });
      } catch (error: any) {
        const message = error.response?.data?.detail || error.response?.data?.error || error.response?.data?.message || error.message || 'Check failed';
        results.push({ name, status: 'failed', durationMs: 0, output: `${error.response?.status ? `HTTP ${error.response.status} · ` : ''}${message}` });
      }
      const last = results[results.length - 1];
      last.durationMs = Math.round(performance.now() - started);
      setChecks([...results]);
    };

    await run('Wallet inventory API', async () => {
      const { data, status } = await walletApi.getInventory();
      if (!Array.isArray(data)) throw new Error('Expected an inventory array.');
      const approved = data.filter((item: InventoryItem) => item.status?.toUpperCase() === 'APPROVED').length;
      const withdrawn = data.filter((item: InventoryItem) => item.status?.toUpperCase() === 'WITHDRAWN').length;
      return `HTTP ${status} · ${data.length} records · ${approved} active · ${withdrawn} withdrawn`;
    });

    await run('Privacy score API', async () => {
      const { data, status } = await walletApi.getScore();
      const value = Number(data.score);
      if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error('Score must be a number from 0 to 100.');
      return `HTTP ${status} · score ${value}/100 · ${data.risk_level || 'risk level unavailable'}`;
    });

    await run('Passport export API', async () => {
      const { data, status } = await privacyApi.exportPassport();
      if (!Array.isArray(data.consents) || !String(data.format || '').endsWith('Passport')) throw new Error('Passport response format was invalid.');
      return `HTTP ${status} · ${data.format} v${data.version} · ${data.consents.length} consent records`;
    });

    await run('AI policy analysis API', async () => {
      const sample = 'We collect your email address and precise location to provide our services. We use analytics to improve the service and may share information with third parties for advertising.';
      const { data, status } = await aiApi.analyzePolicy(sample);
      if (!Array.isArray(data.data_collected) || !Array.isArray(data.purposes) || !['Low', 'Medium', 'High'].includes(data.risk_score)) {
        throw new Error('AI response did not match the expected analysis format.');
      }
      const source = data.source || 'unspecified source';
      return `HTTP ${status} · risk ${data.risk_score} · source ${source}\nSummary: ${data.summary || 'No summary returned.'}\nData: ${data.data_collected.join(', ') || 'None identified'}\nPurposes: ${data.purposes.join(', ') || 'None identified'}`;
    });

    setChecksCompletedAt(new Date().toLocaleTimeString());
    setChecksBusy(false);
  };

  const exportPassport = async () => {
    try {
      const { data } = await privacyApi.exportPassport();
      const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'dpcon-passport.json';
      link.click();
      URL.revokeObjectURL(blobUrl);
      setPrivacyMessage('Your passport was exported. Store that file somewhere private.');
    } catch {
      setPageError('We could not export your passport. Please try again.');
    }
  };

  const importPassport = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const { data } = await privacyApi.importPassport(parsed);
      setPrivacyMessage(`${data.imported} consent record${data.imported === 1 ? '' : 's'} imported.`);
      await loadData();
    } catch (error: any) {
      setPrivacyMessage(error.response?.data?.error || 'That passport could not be imported. Check that it is a DpCon JSON file.');
    }
  };

  const eraseAccount = async () => {
    try {
      await privacyApi.deleteAccount();
      handleLogout();
    } catch {
      setPageError('Account deletion failed. Please try again.');
    }
  };

  const startMfaSetup = async () => {
    try {
      const { data } = await authApi.setupMfa();
      setMfaSetup(data);
      setMfaSetupCode('');
      setMfaSecretCopied(false);
      setMfaEnabled(Boolean(data.enabled));
      setPageError('');
    } catch (error: any) {
      setPageError(error.response?.data?.message || 'We could not start MFA setup. Sign in again and retry.');
    }
  };

  const copyMfaSecret = async () => {
    if (!mfaSetup) return;
    try {
      await navigator.clipboard.writeText(mfaSetup.secret);
      setMfaSecretCopied(true);
    } catch {
      setPageError('Clipboard access is unavailable. Select and copy the authenticator key manually.');
    }
  };

  const verifyMfaSetup = async () => {
    if (!/^\d{6}$/.test(mfaSetupCode)) {
      setPageError('Enter the current six-digit code from your authenticator app.');
      return;
    }
    try {
      await authApi.verifyMfa(mfaSetupCode);
      setMfaSetup(null);
      setMfaSetupCode('');
      setMfaEnabled(true);
      setCredentials({ username, password: '' });
      handleLogout();
      setAuthError('Authenticator verification is enabled. Sign in again and enter a code from your authenticator app.');
    } catch (error: any) {
      setPageError(error.response?.data?.message || error.response?.data?.error || 'That authenticator code was not accepted. Check the device time and try the current code.');
    }
  };

  if (!token) {
    return (
      <main className="auth-page">
        <section className="auth-story" aria-label="DpCon introduction">
          <a className="brand brand-light" href="#top" aria-label="DpCon home">
            <span className="brand-mark">p.</span><span>privacy<span className="brand-weight">pocket</span></span>
          </a>
          <div className="auth-story-copy">
            <span className="eyebrow eyebrow-light"><span className="eyebrow-dot" /> Your data, in your hands</span>
            <h1>See what you share.<br /><em>Choose what stays.</em></h1>
            <p>A clear, personal record of the organizations that hold your data and the permissions you have given them.</p>
          </div>
          <div className="auth-story-footer"><Fingerprint size={18} strokeWidth={1.6} /><span>Private by design. Yours to manage.</span></div>
          <span className="story-orbit orbit-one" /><span className="story-orbit orbit-two" />
        </section>

        <section className="auth-panel" id="top">
          <div className="auth-panel-top"><span>DPCON / PERSONAL WALLET</span><CircleHelp size={17} aria-hidden="true" /></div>
          <div className="auth-form-wrap">
            <span className="eyebrow">{mfaPending ? 'SECOND STEP' : isRegister ? 'GET STARTED' : 'WELCOME BACK'}</span>
            <h2>{mfaPending ? 'Verify it’s you' : isRegister ? 'Create your wallet' : 'Sign in to your wallet'}</h2>
            <p className="auth-subtitle">{mfaPending ? 'Enter the six-digit code from your authenticator app.' : isRegister ? 'Start keeping a record of the data you share.' : 'Your privacy record is right where you left it.'}</p>
            <form onSubmit={handleAuth} className="auth-form">
              {!mfaPending && <>
                <label htmlFor="username">Username</label>
                <input id="username" autoComplete="username" required minLength={3} maxLength={64} pattern="[A-Za-z0-9._-]{3,64}" title="Use 3–64 letters, numbers, dots, underscores, or hyphens." value={credentials.username} onChange={e => setCredentials({ ...credentials, username: e.target.value })} placeholder="Your username" />
                <label htmlFor="password">Password</label>
                <input id="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} required minLength={isRegister ? 12 : 1} maxLength={72} value={credentials.password} onChange={e => setCredentials({ ...credentials, password: e.target.value })} placeholder={isRegister ? 'At least 12 characters' : 'Your password'} />
              </>}
              {mfaPending && <><label htmlFor="mfa-code">Authenticator code</label><input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={e => setMfaCode(e.target.value)} placeholder="000 000" /></>}
              {authError && <p role="alert" className="inline-message message-error">{String(authError)}</p>}
              <button disabled={busy} className="button button-primary auth-submit">{busy ? 'Please wait…' : mfaPending ? 'Verify and continue' : isRegister ? 'Create account' : 'Sign in'}<ChevronRight size={17} /></button>
            </form>
            {!mfaPending
              ? <p className="auth-switch">{isRegister ? 'Already have a wallet?' : 'New to DpCon?'} <button type="button" onClick={() => { setIsRegister(!isRegister); setAuthError(''); }}>{isRegister ? 'Sign in' : 'Create an account'}</button></p>
              : <button type="button" className="text-button auth-back" onClick={() => { localStorage.removeItem('mfaChallenge'); setMfaPending(false); setMfaCode(''); setAuthError(''); }}>Back to sign in</button>}
            <div className="auth-assurance"><LockKeyhole size={15} /><span>Your password is encrypted before it is stored.</span></div>
          </div>
          <p className="auth-legal">By continuing, you agree to use this personal privacy management tool responsibly.</p>
        </section>
      </main>
    );
  }

  const activeCount = inventory.filter(item => item.status?.toUpperCase() === 'APPROVED').length;
  const withdrawnCount = inventory.filter(item => item.status?.toUpperCase() === 'WITHDRAWN').length;
  const score = Math.max(0, Math.min(100, Number(scoreData.score) || 0));
  const visibleInventory = inventory.filter(item => {
    const statusMatches = filter === 'all' || item.status?.toLowerCase() === filter;
    const needle = search.trim().toLowerCase();
    const searchMatches = !needle || [item.organization?.name, item.dataItem?.name, item.purpose?.description]
      .some(value => value?.toLowerCase().includes(needle));
    return statusMatches && searchMatches;
  });
  const riskClass = score >= 80 ? 'risk-calm' : score >= 50 ? 'risk-watch' : 'risk-high';

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to wallet</a>
      <header className="topbar">
        <a className="brand" href="#wallet" aria-label="DpCon wallet">
          <span className="brand-mark">p.</span><span>privacy<span className="brand-weight">pocket</span></span>
        </a>
        <nav className="topnav" aria-label="Main navigation">
          <a className="topnav-link active" href="#wallet">Wallet</a>
          <a className="topnav-link" href="#policy-review">Policy review</a>
          <a className="topnav-link" href="#system-checks">System checks</a>
          <a className="topnav-link" href="#privacy-tools">Privacy tools</a>
        </nav>
        <div className="account-menu"><span className="account-initial" aria-hidden="true">{username.slice(0, 1).toUpperCase()}</span><span className="account-name">{username}</span><button className="icon-button" onClick={handleLogout} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button></div>
      </header>

      <main id="main-content" className="page-content">
        <section className="page-intro" id="wallet">
          <div><span className="eyebrow"><span className="eyebrow-dot" /> YOUR PERSONAL DATA RECORD</span><h1>Your privacy,<br className="mobile-break" /> in plain sight.</h1><p>See what you’ve shared, understand the risk, and change your mind whenever you need to.</p></div>
          <button className="button button-primary intro-action" onClick={() => setShowAddModal(true)}><Plus size={17} /> Add a data share</button>
        </section>

        {pageError && <div role="alert" className="inline-message message-error page-alert"><span>{pageError}</span><button className="text-button" onClick={() => void loadData()}>Try again</button></div>}

        <section className="overview-grid" aria-label="Privacy overview">
          <article className={`score-panel ${riskClass}`}>
            <div className="score-panel-top"><span className="eyebrow eyebrow-light">PRIVACY HEALTH</span><span className="score-context">Based on approved shares</span></div>
            <div className="score-layout">
              <div className="score-ring" style={{ '--score': `${score * 3.6}deg` } as CSSProperties & { '--score': string }} role="img" aria-label={`Privacy health score ${score} out of 100`}><div className="score-ring-center"><strong>{loadingData ? '—' : score}</strong><span>out of 100</span></div></div>
              <div className="score-copy"><p className="score-kicker">Your current score</p><h2>{scoreData.risk_level === 'Low' ? 'Looking steady.' : scoreData.risk_level === 'High' ? 'Worth a closer look.' : 'A little room to review.'}</h2><p>Your score shifts as you add or withdraw data-sharing permissions.</p><a className="score-link" href="#inventory">Review your shares <ArrowDownRight size={16} /></a></div>
            </div>
            <div className="score-panel-foot"><Shield size={15} /><span>This score is a guide, not a security guarantee.</span></div>
          </article>

          <aside className="share-summary">
            <div className="summary-heading"><span className="eyebrow">AT A GLANCE</span><span className="summary-period">YOUR WALLET</span></div>
            <div className="summary-total"><strong>{loadingData ? '—' : activeCount}</strong><span>active<br />data shares</span></div>
            <div className="summary-divider" />
            <div className="summary-detail"><span className="summary-marker marker-approved" /><span>Approved</span><strong>{loadingData ? '—' : activeCount}</strong><ArrowUpRight size={15} /></div>
            <div className="summary-detail"><span className="summary-marker marker-withdrawn" /><span>Withdrawn</span><strong>{loadingData ? '—' : withdrawnCount}</strong><Check size={15} /></div>
            <a className="summary-link" href="#inventory">View full inventory <ChevronRight size={15} /></a>
          </aside>
        </section>

        <section className="inventory-section" id="inventory">
          <div className="section-heading"><div><span className="eyebrow">YOUR RECORD</span><h2>Data inventory</h2><p>Every permission in one place, with a clear path to withdraw it.</p></div><span className="record-count">{inventory.length} record{inventory.length === 1 ? '' : 's'}</span></div>
          <div className="inventory-controls"><div className="filter-tabs" role="group" aria-label="Filter data shares">{(['all', 'approved', 'withdrawn'] as const).map(value => <button key={value} className={filter === value ? 'filter-tab selected' : 'filter-tab'} onClick={() => setFilter(value)}>{value === 'all' ? 'All shares' : value === 'approved' ? 'Active' : 'Withdrawn'}</button>)}</div><label className="search-field"><span className="sr-only">Search inventory</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find an organization or data item" /><FileSearch size={17} /></label></div>

          {loadingData && inventory.length === 0 ? <div className="inventory-loading" aria-label="Loading inventory"><span /><span /><span /></div>
            : visibleInventory.length === 0 ? <div className="empty-state"><div className="empty-mark"><Database size={22} /></div><div><h3>{inventory.length ? 'No matches in this view' : 'Your wallet starts with what you choose to add'}</h3><p>{inventory.length ? 'Try another search or switch the status filter.' : 'Add an organization, the data it holds, and why it uses it. You can withdraw a permission at any time.'}</p></div>{inventory.length === 0 && <button className="button button-secondary" onClick={() => setShowAddModal(true)}><Plus size={16} /> Add your first share</button>}</div>
            : <div className="table-wrap"><table className="inventory-table"><thead><tr><th>Organization</th><th>Data shared</th><th>Purpose</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visibleInventory.map(item => <tr key={item.id}><td><span className="organization-cell"><span className="organization-mark">{item.organization?.name?.slice(0, 1).toUpperCase() || '•'}</span><strong>{item.organization?.name || 'Unknown organization'}</strong></span></td><td>{item.dataItem?.name || '—'}</td><td className="purpose-cell">{item.purpose?.description || '—'}</td><td><span className={`status-label ${item.status?.toLowerCase() === 'approved' ? 'status-active' : 'status-withdrawn'}`}><span />{item.status?.toLowerCase() === 'approved' ? 'Active' : item.status?.toLowerCase() === 'withdrawn' ? 'Withdrawn' : item.status}</span></td><td className="action-cell">{item.status?.toLowerCase() === 'approved' && <button aria-label={`Withdraw consent for ${item.organization?.name || 'this organization'}`} title="Withdraw consent" onClick={() => void handleWithdraw(item.id)} className="withdraw-button">Withdraw <ArrowUpRight size={14} /></button>}</td></tr>)}</tbody></table></div>}
        </section>

        <section className="system-checks" id="system-checks" aria-labelledby="checks-title">
          <div className="section-heading checks-heading"><div><span className="eyebrow">LIVE SERVICE CHECKS</span><h2 id="checks-title">See the app working.</h2><p>Run read-only checks against your signed-in wallet and the connected policy-analysis service.</p></div><button className="button button-secondary" onClick={() => void runDashboardChecks()} disabled={checksBusy}>{checksBusy ? 'Running checks…' : checks.length ? 'Run again' : 'Run live checks'}<ChevronRight size={16} /></button></div>
          {checks.length === 0 ? <div className="checks-empty"><Shield size={18} /><span>No checks run yet. Your wallet will not be changed by these checks.</span></div> : <>
            <div className="checks-summary" role="status"><strong>{checks.filter(check => check.status === 'passed').length}/{checks.length} passed</strong><span>{checksCompletedAt ? `Last run ${checksCompletedAt}` : 'Checks in progress'}</span></div>
            <div className="check-list">{checks.map((check, index) => <article className="check-row" key={`${check.name}-${index}`}><span className={`check-indicator ${check.status}`} aria-label={check.status}>{check.status === 'passed' ? <Check size={15} /> : <CircleHelp size={15} />}</span><div className="check-main"><div className="check-title-line"><strong>{check.name}</strong><span>{check.status === 'passed' ? 'PASS' : 'FAIL'} · {check.durationMs} ms</span></div><pre>{check.output}</pre></div></article>)}</div>
          </>}
        </section>

        <section className="lower-grid" id="policy-review">
          <article className="tool-panel policy-panel">
            <div className="tool-heading"><span className="tool-icon"><FileSearch size={19} /></span><span className="eyebrow">POLICY REVIEW</span></div>
            <h2>Make the fine print<br />a little clearer.</h2><p className="tool-description">Get a plain-language overview of the data a policy collects, why it uses it, and its potential risk signals.</p>
            <div className="mode-switch" role="tablist" aria-label="Choose policy input method"><button role="tab" aria-selected={policyMode === 'url'} className={policyMode === 'url' ? 'mode-tab selected' : 'mode-tab'} onClick={() => setPolicyMode('url')}>Use a web address</button><button role="tab" aria-selected={policyMode === 'text'} className={policyMode === 'text' ? 'mode-tab selected' : 'mode-tab'} onClick={() => setPolicyMode('text')}>Paste policy text</button></div>
            {policyMode === 'url' ? <label className="field-label" htmlFor="policy-url">Privacy policy URL<input id="policy-url" type="url" value={policyUrl} onChange={e => setPolicyUrl(e.target.value)} placeholder="https://company.com/privacy" /></label>
              : <label className="field-label" htmlFor="policy-text">Policy text<textarea id="policy-text" rows={5} maxLength={100000} value={policyText} onChange={e => setPolicyText(e.target.value)} placeholder="Paste a section of the policy here…" /><span className="field-hint">At least 30 characters · {policyText.length.toLocaleString()} / 100,000</span></label>}
            <button disabled={analysisBusy || (policyMode === 'url' ? !policyUrl : policyText.trim().length < 30)} onClick={() => void analyzePolicy()} className="button button-dark analysis-button"><span>{analysisBusy ? 'Reviewing policy…' : 'Review policy'}</span><ChevronRight size={16} /></button>
            {analysis && <div className="analysis-result" aria-live="polite"><div className="analysis-result-head"><span className="eyebrow">SUMMARY</span><span className={`risk-tag ${analysis.risk_score?.toLowerCase() || 'medium'}`}>{analysis.risk_score || 'Unrated'} signal</span></div><p className="analysis-summary">{analysis.summary}</p><div className="analysis-columns"><div><h3>Data identified</h3><ul>{(analysis.data_collected || []).map(value => <li key={value}>{value}</li>)}</ul></div><div><h3>Stated purposes</h3><ul>{(analysis.purposes || []).map(value => <li key={value}>{value}</li>)}</ul></div></div><p className="analysis-footnote">{analysis.source === 'offline_mock' || analysis.source === 'local_fallback' ? 'Offline keyword scan' : 'AI-generated overview'} · Informational only; check the original policy.</p></div>}
            {analysis && identifiedData.length > 0 && identifiedPurposes.length > 0 && <div className="share-builder"><span className="eyebrow">BUILD WALLET RECORDS</span><h3>Choose the shares you recognize</h3><p>Map each detected data type to the purposes you believe apply. The analysis is a suggestion, not proof of your consent.</p>
              <label className="field-label" htmlFor="share-organization">Organization<input id="share-organization" maxLength={160} value={shareOrganization} onChange={event => { setShareOrganization(event.target.value); setShareConfirmed(false); }} placeholder="Company or service name" /></label>
              <div className="share-mapping-list">{identifiedData.map(dataItem => <fieldset className="share-mapping" key={dataItem}><legend>{dataItem}</legend>{identifiedPurposes.map(purpose => <label key={purpose}><input type="checkbox" checked={(shareMappings[dataItem] || []).includes(purpose)} onChange={() => toggleShareMapping(dataItem, purpose)} />{purpose}</label>)}</fieldset>)}</div>
              <label className="share-confirm"><input type="checkbox" checked={shareConfirmed} onChange={event => setShareConfirmed(event.target.checked)} /><span>I confirm these selected mappings reflect data I currently share and approve. The policy analysis alone does not establish consent.</span></label>
              <button className="button button-secondary share-save" disabled={sharingBusy || !shareOrganization.trim() || !shareConfirmed || selectedShareCount === 0} onClick={() => void addSuggestedShares()}>{sharingBusy ? 'Adding selected shares…' : `Add ${selectedShareCount} selected share${selectedShareCount === 1 ? '' : 's'}`}<ChevronRight size={16} /></button>
              {shareMessage && <p className={`inline-message ${shareMessageError ? 'message-error' : 'message-success'}`} role="status">{shareMessage}</p>}
            </div>}
          </article>

          <article className="tool-panel passport-panel" id="privacy-tools">
            <div className="tool-heading"><span className="tool-icon tool-icon-sage"><Fingerprint size={19} /></span><span className="eyebrow">YOUR CHOICES, PORTABLE</span></div>
            <h2>A record that<br />travels with you.</h2><p className="tool-description">Keep a private copy of your data-sharing preferences. Export it for safekeeping or import it into another DpCon account.</p>
            <div className="passport-preview"><div className="passport-preview-mark">D<span>·</span></div><div><strong>DpCon passport</strong><span>JSON file · Your consent records</span></div><LockKeyhole size={16} /></div>
            <div className="passport-actions"><button onClick={() => void exportPassport()} className="button button-secondary"><Download size={16} /> Export passport</button><label className="button button-quiet"><Upload size={16} /> Import passport<input className="sr-only" type="file" accept="application/json,.json" onChange={e => { void importPassport(e.target.files?.[0]); e.currentTarget.value = ''; }} /></label></div>
            {privacyMessage && <p className="inline-message message-success" role="status"><Check size={15} />{privacyMessage}</p>}
            <div className="security-setting">
              <div><span className="eyebrow">SIGN-IN SECURITY</span><p>Authenticator app verification</p></div>
              <span className={`mfa-status ${mfaEnabled ? 'mfa-status-on' : 'mfa-status-off'}`}><span />{mfaEnabled ? 'Enabled' : 'Not set up'}</span>
              <button className="text-button" onClick={() => void startMfaSetup()}>{mfaEnabled ? 'Replace key' : 'Set up MFA'} <ChevronRight size={14} /></button>
            </div>
            {mfaSetup && <div className="mfa-setup">
              <span className="eyebrow">1 · ADD TO YOUR AUTHENTICATOR</span>
              <p>In your authenticator app, add an account using a setup key. Choose a time-based code with a 30-second interval.</p>
              <div className="mfa-secret-row"><code>{mfaSetup.secret}</code><button type="button" className="button button-quiet" onClick={() => void copyMfaSecret()}><Copy size={14} />{mfaSecretCopied ? 'Copied' : 'Copy key'}</button></div>
              <a href={mfaSetup.qrCodeUrl}>Open authenticator app</a>
              <span className="eyebrow mfa-verify-label">2 · VERIFY TO TURN IT ON</span>
              <p>Enter the current six-digit code. Your existing authenticator remains active until this key is verified.</p>
              <div className="mfa-code-row"><input aria-label="MFA verification code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={mfaSetupCode} onChange={e => setMfaSetupCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000 000" /><button className="button button-dark" disabled={mfaSetupCode.length !== 6} onClick={() => void verifyMfaSetup()}>Verify and enable</button></div>
            </div>}
            <div className="danger-zone"><div><span className="eyebrow">LEAVE DPCON</span><p>Permanently erase your account and wallet records.</p></div>{confirmErase ? <div className="confirm-actions"><button className="text-button" onClick={() => setConfirmErase(false)}>Keep account</button><button className="button button-danger" onClick={() => void eraseAccount()}>Erase account</button></div> : <button className="text-button text-danger" onClick={() => setConfirmErase(true)}>Delete account <Trash2 size={14} /></button>}</div>
          </article>
        </section>

        <footer className="page-footer"><span>DpCon <span className="footer-dot">·</span> Your data, your call.</span><a href="#main-content">Back to top <ArrowUpRight size={13} /></a></footer>
      </main>

      {showAddModal && <div className="modal-scrim" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowAddModal(false); }}><section className="add-dialog" role="dialog" aria-modal="true" aria-labelledby="add-title"><button className="dialog-close" aria-label="Close" onClick={() => setShowAddModal(false)}>×</button><span className="eyebrow">ADD TO YOUR RECORD</span><h2 id="add-title">A new data share</h2><p>Write down who has your data and what they use it for.</p><form onSubmit={handleAddConsent} className="dialog-form">{(['organization', 'dataItem', 'purpose'] as const).map(field => <label key={field} className="field-label">{field === 'dataItem' ? 'Data shared' : field === 'organization' ? 'Organization' : 'Purpose'}<input required maxLength={160} value={formData[field]} onChange={e => setFormData({ ...formData, [field]: e.target.value })} placeholder={field === 'organization' ? 'e.g. Northstar Bank' : field === 'dataItem' ? 'e.g. Email address' : 'e.g. Account verification'} /></label>)}<div className="dialog-actions"><button type="button" className="button button-quiet" onClick={() => setShowAddModal(false)}>Cancel</button><button className="button button-primary"><Plus size={16} /> Save share</button></div></form></section></div>}
    </div>
  );
}

export default App;
