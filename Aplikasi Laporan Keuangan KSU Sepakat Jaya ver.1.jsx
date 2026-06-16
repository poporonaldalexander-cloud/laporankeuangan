import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard, Users, PiggyBank, HandCoins, Wallet, FileBarChart, Settings as SettingsIcon,
  Plus, Trash2, Pencil, X, Search, ArrowUpRight, ArrowDownRight, Printer,
  ChevronRight, Check, AlertCircle, Menu, TrendingUp, Banknote, Loader2,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const STORAGE_KEY = 'ksu-sepakat-jaya-v1';

/* ============================================================
   HELPERS
   ============================================================ */
const fmtIDR = (n) => 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');
const fmtDate = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};
const fmtMonthYear = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
};
const todayISO = () => new Date().toISOString().slice(0, 10);
const genId = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const JENIS_SIMPANAN = [
  { value: 'pokok', label: 'Simpanan Pokok' },
  { value: 'wajib', label: 'Simpanan Wajib' },
  { value: 'sukarela', label: 'Simpanan Sukarela' },
];
const JENIS_SIMPANAN_MAP = Object.fromEntries(JENIS_SIMPANAN.map((j) => [j.value, j.label]));

const KATEGORI_MASUK = ['Pendapatan Jasa Lain', 'Pendapatan Sewa Aset', 'Bantuan / Hibah', 'Pendapatan Lain-lain'];
const KATEGORI_KELUAR = [
  'Beban Gaji & Honor Pengurus',
  'Beban Listrik, Air & Internet',
  'Beban ATK & Cetak',
  'Beban Konsumsi & RAT',
  'Beban Pemeliharaan Aset',
  'Beban Lain-lain',
];

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dasbor', icon: LayoutDashboard },
  { id: 'anggota', label: 'Data Anggota', icon: Users },
  { id: 'simpanan', label: 'Simpanan', icon: PiggyBank },
  { id: 'pinjaman', label: 'Pinjaman', icon: HandCoins },
  { id: 'kas', label: 'Kas & Transaksi', icon: Wallet },
  { id: 'laporan', label: 'Laporan Keuangan', icon: FileBarChart },
  { id: 'pengaturan', label: 'Pengaturan', icon: SettingsIcon },
];

const defaultData = () => ({
  settings: {
    nama: 'KSU Sepakat Jaya',
    alamat: 'Jl. Merdeka No. 18, Sepakat Jaya',
    badanHukum: '',
    modalAwal: 0,
  },
  members: [],
  savingsTx: [],
  loans: [],
  loanPayments: [],
  cashTx: [],
});

/* ============================================================
   CALCULATIONS
   ============================================================ */
function getLoanSchedule(loan) {
  const tenor = Number(loan.tenor) || 0;
  const principal = Number(loan.jumlah) || 0;
  const rate = Number(loan.bunga) || 0;
  if (tenor <= 0) return [];
  const angsuranPokok = Math.round(principal / tenor);
  const angsuranBunga = Math.round(principal * (rate / 100));
  const out = [];
  let sisa = principal;
  const start = new Date(loan.tanggal + 'T00:00:00');
  for (let i = 1; i <= tenor; i++) {
    const pokok = i === tenor ? sisa : angsuranPokok;
    sisa -= pokok;
    const due = new Date(start.getFullYear(), start.getMonth() + i, start.getDate());
    out.push({ angsuranKe: i, jatuhTempo: due.toISOString().slice(0, 10), pokok, bunga: angsuranBunga, total: pokok + angsuranBunga });
  }
  return out;
}

function computeMemberSavings(data, memberId) {
  let pokok = 0, wajib = 0, sukarela = 0;
  data.savingsTx.forEach((t) => {
    if (t.memberId !== memberId) return;
    const sign = t.aksi === 'setor' ? 1 : -1;
    if (t.jenis === 'pokok') pokok += sign * t.jumlah;
    else if (t.jenis === 'wajib') wajib += sign * t.jumlah;
    else sukarela += sign * t.jumlah;
  });
  return { pokok, wajib, sukarela, total: pokok + wajib + sukarela };
}

function computeLoanPaid(data, loanId) {
  return data.loanPayments
    .filter((p) => p.loanId === loanId)
    .reduce((acc, p) => ({ pokok: acc.pokok + Number(p.pokok || 0), bunga: acc.bunga + Number(p.bunga || 0) }), { pokok: 0, bunga: 0 });
}

function computeKasSaldo(data, asOf) {
  let masuk = 0, keluar = 0;
  data.cashTx.forEach((t) => {
    if (asOf && t.tanggal > asOf) return;
    if (t.jenis === 'masuk') masuk += Number(t.jumlah) || 0;
    else keluar += Number(t.jumlah) || 0;
  });
  return Number(data.settings.modalAwal || 0) + masuk - keluar;
}

/* ============================================================
   GLOBAL STYLE
   ============================================================ */
const GLOBAL_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Lora:wght@500;600;700&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@500;600&display=swap');

:root {
  --color-bg: #F3F0E7;
  --color-surface: #FFFFFF;
  --color-sidebar: #16302A;
  --color-primary: #2F6B4F;
  --color-primary-dark: #1F4D38;
  --color-accent: #C9A227;
  --color-accent-soft: #F6EDC9;
  --color-text: #1C2622;
  --color-text-muted: #6F7C75;
  --color-border: #E2DCCB;
  --color-success: #2F6B4F;
  --color-success-bg: #E6F0E9;
  --color-danger: #B3463A;
  --color-danger-bg: #FBEAE7;
}
* { box-sizing: border-box; }
.font-display { font-family: 'Lora', Georgia, serif; }
.font-body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
.font-num { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }

.scrollbar-thin::-webkit-scrollbar { height: 6px; width: 6px; }
.scrollbar-thin::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 4px; }

.input-field, .select-field, .textarea-field {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: var(--color-text);
  width: 100%;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}
.input-field:focus, .select-field:focus, .textarea-field:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
  border-color: var(--color-primary);
}
.textarea-field { resize: vertical; }

.nav-item { color: rgba(255,255,255,0.72); }
.nav-item:hover { background: rgba(255,255,255,0.07); color: #fff; }
.nav-item.active { background: var(--color-accent); color: var(--color-sidebar); font-weight: 600; }

.table-row:hover { background: #FAF8F1; }

.print-only { display: none; }
@media print {
  .no-print { display: none !important; }
  .print-only { display: block !important; }
  body, .print-bg { background: white !important; }
  .print-card { border: none !important; box-shadow: none !important; }
}
`;

/* ============================================================
   APP
   ============================================================ */
export default function App() {
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY);
        if (mounted) {
          if (res && res.value) {
            const parsed = JSON.parse(res.value);
            setData({
              ...defaultData(),
              ...parsed,
              settings: { ...defaultData().settings, ...(parsed.settings || {}) },
            });
          } else {
            setData(defaultData());
          }
        }
      } catch (e) {
        if (mounted) setData(defaultData());
      } finally {
        if (mounted) setLoaded(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!loaded || !data) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      window.storage.set(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [data, loaded]);

  /* ---------- CRUD ---------- */
  const addMember = (m) =>
    setData((prev) => ({
      ...prev,
      members: [...prev.members, { id: genId('m'), noAnggota: String(prev.members.length + 1).padStart(3, '0'), ...m }],
    }));
  const updateMember = (id, changes) =>
    setData((prev) => ({ ...prev, members: prev.members.map((m) => (m.id === id ? { ...m, ...changes } : m)) }));
  const deleteMember = (id) => setData((prev) => ({ ...prev, members: prev.members.filter((m) => m.id !== id) }));

  const addSavingsTx = (tx) => {
    const id = genId('s');
    const cashId = genId('c');
    setData((prev) => {
      const member = prev.members.find((m) => m.id === tx.memberId);
      const label = JENIS_SIMPANAN_MAP[tx.jenis] || 'Simpanan';
      const cash = {
        id: cashId,
        tanggal: tx.tanggal,
        jenis: tx.aksi === 'setor' ? 'masuk' : 'keluar',
        kategori: `${label} (${tx.aksi === 'setor' ? 'Setor' : 'Tarik'})`,
        jumlah: Number(tx.jumlah),
        keterangan: `${label} a.n. ${member?.nama || '-'}${tx.keterangan ? ' — ' + tx.keterangan : ''}`,
        sumber: 'simpanan',
        refId: id,
      };
      return {
        ...prev,
        savingsTx: [...prev.savingsTx, { id, ...tx, jumlah: Number(tx.jumlah), cashRefId: cashId }],
        cashTx: [...prev.cashTx, cash],
      };
    });
  };
  const deleteSavingsTx = (id) =>
    setData((prev) => ({ ...prev, savingsTx: prev.savingsTx.filter((t) => t.id !== id), cashTx: prev.cashTx.filter((c) => c.refId !== id) }));

  const addLoan = (loan) => {
    const id = genId('l');
    const cashId = genId('c');
    setData((prev) => {
      const member = prev.members.find((m) => m.id === loan.memberId);
      const cash = {
        id: cashId,
        tanggal: loan.tanggal,
        jenis: 'keluar',
        kategori: 'Pencairan Pinjaman',
        jumlah: Number(loan.jumlah),
        keterangan: `Pencairan pinjaman a.n. ${member?.nama || '-'}`,
        sumber: 'pinjaman',
        refId: id,
      };
      return {
        ...prev,
        loans: [...prev.loans, { id, ...loan, jumlah: Number(loan.jumlah), bunga: Number(loan.bunga), tenor: Number(loan.tenor), cashRefId: cashId }],
        cashTx: [...prev.cashTx, cash],
      };
    });
  };
  const deleteLoan = (id) =>
    setData((prev) => {
      const paymentIds = prev.loanPayments.filter((p) => p.loanId === id).map((p) => p.id);
      return {
        ...prev,
        loans: prev.loans.filter((l) => l.id !== id),
        loanPayments: prev.loanPayments.filter((p) => p.loanId !== id),
        cashTx: prev.cashTx.filter((c) => c.refId !== id && !paymentIds.includes(c.refId)),
      };
    });

  const addLoanPayment = (payment) => {
    const id = genId('p');
    const cashId = genId('c');
    setData((prev) => {
      const loan = prev.loans.find((l) => l.id === payment.loanId);
      const member = prev.members.find((m) => m.id === loan?.memberId);
      const cash = {
        id: cashId,
        tanggal: payment.tanggal,
        jenis: 'masuk',
        kategori: 'Angsuran Pinjaman',
        jumlah: Number(payment.total),
        keterangan: `Angsuran ke-${payment.angsuranKe} a.n. ${member?.nama || '-'}`,
        sumber: 'angsuran',
        refId: id,
      };
      return { ...prev, loanPayments: [...prev.loanPayments, { id, ...payment, cashRefId: cashId }], cashTx: [...prev.cashTx, cash] };
    });
  };

  const addCashTx = (tx) => setData((prev) => ({ ...prev, cashTx: [...prev.cashTx, { id: genId('c'), sumber: 'manual', ...tx, jumlah: Number(tx.jumlah) }] }));
  const deleteCashTx = (id) => setData((prev) => ({ ...prev, cashTx: prev.cashTx.filter((c) => c.id !== id) }));

  const updateSettings = (changes) => setData((prev) => ({ ...prev, settings: { ...prev.settings, ...changes } }));
  const resetAll = () => setData(defaultData());

  const totals = useMemo(() => {
    if (!data) return null;
    const saldoKas = computeKasSaldo(data);
    let totalSimpanan = 0;
    const simpananByMember = {};
    data.members.forEach((m) => {
      const s = computeMemberSavings(data, m.id);
      simpananByMember[m.id] = s;
      totalSimpanan += s.total;
    });
    let totalPiutang = 0;
    const loanInfo = {};
    data.loans.forEach((l) => {
      const paid = computeLoanPaid(data, l.id);
      const sisa = Math.max(Number(l.jumlah) - paid.pokok, 0);
      loanInfo[l.id] = { ...paid, sisa, lunas: sisa <= 0 };
      totalPiutang += sisa;
    });
    const totalBunga = data.loanPayments.reduce((s, p) => s + Number(p.bunga || 0), 0);
    const pendapatanLain = data.cashTx.filter((c) => c.sumber === 'manual' && c.jenis === 'masuk').reduce((s, c) => s + Number(c.jumlah || 0), 0);
    const beban = data.cashTx.filter((c) => c.sumber === 'manual' && c.jenis === 'keluar').reduce((s, c) => s + Number(c.jumlah || 0), 0);
    const shu = totalBunga + pendapatanLain - beban;
    return { saldoKas, totalSimpanan, simpananByMember, totalPiutang, loanInfo, totalBunga, pendapatanLain, beban, shu };
  }, [data]);

  if (!data || !totals) {
    return (
      <div className="font-body flex items-center justify-center min-h-screen" style={{ background: 'var(--color-bg)' }}>
        <style>{GLOBAL_STYLE}</style>
        <div className="flex flex-col items-center gap-3" style={{ color: 'var(--color-text-muted)' }}>
          <Loader2 className="animate-spin" size={28} />
          <p className="text-sm">Memuat data koperasi…</p>
        </div>
      </div>
    );
  }

  const handlers = {
    addMember, updateMember, deleteMember,
    addSavingsTx, deleteSavingsTx,
    addLoan, deleteLoan, addLoanPayment,
    addCashTx, deleteCashTx,
    updateSettings, resetAll,
  };

  return (
    <div className="font-body" style={{ background: 'var(--color-bg)', color: 'var(--color-text)', minHeight: '100vh' }}>
      <style>{GLOBAL_STYLE}</style>
      <div className="flex min-h-screen">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} settings={data.settings} />
        <div className="flex-1 min-w-0 flex flex-col">
          <MobileBar setSidebarOpen={setSidebarOpen} activeTab={activeTab} settings={data.settings} />
          <main className="flex-1 p-4 md:p-8 w-full max-w-6xl mx-auto">
            {activeTab === 'dashboard' && <Dashboard data={data} totals={totals} />}
            {activeTab === 'anggota' && <MembersTab data={data} totals={totals} {...handlers} />}
            {activeTab === 'simpanan' && <SavingsTab data={data} totals={totals} {...handlers} />}
            {activeTab === 'pinjaman' && <LoansTab data={data} totals={totals} {...handlers} />}
            {activeTab === 'kas' && <CashTab data={data} totals={totals} {...handlers} />}
            {activeTab === 'laporan' && <ReportsTab data={data} totals={totals} />}
            {activeTab === 'pengaturan' && <SettingsTab data={data} totals={totals} {...handlers} />}
          </main>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   UI PRIMITIVES
   ============================================================ */
function Card({ children, className = '', padding = true, ...rest }) {
  return (
    <div className={`rounded-2xl border print-card ${padding ? 'p-5' : ''} ${className}`} style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} {...rest}>
      {children}
    </div>
  );
}

function Button({ children, onClick, variant = 'primary', size = 'md', type = 'button', className = '', disabled, icon: Icon }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-base' };
  const variants = {
    primary: { background: 'var(--color-primary)', color: '#fff' },
    accent: { background: 'var(--color-accent)', color: '#1C2622' },
    secondary: { background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' },
    danger: { background: 'var(--color-danger-bg)', color: 'var(--color-danger)' },
    ghost: { background: 'transparent', color: 'var(--color-text-muted)' },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${className}`} style={variants[variant]}>
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

function Field({ label, children, hint, className = '' }) {
  return (
    <label className={`flex flex-col gap-1.5 text-sm ${className}`}>
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{hint}</span>}
    </label>
  );
}

function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(28,38,34,0.45)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl shadow-xl flex flex-col" style={{ background: 'var(--color-surface)', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-black/5"><X size={18} /></button>
        </div>
        <div className="p-5 overflow-y-auto scrollbar-thin">{children}</div>
        {footer && (
          <div className="px-5 py-4 border-t flex justify-end gap-2 flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ children, tone = 'neutral' }) {
  const tones = {
    success: { background: 'var(--color-success-bg)', color: 'var(--color-success)' },
    danger: { background: 'var(--color-danger-bg)', color: 'var(--color-danger)' },
    accent: { background: 'var(--color-accent-soft)', color: '#8a6d10' },
    neutral: { background: '#EFEBE0', color: 'var(--color-text-muted)' },
  };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={tones[tone]}>
      {children}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <Card className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
        <p className="font-num text-xl sm:text-2xl font-semibold mt-1 truncate">{value}</p>
        {sub && <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{sub}</p>}
      </div>
      <div className="rounded-xl p-2.5 flex-shrink-0" style={{ background: 'var(--color-accent-soft)' }}>
        <Icon size={20} style={{ color: 'var(--color-primary-dark)' }} />
      </div>
    </Card>
  );
}

function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4 rounded-2xl border border-dashed" style={{ borderColor: 'var(--color-border)' }}>
      <div className="rounded-full p-3 mb-3" style={{ background: 'var(--color-accent-soft)' }}>
        <Icon size={22} style={{ color: 'var(--color-primary-dark)' }} />
      </div>
      <h4 className="font-display font-semibold text-base mb-1">{title}</h4>
      <p className="text-sm max-w-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>{description}</p>
      {action}
    </div>
  );
}

function PageHeader({ title, description, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        {description && <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ============================================================
   SIDEBAR / MOBILE NAV
   ============================================================ */
function CoopMark({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
      <circle cx="24" cy="24" r="22.5" stroke="var(--color-accent)" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="18.5" stroke="var(--color-accent)" strokeWidth="1" opacity="0.45" />
      <circle cx="24" cy="17" r="6.5" stroke="var(--color-accent)" strokeWidth="1.6" />
      <circle cx="18.2" cy="27.5" r="6.5" stroke="var(--color-accent)" strokeWidth="1.6" />
      <circle cx="29.8" cy="27.5" r="6.5" stroke="var(--color-accent)" strokeWidth="1.6" />
    </svg>
  );
}

function WovenPattern() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="woven" width="22" height="22" patternUnits="userSpaceOnUse">
          <path d="M0 11 H22 M11 0 V22" stroke="white" strokeWidth="1" />
          <circle cx="11" cy="11" r="1.6" fill="white" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#woven)" />
    </svg>
  );
}

function Sidebar({ activeTab, setActiveTab, sidebarOpen, setSidebarOpen, settings }) {
  return (
    <>
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside
        className={`fixed md:sticky top-0 z-40 h-screen w-64 flex-shrink-0 flex flex-col transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
        style={{ background: 'var(--color-sidebar)' }}
      >
        <div className="relative overflow-hidden px-5 pt-6 pb-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <WovenPattern />
          <div className="relative flex items-center gap-3">
            <CoopMark size={42} />
            <div className="text-white min-w-0">
              <p className="font-display text-base font-semibold leading-tight">{settings.nama}</p>
              <p className="text-xs" style={{ color: 'var(--color-accent)' }}>Koperasi Serba Usaha</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                className={`nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${activeTab === item.id ? 'active' : ''}`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="px-5 py-4 text-xs border-t" style={{ borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}>
          Dikelola secara digital untuk transparansi anggota.
        </div>
      </aside>
    </>
  );
}

function MobileBar({ setSidebarOpen, activeTab, settings }) {
  const item = NAV_ITEMS.find((n) => n.id === activeTab);
  return (
    <div className="md:hidden sticky top-0 z-20 flex items-center gap-3 px-4 py-3 no-print" style={{ background: 'var(--color-sidebar)' }}>
      <button onClick={() => setSidebarOpen(true)} className="text-white p-1"><Menu size={20} /></button>
      <div className="text-white min-w-0">
        <p className="text-xs truncate" style={{ color: 'var(--color-accent)' }}>{settings.nama}</p>
        <p className="font-display font-semibold text-sm">{item?.label}</p>
      </div>
    </div>
  );
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function Dashboard({ data, totals }) {
  const monthlyData = useMemo(() => {
    const map = {};
    data.cashTx.forEach((t) => {
      const key = t.tanggal.slice(0, 7);
      if (!map[key]) map[key] = { key, masuk: 0, keluar: 0 };
      if (t.jenis === 'masuk') map[key].masuk += Number(t.jumlah); else map[key].keluar += Number(t.jumlah);
    });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key)).slice(-6).map((d) => ({ ...d, label: fmtMonthYear(d.key + '-01') }));
  }, [data.cashTx]);

  const recent = useMemo(
    () => [...data.cashTx].sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.id.localeCompare(a.id)).slice(0, 6),
    [data.cashTx]
  );

  const jumlahAnggota = data.members.length;
  const pinjamanAktif = data.loans.filter((l) => !totals.loanInfo[l.id]?.lunas).length;

  return (
    <div>
      <PageHeader title="Dasbor Keuangan" description={`Ringkasan kondisi keuangan ${data.settings.nama} per ${fmtDate(todayISO())}`} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Wallet} label="Saldo Kas" value={fmtIDR(totals.saldoKas)} sub="Posisi kas saat ini" />
        <StatCard icon={PiggyBank} label="Total Simpanan Anggota" value={fmtIDR(totals.totalSimpanan)} sub={`${jumlahAnggota} anggota`} />
        <StatCard icon={HandCoins} label="Pinjaman Beredar" value={fmtIDR(totals.totalPiutang)} sub={`${pinjamanAktif} pinjaman aktif`} />
        <StatCard icon={TrendingUp} label="SHU Berjalan" value={fmtIDR(totals.shu)} sub="Akumulasi sejak modal awal" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <h3 className="font-display font-semibold mb-4">Arus Kas 6 Bulan Terakhir</h3>
          {monthlyData.length === 0 ? (
            <EmptyState icon={Banknote} title="Belum ada transaksi" description="Catat transaksi kas pertama untuk melihat tren arus kas di sini." />
          ) : (
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(0)}jt` : v)} />
                  <Tooltip formatter={(v) => fmtIDR(v)} />
                  <Legend />
                  <Bar dataKey="masuk" name="Kas Masuk" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="keluar" name="Kas Keluar" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card>
          <h3 className="font-display font-semibold mb-4">Transaksi Terbaru</h3>
          {recent.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Belum ada transaksi kas.</p>
          ) : (
            <ul className="space-y-3">
              {recent.map((t) => (
                <li key={t.id} className="flex items-start gap-2">
                  <div className="rounded-full p-1.5 mt-0.5" style={{ background: t.jenis === 'masuk' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)' }}>
                    {t.jenis === 'masuk' ? <ArrowUpRight size={14} style={{ color: 'var(--color-success)' }} /> : <ArrowDownRight size={14} style={{ color: 'var(--color-danger)' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.kategori}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{fmtDate(t.tanggal)}</p>
                  </div>
                  <p className="font-num text-sm font-semibold flex-shrink-0" style={{ color: t.jenis === 'masuk' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {t.jenis === 'masuk' ? '+' : '-'}{fmtIDR(t.jumlah)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ============================================================
   ANGGOTA (MEMBERS)
   ============================================================ */
function MembersTab({ data, totals, addMember, updateMember, deleteMember }) {
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // 'add' | 'edit'
  const [form, setForm] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [formError, setFormError] = useState('');

  const openAdd = () => { setForm({ nama: '', nik: '', alamat: '', telepon: '', tanggalGabung: todayISO(), status: 'Aktif' }); setFormError(''); setModal('add'); };
  const openEdit = (m) => { setForm({ ...m }); setFormError(''); setModal('edit'); };
  const close = () => setModal(null);

  const save = () => {
    if (!form.nama || !form.nama.trim()) { setFormError('Nama anggota wajib diisi.'); return; }
    if (modal === 'add') addMember(form); else updateMember(form.id, form);
    close();
  };

  const filtered = data.members.filter((m) => m.nama.toLowerCase().includes(search.toLowerCase()) || m.noAnggota.includes(search));

  const handleDelete = (m) => {
    const hasData = data.savingsTx.some((t) => t.memberId === m.id) || data.loans.some((l) => l.memberId === m.id);
    setConfirmDelete({ ...m, blocked: hasData });
  };

  return (
    <div>
      <PageHeader title="Data Anggota" description="Kelola data keanggotaan koperasi." action={<Button icon={Plus} onClick={openAdd}>Tambah Anggota</Button>} />
      <Card padding={false} className="overflow-hidden">
        <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="relative max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
            <input className="input-field pl-9" placeholder="Cari nama atau no. anggota" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Users}
              title={data.members.length === 0 ? 'Belum ada anggota' : 'Tidak ditemukan'}
              description={data.members.length === 0 ? 'Tambahkan anggota pertama koperasi untuk mulai mencatat simpanan dan pinjaman.' : 'Coba kata kunci lain.'}
              action={data.members.length === 0 && <Button icon={Plus} onClick={openAdd}>Tambah Anggota</Button>}
            />
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ color: 'var(--color-text-muted)' }}>
                  <th className="px-4 py-3 font-medium">No. Anggota</th>
                  <th className="px-4 py-3 font-medium">Nama</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">No. HP</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Tgl Gabung</th>
                  <th className="px-4 py-3 font-medium text-right">Total Simpanan</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="table-row border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-4 py-3 font-num">{m.noAnggota}</td>
                    <td className="px-4 py-3 font-medium">
                      {m.nama}
                      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{m.nik}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">{m.telepon || '-'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">{fmtDate(m.tanggalGabung)}</td>
                    <td className="px-4 py-3 text-right font-num">{fmtIDR(totals.simpananByMember[m.id]?.total || 0)}</td>
                    <td className="px-4 py-3"><Badge tone={m.status === 'Aktif' ? 'success' : 'neutral'}>{m.status}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:bg-black/5"><Pencil size={15} /></button>
                        <button onClick={() => handleDelete(m)} className="p-1.5 rounded-lg hover:bg-black/5" style={{ color: 'var(--color-danger)' }}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!modal}
        onClose={close}
        title={modal === 'add' ? 'Tambah Anggota' : 'Ubah Data Anggota'}
        footer={<><Button variant="secondary" onClick={close}>Batal</Button><Button onClick={save}>Simpan</Button></>}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nama Lengkap"><input className="input-field" value={form.nama || ''} onChange={(e) => setForm({ ...form, nama: e.target.value })} /></Field>
          <Field label="NIK"><input className="input-field" value={form.nik || ''} onChange={(e) => setForm({ ...form, nik: e.target.value })} /></Field>
          <Field label="No. HP"><input className="input-field" value={form.telepon || ''} onChange={(e) => setForm({ ...form, telepon: e.target.value })} /></Field>
          <Field label="Tanggal Bergabung"><input type="date" className="input-field" value={form.tanggalGabung || ''} onChange={(e) => setForm({ ...form, tanggalGabung: e.target.value })} /></Field>
          <Field label="Status">
            <select className="select-field" value={form.status || 'Aktif'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option>Aktif</option>
              <option>Non-Aktif</option>
            </select>
          </Field>
          <Field label="Alamat" className="sm:col-span-2"><textarea className="textarea-field" rows={2} value={form.alamat || ''} onChange={(e) => setForm({ ...form, alamat: e.target.value })} /></Field>
        </div>
        {formError && <p className="text-xs flex items-center gap-1 mt-3" style={{ color: 'var(--color-danger)' }}><AlertCircle size={13} />{formError}</p>}
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Hapus Anggota"
        footer={!confirmDelete?.blocked && (
          <><Button variant="secondary" onClick={() => setConfirmDelete(null)}>Batal</Button><Button variant="danger" onClick={() => { deleteMember(confirmDelete.id); setConfirmDelete(null); }}>Hapus</Button></>
        )}
      >
        {confirmDelete?.blocked ? (
          <p className="text-sm">Anggota <strong>{confirmDelete?.nama}</strong> memiliki riwayat simpanan atau pinjaman, sehingga tidak dapat dihapus. Ubah status menjadi "Non-Aktif" jika anggota sudah tidak aktif.</p>
        ) : (
          <p className="text-sm">Yakin ingin menghapus anggota <strong>{confirmDelete?.nama}</strong>? Tindakan ini tidak dapat dibatalkan.</p>
        )}
      </Modal>
    </div>
  );
}

/* ============================================================
   SIMPANAN (SAVINGS)
   ============================================================ */
function SavingsTab({ data, totals, addSavingsTx, deleteSavingsTx }) {
  const [form, setForm] = useState({ memberId: '', jenis: 'pokok', aksi: 'setor', jumlah: '', tanggal: todayISO(), keterangan: '' });
  const [filterMember, setFilterMember] = useState('all');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    if (!form.memberId) { setError('Pilih anggota terlebih dahulu.'); return; }
    if (!form.jumlah || Number(form.jumlah) <= 0) { setError('Jumlah harus lebih dari 0.'); return; }
    addSavingsTx({ ...form, jumlah: Number(form.jumlah) });
    setForm({ ...form, jumlah: '', keterangan: '' });
    setError('');
  };

  const history = useMemo(() => {
    let list = [...data.savingsTx];
    if (filterMember !== 'all') list = list.filter((t) => t.memberId === filterMember);
    return list.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  }, [data.savingsTx, filterMember]);

  const memberName = (id) => data.members.find((m) => m.id === id)?.nama || '-';

  return (
    <div>
      <PageHeader title="Simpanan Anggota" description="Catat dan kelola simpanan pokok, wajib, dan sukarela anggota." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-1">
          <h3 className="font-display font-semibold mb-4">Catat Transaksi Simpanan</h3>
          {data.members.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Tambahkan anggota terlebih dahulu di menu Data Anggota.</p>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <Field label="Anggota">
                <select className="select-field" value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })}>
                  <option value="">Pilih anggota</option>
                  {data.members.map((m) => <option key={m.id} value={m.id}>{m.noAnggota} — {m.nama}</option>)}
                </select>
              </Field>
              <Field label="Jenis Simpanan">
                <select className="select-field" value={form.jenis} onChange={(e) => setForm({ ...form, jenis: e.target.value })}>
                  {JENIS_SIMPANAN.map((j) => <option key={j.value} value={j.value}>{j.label}</option>)}
                </select>
              </Field>
              <Field label="Jenis Transaksi">
                <div className="flex gap-2">
                  {['setor', 'tarik'].map((a) => (
                    <button
                      type="button"
                      key={a}
                      onClick={() => setForm({ ...form, aksi: a })}
                      className="flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
                      style={form.aksi === a ? { borderColor: 'var(--color-primary)', background: 'var(--color-success-bg)', color: 'var(--color-primary-dark)' } : { borderColor: 'var(--color-border)' }}
                    >
                      {a === 'setor' ? 'Setor' : 'Tarik'}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Jumlah (Rp)"><input type="number" min="0" className="input-field font-num" value={form.jumlah} onChange={(e) => setForm({ ...form, jumlah: e.target.value })} placeholder="0" /></Field>
              <Field label="Tanggal"><input type="date" className="input-field" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} /></Field>
              <Field label="Keterangan (opsional)"><input className="input-field" value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} placeholder="Contoh: setoran bulan Juni" /></Field>
              {error && <p className="text-xs flex items-center gap-1" style={{ color: 'var(--color-danger)' }}><AlertCircle size={13} />{error}</p>}
              <Button type="submit" className="w-full">Simpan Transaksi</Button>
            </form>
          )}
        </Card>

        <Card padding={false} className="lg:col-span-2 overflow-hidden">
          <div className="p-5 pb-3"><h3 className="font-display font-semibold">Rekap Simpanan per Anggota</h3></div>
          {data.members.length === 0 ? (
            <div className="px-5 pb-5"><p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Belum ada anggota.</p></div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left" style={{ color: 'var(--color-text-muted)' }}>
                    <th className="px-5 py-2.5 font-medium">Anggota</th>
                    <th className="px-5 py-2.5 font-medium text-right">Pokok</th>
                    <th className="px-5 py-2.5 font-medium text-right">Wajib</th>
                    <th className="px-5 py-2.5 font-medium text-right">Sukarela</th>
                    <th className="px-5 py-2.5 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.members.map((m) => {
                    const s = totals.simpananByMember[m.id] || { pokok: 0, wajib: 0, sukarela: 0, total: 0 };
                    return (
                      <tr key={m.id} className="table-row border-t" style={{ borderColor: 'var(--color-border)' }}>
                        <td className="px-5 py-2.5 font-medium">{m.nama}</td>
                        <td className="px-5 py-2.5 text-right font-num">{fmtIDR(s.pokok)}</td>
                        <td className="px-5 py-2.5 text-right font-num">{fmtIDR(s.wajib)}</td>
                        <td className="px-5 py-2.5 text-right font-num">{fmtIDR(s.sukarela)}</td>
                        <td className="px-5 py-2.5 text-right font-num font-semibold">{fmtIDR(s.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t font-semibold" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-5 py-3">Total Koperasi</td>
                    <td className="px-5 py-3 text-right font-num">{fmtIDR(data.members.reduce((s, m) => s + (totals.simpananByMember[m.id]?.pokok || 0), 0))}</td>
                    <td className="px-5 py-3 text-right font-num">{fmtIDR(data.members.reduce((s, m) => s + (totals.simpananByMember[m.id]?.wajib || 0), 0))}</td>
                    <td className="px-5 py-3 text-right font-num">{fmtIDR(data.members.reduce((s, m) => s + (totals.simpananByMember[m.id]?.sukarela || 0), 0))}</td>
                    <td className="px-5 py-3 text-right font-num">{fmtIDR(totals.totalSimpanan)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card padding={false} className="overflow-hidden">
        <div className="p-5 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display font-semibold">Riwayat Transaksi Simpanan</h3>
          <select className="select-field" style={{ maxWidth: 220 }} value={filterMember} onChange={(e) => setFilterMember(e.target.value)}>
            <option value="all">Semua Anggota</option>
            {data.members.map((m) => <option key={m.id} value={m.id}>{m.nama}</option>)}
          </select>
        </div>
        {history.length === 0 ? (
          <div className="px-5 pb-5"><EmptyState icon={PiggyBank} title="Belum ada transaksi simpanan" description="Transaksi simpanan yang dicatat akan tampil di sini dan otomatis tercatat pada buku kas." /></div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ color: 'var(--color-text-muted)' }}>
                  <th className="px-5 py-2.5 font-medium">Tanggal</th>
                  <th className="px-5 py-2.5 font-medium">Anggota</th>
                  <th className="px-5 py-2.5 font-medium">Jenis</th>
                  <th className="px-5 py-2.5 font-medium">Transaksi</th>
                  <th className="px-5 py-2.5 font-medium text-right">Jumlah</th>
                  <th className="px-5 py-2.5 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {history.map((t) => (
                  <tr key={t.id} className="table-row border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-5 py-2.5 whitespace-nowrap">{fmtDate(t.tanggal)}</td>
                    <td className="px-5 py-2.5 font-medium">{memberName(t.memberId)}</td>
                    <td className="px-5 py-2.5">{JENIS_SIMPANAN_MAP[t.jenis]}</td>
                    <td className="px-5 py-2.5"><Badge tone={t.aksi === 'setor' ? 'success' : 'danger'}>{t.aksi === 'setor' ? 'Setor' : 'Tarik'}</Badge></td>
                    <td className="px-5 py-2.5 text-right font-num">{fmtIDR(t.jumlah)}</td>
                    <td className="px-5 py-2.5 text-right">
                      <button onClick={() => setConfirmDelete(t)} className="p-1.5 rounded-lg hover:bg-black/5" style={{ color: 'var(--color-danger)' }}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Hapus Transaksi Simpanan"
        footer={<><Button variant="secondary" onClick={() => setConfirmDelete(null)}>Batal</Button><Button variant="danger" onClick={() => { deleteSavingsTx(confirmDelete.id); setConfirmDelete(null); }}>Hapus</Button></>}
      >
        {confirmDelete && (
          <p className="text-sm">
            Yakin ingin menghapus transaksi {confirmDelete.aksi === 'setor' ? 'setoran' : 'penarikan'} {JENIS_SIMPANAN_MAP[confirmDelete.jenis]} sebesar{' '}
            <strong>{fmtIDR(confirmDelete.jumlah)}</strong> a.n. <strong>{memberName(confirmDelete.memberId)}</strong>? Transaksi kas terkait juga akan terhapus.
          </p>
        )}
      </Modal>
    </div>
  );
}

/* ============================================================
   PINJAMAN (LOANS)
   ============================================================ */
function LoansTab({ data, totals, addLoan, deleteLoan, addLoanPayment }) {
  const [form, setForm] = useState({ memberId: '', jumlah: '', bunga: '1.5', tenor: '12', tanggal: todayISO(), keterangan: '' });
  const [error, setError] = useState('');
  const [detailLoan, setDetailLoan] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    if (!form.memberId) { setError('Pilih anggota terlebih dahulu.'); return; }
    if (!form.jumlah || Number(form.jumlah) <= 0) { setError('Jumlah pinjaman harus lebih dari 0.'); return; }
    if (!form.tenor || Number(form.tenor) <= 0) { setError('Tenor harus lebih dari 0 bulan.'); return; }
    addLoan({ memberId: form.memberId, jumlah: Number(form.jumlah), bunga: Number(form.bunga) || 0, tenor: Number(form.tenor), tanggal: form.tanggal, keterangan: form.keterangan, status: 'aktif' });
    setForm({ memberId: '', jumlah: '', bunga: form.bunga, tenor: form.tenor, tanggal: todayISO(), keterangan: '' });
    setError('');
  };

  const memberName = (id) => data.members.find((m) => m.id === id)?.nama || '-';
  const sortedLoans = [...data.loans].sort((a, b) => b.tanggal.localeCompare(a.tanggal));

  const handleDelete = (loan) => {
    const hasPayments = data.loanPayments.some((p) => p.loanId === loan.id);
    setConfirmDelete({ ...loan, blocked: hasPayments });
  };

  const openPay = (loan, installment) => setPayModal({ loan, installment });
  const confirmPay = () => {
    const { loan, installment } = payModal;
    addLoanPayment({ loanId: loan.id, angsuranKe: installment.angsuranKe, tanggal: todayISO(), pokok: installment.pokok, bunga: installment.bunga, total: installment.total });
    setPayModal(null);
  };

  const estPokok = form.jumlah && form.tenor && Number(form.tenor) > 0 ? Math.round(Number(form.jumlah) / Number(form.tenor)) : 0;
  const estBunga = form.jumlah ? Math.round(Number(form.jumlah) * (Number(form.bunga || 0) / 100)) : 0;

  return (
    <div>
      <PageHeader title="Pinjaman Anggota" description="Kelola pencairan pinjaman dan pembayaran angsuran anggota." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <h3 className="font-display font-semibold mb-4">Cairkan Pinjaman Baru</h3>
          {data.members.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Tambahkan anggota terlebih dahulu.</p>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <Field label="Anggota">
                <select className="select-field" value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })}>
                  <option value="">Pilih anggota</option>
                  {data.members.map((m) => <option key={m.id} value={m.id}>{m.noAnggota} — {m.nama}</option>)}
                </select>
              </Field>
              <Field label="Jumlah Pinjaman (Rp)"><input type="number" min="0" className="input-field font-num" value={form.jumlah} onChange={(e) => setForm({ ...form, jumlah: e.target.value })} placeholder="0" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Jasa (%/bulan)"><input type="number" step="0.1" min="0" className="input-field font-num" value={form.bunga} onChange={(e) => setForm({ ...form, bunga: e.target.value })} /></Field>
                <Field label="Tenor (bulan)"><input type="number" min="1" className="input-field font-num" value={form.tenor} onChange={(e) => setForm({ ...form, tenor: e.target.value })} /></Field>
              </div>
              <Field label="Tanggal Pencairan"><input type="date" className="input-field" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} /></Field>
              <Field label="Keterangan (opsional)"><input className="input-field" value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} /></Field>
              {Number(form.jumlah) > 0 && Number(form.tenor) > 0 && (
                <div className="text-xs rounded-lg p-3" style={{ background: 'var(--color-accent-soft)', color: '#8a6d10' }}>
                  Estimasi angsuran/bulan: <span className="font-num font-semibold">{fmtIDR(estPokok + estBunga)}</span>
                  <br />(pokok {fmtIDR(estPokok)} + jasa {fmtIDR(estBunga)})
                </div>
              )}
              {error && <p className="text-xs flex items-center gap-1" style={{ color: 'var(--color-danger)' }}><AlertCircle size={13} />{error}</p>}
              <Button type="submit" className="w-full">Cairkan Pinjaman</Button>
            </form>
          )}
        </Card>

        <Card padding={false} className="lg:col-span-2 overflow-hidden">
          <div className="p-5 pb-3"><h3 className="font-display font-semibold">Daftar Pinjaman</h3></div>
          {sortedLoans.length === 0 ? (
            <div className="px-5 pb-5"><EmptyState icon={HandCoins} title="Belum ada pinjaman" description="Pinjaman yang dicairkan akan tampil di sini beserta jadwal angsurannya." /></div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left" style={{ color: 'var(--color-text-muted)' }}>
                    <th className="px-5 py-2.5 font-medium">Anggota</th>
                    <th className="px-5 py-2.5 font-medium">Tanggal</th>
                    <th className="px-5 py-2.5 font-medium text-right">Pinjaman</th>
                    <th className="px-5 py-2.5 font-medium text-right">Sisa</th>
                    <th className="px-5 py-2.5 font-medium">Status</th>
                    <th className="px-5 py-2.5 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLoans.map((l) => {
                    const info = totals.loanInfo[l.id];
                    return (
                      <tr key={l.id} className="table-row border-t" style={{ borderColor: 'var(--color-border)' }}>
                        <td className="px-5 py-2.5 font-medium">{memberName(l.memberId)}</td>
                        <td className="px-5 py-2.5">{fmtDate(l.tanggal)}</td>
                        <td className="px-5 py-2.5 text-right font-num">{fmtIDR(l.jumlah)}</td>
                        <td className="px-5 py-2.5 text-right font-num">{fmtIDR(info.sisa)}</td>
                        <td className="px-5 py-2.5"><Badge tone={info.lunas ? 'success' : 'accent'}>{info.lunas ? 'Lunas' : 'Berjalan'}</Badge></td>
                        <td className="px-5 py-2.5 text-right">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => setDetailLoan(l)} className="p-1.5 rounded-lg hover:bg-black/5" title="Lihat jadwal angsuran"><ChevronRight size={15} /></button>
                            <button onClick={() => handleDelete(l)} className="p-1.5 rounded-lg hover:bg-black/5" style={{ color: 'var(--color-danger)' }}><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={!!detailLoan}
        onClose={() => setDetailLoan(null)}
        title={detailLoan ? `Jadwal Angsuran — ${memberName(detailLoan.memberId)}` : ''}
        footer={<Button variant="secondary" onClick={() => setDetailLoan(null)}>Tutup</Button>}
      >
        {detailLoan && (() => {
          const schedule = getLoanSchedule(detailLoan);
          const paidCount = data.loanPayments.filter((p) => p.loanId === detailLoan.id).length;
          return (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-sm">
                <div><p style={{ color: 'var(--color-text-muted)' }}>Pinjaman</p><p className="font-num font-semibold">{fmtIDR(detailLoan.jumlah)}</p></div>
                <div><p style={{ color: 'var(--color-text-muted)' }}>Jasa</p><p className="font-num font-semibold">{detailLoan.bunga}%/bln</p></div>
                <div><p style={{ color: 'var(--color-text-muted)' }}>Tenor</p><p className="font-num font-semibold">{detailLoan.tenor} bln</p></div>
                <div><p style={{ color: 'var(--color-text-muted)' }}>Sisa</p><p className="font-num font-semibold">{fmtIDR(totals.loanInfo[detailLoan.id]?.sisa || 0)}</p></div>
              </div>
              <div className="overflow-y-auto scrollbar-thin border rounded-xl" style={{ borderColor: 'var(--color-border)', maxHeight: 288 }}>
                <table className="w-full text-sm">
                  <thead style={{ background: 'var(--color-bg)' }}>
                    <tr className="text-left" style={{ color: 'var(--color-text-muted)' }}>
                      <th className="px-3 py-2 font-medium">Ke-</th>
                      <th className="px-3 py-2 font-medium">Jatuh Tempo</th>
                      <th className="px-3 py-2 font-medium text-right">Pokok</th>
                      <th className="px-3 py-2 font-medium text-right">Jasa</th>
                      <th className="px-3 py-2 font-medium text-right">Total</th>
                      <th className="px-3 py-2 font-medium text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((s, idx) => (
                      <tr key={s.angsuranKe} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                        <td className="px-3 py-2">{s.angsuranKe}</td>
                        <td className="px-3 py-2">{fmtDate(s.jatuhTempo)}</td>
                        <td className="px-3 py-2 text-right font-num">{fmtIDR(s.pokok)}</td>
                        <td className="px-3 py-2 text-right font-num">{fmtIDR(s.bunga)}</td>
                        <td className="px-3 py-2 text-right font-num">{fmtIDR(s.total)}</td>
                        <td className="px-3 py-2 text-center">
                          {idx < paidCount ? <Badge tone="success">Lunas</Badge> : idx === paidCount ? <Button size="sm" onClick={() => openPay(detailLoan, s)}>Catat Bayar</Button> : <Badge tone="neutral">Belum</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal
        open={!!payModal}
        onClose={() => setPayModal(null)}
        title="Konfirmasi Pembayaran Angsuran"
        footer={<><Button variant="secondary" onClick={() => setPayModal(null)}>Batal</Button><Button onClick={confirmPay}>Catat Pembayaran</Button></>}
      >
        {payModal && (
          <div className="text-sm space-y-3">
            <p>Angsuran ke-<strong>{payModal.installment.angsuranKe}</strong> untuk <strong>{memberName(payModal.loan.memberId)}</strong></p>
            <div className="rounded-xl border p-3 space-y-1" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex justify-between"><span>Pokok</span><span className="font-num">{fmtIDR(payModal.installment.pokok)}</span></div>
              <div className="flex justify-between"><span>Jasa</span><span className="font-num">{fmtIDR(payModal.installment.bunga)}</span></div>
              <div className="flex justify-between font-semibold border-t pt-1" style={{ borderColor: 'var(--color-border)' }}><span>Total Bayar</span><span className="font-num">{fmtIDR(payModal.installment.total)}</span></div>
            </div>
            <p style={{ color: 'var(--color-text-muted)' }}>Pembayaran akan otomatis tercatat sebagai kas masuk pada tanggal {fmtDate(todayISO())}.</p>
          </div>
        )}
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Hapus Pinjaman"
        footer={!confirmDelete?.blocked && (
          <><Button variant="secondary" onClick={() => setConfirmDelete(null)}>Batal</Button><Button variant="danger" onClick={() => { deleteLoan(confirmDelete.id); setConfirmDelete(null); }}>Hapus</Button></>
        )}
      >
        {confirmDelete?.blocked ? (
          <p className="text-sm">Pinjaman a.n. <strong>{memberName(confirmDelete?.memberId)}</strong> sudah memiliki riwayat pembayaran sehingga tidak dapat dihapus.</p>
        ) : (
          <p className="text-sm">Yakin ingin menghapus data pinjaman a.n. <strong>{memberName(confirmDelete?.memberId)}</strong> sebesar <strong>{confirmDelete && fmtIDR(confirmDelete.jumlah)}</strong>? Transaksi kas terkait juga akan terhapus.</p>
        )}
      </Modal>
    </div>
  );
}

/* ============================================================
   KAS & TRANSAKSI (CASH)
   ============================================================ */
function CashTab({ data, totals, addCashTx, deleteCashTx }) {
  const [form, setForm] = useState({ tanggal: todayISO(), jenis: 'masuk', kategori: KATEGORI_MASUK[0], jumlah: '', keterangan: '' });
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const kategoriList = form.jenis === 'masuk' ? KATEGORI_MASUK : KATEGORI_KELUAR;

  const submit = (e) => {
    e.preventDefault();
    if (!form.jumlah || Number(form.jumlah) <= 0) { setError('Jumlah harus lebih dari 0.'); return; }
    addCashTx({ ...form, jumlah: Number(form.jumlah) });
    setForm({ ...form, jumlah: '', keterangan: '' });
    setError('');
  };

  const ledger = useMemo(() => {
    const sorted = [...data.cashTx].sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.id.localeCompare(b.id));
    let saldo = Number(data.settings.modalAwal || 0);
    return sorted
      .map((t) => {
        saldo += t.jenis === 'masuk' ? t.jumlah : -t.jumlah;
        return { ...t, saldo };
      })
      .reverse();
  }, [data.cashTx, data.settings.modalAwal]);

  const totalMasuk = data.cashTx.filter((t) => t.jenis === 'masuk').reduce((s, t) => s + t.jumlah, 0);
  const totalKeluar = data.cashTx.filter((t) => t.jenis === 'keluar').reduce((s, t) => s + t.jumlah, 0);

  return (
    <div>
      <PageHeader title="Kas & Transaksi" description="Catat transaksi kas operasional. Transaksi simpanan & pinjaman tercatat otomatis." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <h3 className="font-display font-semibold mb-4">Catat Transaksi Kas</h3>
          <form onSubmit={submit} className="space-y-3">
            <Field label="Jenis Transaksi">
              <div className="flex gap-2">
                {[['masuk', 'Kas Masuk'], ['keluar', 'Kas Keluar']].map(([v, l]) => (
                  <button
                    type="button"
                    key={v}
                    onClick={() => setForm({ ...form, jenis: v, kategori: (v === 'masuk' ? KATEGORI_MASUK : KATEGORI_KELUAR)[0] })}
                    className="flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
                    style={form.jenis === v ? { borderColor: 'var(--color-primary)', background: 'var(--color-success-bg)', color: 'var(--color-primary-dark)' } : { borderColor: 'var(--color-border)' }}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Kategori">
              <select className="select-field" value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })}>
                {kategoriList.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </Field>
            <Field label="Jumlah (Rp)"><input type="number" min="0" className="input-field font-num" value={form.jumlah} onChange={(e) => setForm({ ...form, jumlah: e.target.value })} placeholder="0" /></Field>
            <Field label="Tanggal"><input type="date" className="input-field" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} /></Field>
            <Field label="Keterangan"><input className="input-field" value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} placeholder="Detail transaksi" /></Field>
            {error && <p className="text-xs flex items-center gap-1" style={{ color: 'var(--color-danger)' }}><AlertCircle size={13} />{error}</p>}
            <Button type="submit" className="w-full">Simpan Transaksi</Button>
          </form>
        </Card>

        <Card className="lg:col-span-2 flex flex-col gap-3 justify-center">
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Saldo Awal Kas (Modal Awal)</span>
            <span className="font-num font-medium">{fmtIDR(data.settings.modalAwal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Total Kas Masuk</span>
            <span className="font-num font-medium" style={{ color: 'var(--color-success)' }}>+{fmtIDR(totalMasuk)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Total Kas Keluar</span>
            <span className="font-num font-medium" style={{ color: 'var(--color-danger)' }}>-{fmtIDR(totalKeluar)}</span>
          </div>
          <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <span className="font-medium">Saldo Kas Saat Ini</span>
            <span className="font-num text-xl font-semibold">{fmtIDR(totals.saldoKas)}</span>
          </div>
        </Card>
      </div>

      <Card padding={false} className="overflow-hidden">
        <div className="p-5 pb-3"><h3 className="font-display font-semibold">Buku Kas</h3></div>
        {ledger.length === 0 ? (
          <div className="px-5 pb-5"><EmptyState icon={Wallet} title="Belum ada transaksi kas" description="Semua transaksi kas — baik manual maupun otomatis dari simpanan dan pinjaman — akan tercatat di sini." /></div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ color: 'var(--color-text-muted)' }}>
                  <th className="px-5 py-2.5 font-medium">Tanggal</th>
                  <th className="px-5 py-2.5 font-medium">Keterangan</th>
                  <th className="px-5 py-2.5 font-medium text-right">Masuk</th>
                  <th className="px-5 py-2.5 font-medium text-right">Keluar</th>
                  <th className="px-5 py-2.5 font-medium text-right">Saldo</th>
                  <th className="px-5 py-2.5 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((t) => (
                  <tr key={t.id} className="table-row border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-5 py-2.5 whitespace-nowrap">{fmtDate(t.tanggal)}</td>
                    <td className="px-5 py-2.5">
                      <p className="font-medium">{t.kategori}</p>
                      <p className="text-xs flex items-center gap-1.5 flex-wrap" style={{ color: 'var(--color-text-muted)' }}>
                        {t.keterangan}
                        {t.sumber !== 'manual' && <Badge tone="accent">Otomatis</Badge>}
                      </p>
                    </td>
                    <td className="px-5 py-2.5 text-right font-num" style={{ color: 'var(--color-success)' }}>{t.jenis === 'masuk' ? fmtIDR(t.jumlah) : ''}</td>
                    <td className="px-5 py-2.5 text-right font-num" style={{ color: 'var(--color-danger)' }}>{t.jenis === 'keluar' ? fmtIDR(t.jumlah) : ''}</td>
                    <td className="px-5 py-2.5 text-right font-num font-medium">{fmtIDR(t.saldo)}</td>
                    <td className="px-5 py-2.5 text-right">
                      {t.sumber === 'manual' ? (
                        <button onClick={() => setConfirmDelete(t)} className="p-1.5 rounded-lg hover:bg-black/5" style={{ color: 'var(--color-danger)' }}><Trash2 size={15} /></button>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Hapus Transaksi"
        footer={<><Button variant="secondary" onClick={() => setConfirmDelete(null)}>Batal</Button><Button variant="danger" onClick={() => { deleteCashTx(confirmDelete.id); setConfirmDelete(null); }}>Hapus</Button></>}
      >
        <p className="text-sm">Yakin ingin menghapus transaksi <strong>{confirmDelete?.kategori}</strong> sebesar <strong>{confirmDelete && fmtIDR(confirmDelete.jumlah)}</strong>?</p>
      </Modal>
    </div>
  );
}

/* ============================================================
   LAPORAN KEUANGAN (REPORTS)
   ============================================================ */
const REPORT_TABS = [
  { id: 'shu', label: 'Hasil Usaha (SHU)' },
  { id: 'neraca', label: 'Neraca' },
  { id: 'kas', label: 'Buku Kas' },
  { id: 'simpanan', label: 'Laporan Simpanan' },
  { id: 'pinjaman', label: 'Laporan Pinjaman' },
];

function PeriodFilter({ start, end, setStart, setEnd }) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-4 no-print">
      <Field label="Dari Tanggal"><input type="date" className="input-field" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
      <Field label="Sampai Tanggal"><input type="date" className="input-field" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
    </div>
  );
}

function ReportLetterhead({ data }) {
  return (
    <div className="print-only mb-4 text-center">
      <h2 className="font-display text-xl font-bold">{data.settings.nama}</h2>
      <p className="text-sm">{data.settings.alamat}</p>
      {data.settings.badanHukum && <p className="text-xs">No. Badan Hukum: {data.settings.badanHukum}</p>}
      <div className="border-b-2 mt-2" style={{ borderColor: 'var(--color-text)' }}></div>
    </div>
  );
}

function ShuReport({ data, start, end, setStart, setEnd }) {
  const filtered = data.cashTx.filter((t) => t.tanggal >= start && t.tanggal <= end);
  const jasaPinjaman = data.loanPayments.filter((p) => p.tanggal >= start && p.tanggal <= end).reduce((s, p) => s + Number(p.bunga || 0), 0);

  const pendapatanLain = {};
  filtered.filter((t) => t.sumber === 'manual' && t.jenis === 'masuk').forEach((t) => { pendapatanLain[t.kategori] = (pendapatanLain[t.kategori] || 0) + t.jumlah; });
  const beban = {};
  filtered.filter((t) => t.sumber === 'manual' && t.jenis === 'keluar').forEach((t) => { beban[t.kategori] = (beban[t.kategori] || 0) + t.jumlah; });

  const totalPendapatanLain = Object.values(pendapatanLain).reduce((a, b) => a + b, 0);
  const totalPendapatan = jasaPinjaman + totalPendapatanLain;
  const totalBeban = Object.values(beban).reduce((a, b) => a + b, 0);
  const shu = totalPendapatan - totalBeban;

  return (
    <Card>
      <PeriodFilter start={start} end={end} setStart={setStart} setEnd={setEnd} />
      <h3 className="font-display text-lg font-semibold mb-1">Perhitungan Hasil Usaha (SHU)</h3>
      <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>Periode {fmtDate(start)} – {fmtDate(end)}</p>

      <table className="w-full text-sm mb-4">
        <tbody>
          <tr><td className="py-1.5 font-semibold" colSpan={2}>Pendapatan</td></tr>
          <tr><td className="py-1 pl-4">Pendapatan Jasa Pinjaman</td><td className="py-1 text-right font-num">{fmtIDR(jasaPinjaman)}</td></tr>
          {Object.entries(pendapatanLain).map(([k, v]) => (
            <tr key={k}><td className="py-1 pl-4">{k}</td><td className="py-1 text-right font-num">{fmtIDR(v)}</td></tr>
          ))}
          <tr className="border-t" style={{ borderColor: 'var(--color-border)' }}><td className="py-1.5 font-medium pl-4">Total Pendapatan</td><td className="py-1.5 text-right font-num font-medium">{fmtIDR(totalPendapatan)}</td></tr>

          <tr><td className="py-1.5 pt-4 font-semibold" colSpan={2}>Beban</td></tr>
          {Object.keys(beban).length === 0 && (
            <tr><td className="py-1 pl-4 text-sm" colSpan={2} style={{ color: 'var(--color-text-muted)' }}>Tidak ada beban tercatat pada periode ini.</td></tr>
          )}
          {Object.entries(beban).map(([k, v]) => (
            <tr key={k}><td className="py-1 pl-4">{k}</td><td className="py-1 text-right font-num">{fmtIDR(v)}</td></tr>
          ))}
          <tr className="border-t" style={{ borderColor: 'var(--color-border)' }}><td className="py-1.5 font-medium pl-4">Total Beban</td><td className="py-1.5 text-right font-num font-medium">{fmtIDR(totalBeban)}</td></tr>
        </tbody>
      </table>
      <div className="flex justify-between items-center rounded-xl p-4" style={{ background: shu >= 0 ? 'var(--color-success-bg)' : 'var(--color-danger-bg)' }}>
        <span className="font-display font-semibold">Sisa Hasil Usaha (SHU) Periode Ini</span>
        <span className="font-num text-xl font-semibold" style={{ color: shu >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{fmtIDR(shu)}</span>
      </div>
      <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>
        SHU dihitung dari pendapatan jasa pinjaman dan pendapatan lain dikurangi beban operasional pada periode yang dipilih. Pembagian SHU kepada anggota (jasa modal, jasa usaha, dana pengurus, dll.) ditetapkan melalui Rapat Anggota Tahunan (RAT) sesuai AD/ART koperasi.
      </p>
    </Card>
  );
}

function NeracaReport({ data, date, setDate }) {
  const cashTxUpTo = data.cashTx.filter((t) => t.tanggal <= date);
  const masuk = cashTxUpTo.filter((t) => t.jenis === 'masuk').reduce((s, t) => s + t.jumlah, 0);
  const keluar = cashTxUpTo.filter((t) => t.jenis === 'keluar').reduce((s, t) => s + t.jumlah, 0);
  const kas = Number(data.settings.modalAwal || 0) + masuk - keluar;

  const loansUpTo = data.loans.filter((l) => l.tanggal <= date);
  const paymentsUpTo = data.loanPayments.filter((p) => p.tanggal <= date);
  const totalPencairan = loansUpTo.reduce((s, l) => s + Number(l.jumlah), 0);
  const totalAngsuranPokok = paymentsUpTo.reduce((s, p) => s + Number(p.pokok), 0);
  const piutang = Math.max(totalPencairan - totalAngsuranPokok, 0);

  const savingsUpTo = data.savingsTx.filter((t) => t.tanggal <= date);
  let pokok = 0, wajib = 0, sukarela = 0;
  savingsUpTo.forEach((t) => {
    const sign = t.aksi === 'setor' ? 1 : -1;
    if (t.jenis === 'pokok') pokok += sign * t.jumlah;
    else if (t.jenis === 'wajib') wajib += sign * t.jumlah;
    else sukarela += sign * t.jumlah;
  });

  const totalBungaUpTo = paymentsUpTo.reduce((s, p) => s + Number(p.bunga), 0);
  const pendapatanLainUpTo = cashTxUpTo.filter((t) => t.sumber === 'manual' && t.jenis === 'masuk').reduce((s, t) => s + t.jumlah, 0);
  const bebanUpTo = cashTxUpTo.filter((t) => t.sumber === 'manual' && t.jenis === 'keluar').reduce((s, t) => s + t.jumlah, 0);
  const shuUpTo = totalBungaUpTo + pendapatanLainUpTo - bebanUpTo;

  const totalAktiva = kas + piutang;
  const totalPasiva = pokok + wajib + sukarela + Number(data.settings.modalAwal || 0) + shuUpTo;
  const balanced = Math.abs(totalAktiva - totalPasiva) < 1;

  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4 no-print">
        <Field label="Neraca per Tanggal"><input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <h3 className="font-display text-lg font-semibold mb-1">Neraca (Laporan Posisi Keuangan)</h3>
      <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>Per tanggal {fmtDate(date)}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-semibold mb-2">Aktiva</h4>
          <table className="w-full text-sm">
            <tbody>
              <tr><td className="py-1">Kas</td><td className="py-1 text-right font-num">{fmtIDR(kas)}</td></tr>
              <tr><td className="py-1">Piutang Pinjaman Anggota</td><td className="py-1 text-right font-num">{fmtIDR(piutang)}</td></tr>
              <tr className="border-t font-semibold" style={{ borderColor: 'var(--color-border)' }}><td className="py-1.5">Total Aktiva</td><td className="py-1.5 text-right font-num">{fmtIDR(totalAktiva)}</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h4 className="font-semibold mb-2">Pasiva (Kewajiban &amp; Ekuitas)</h4>
          <table className="w-full text-sm">
            <tbody>
              <tr><td className="py-1">Simpanan Pokok</td><td className="py-1 text-right font-num">{fmtIDR(pokok)}</td></tr>
              <tr><td className="py-1">Simpanan Wajib</td><td className="py-1 text-right font-num">{fmtIDR(wajib)}</td></tr>
              <tr><td className="py-1">Simpanan Sukarela</td><td className="py-1 text-right font-num">{fmtIDR(sukarela)}</td></tr>
              <tr><td className="py-1">Modal Awal / Cadangan</td><td className="py-1 text-right font-num">{fmtIDR(data.settings.modalAwal)}</td></tr>
              <tr><td className="py-1">SHU (Akumulasi)</td><td className="py-1 text-right font-num">{fmtIDR(shuUpTo)}</td></tr>
              <tr className="border-t font-semibold" style={{ borderColor: 'var(--color-border)' }}><td className="py-1.5">Total Pasiva</td><td className="py-1.5 text-right font-num">{fmtIDR(totalPasiva)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-4 text-xs flex items-center gap-1.5 rounded-lg p-2.5" style={{ background: balanced ? 'var(--color-success-bg)' : 'var(--color-danger-bg)', color: balanced ? 'var(--color-success)' : 'var(--color-danger)' }}>
        <Check size={14} /> Neraca {balanced ? 'seimbang' : 'tidak seimbang'} (selisih {fmtIDR(totalAktiva - totalPasiva)}).
      </div>
    </Card>
  );
}

function CashReport({ data, start, end, setStart, setEnd }) {
  const sorted = [...data.cashTx].sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.id.localeCompare(b.id));
  let saldo = Number(data.settings.modalAwal || 0);
  sorted.filter((t) => t.tanggal < start).forEach((t) => { saldo += t.jenis === 'masuk' ? t.jumlah : -t.jumlah; });
  const saldoAwal = saldo;
  const rows = sorted.filter((t) => t.tanggal >= start && t.tanggal <= end).map((t) => {
    saldo += t.jenis === 'masuk' ? t.jumlah : -t.jumlah;
    return { ...t, saldo };
  });
  const totalMasuk = rows.reduce((s, t) => s + (t.jenis === 'masuk' ? t.jumlah : 0), 0);
  const totalKeluar = rows.reduce((s, t) => s + (t.jenis === 'keluar' ? t.jumlah : 0), 0);

  return (
    <Card>
      <PeriodFilter start={start} end={end} setStart={setStart} setEnd={setEnd} />
      <h3 className="font-display text-lg font-semibold mb-1">Buku Kas</h3>
      <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>Periode {fmtDate(start)} – {fmtDate(end)}</p>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
              <th className="py-2">Tanggal</th><th className="py-2">Uraian</th><th className="py-2 text-right">Masuk</th><th className="py-2 text-right">Keluar</th><th className="py-2 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
              <td className="py-1.5" colSpan={4}>Saldo Awal Periode</td>
              <td className="py-1.5 text-right font-num font-medium">{fmtIDR(saldoAwal)}</td>
            </tr>
            {rows.map((t) => (
              <tr key={t.id} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                <td className="py-1.5 whitespace-nowrap">{fmtDate(t.tanggal)}</td>
                <td className="py-1.5">{t.kategori}</td>
                <td className="py-1.5 text-right font-num">{t.jenis === 'masuk' ? fmtIDR(t.jumlah) : ''}</td>
                <td className="py-1.5 text-right font-num">{t.jenis === 'keluar' ? fmtIDR(t.jumlah) : ''}</td>
                <td className="py-1.5 text-right font-num">{fmtIDR(t.saldo)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold border-t-2" style={{ borderColor: 'var(--color-text)' }}>
              <td className="py-2" colSpan={2}>Total Periode</td>
              <td className="py-2 text-right font-num">{fmtIDR(totalMasuk)}</td>
              <td className="py-2 text-right font-num">{fmtIDR(totalKeluar)}</td>
              <td className="py-2 text-right font-num">{fmtIDR(saldo)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {rows.length === 0 && <p className="text-sm mt-3" style={{ color: 'var(--color-text-muted)' }}>Tidak ada transaksi pada periode ini.</p>}
    </Card>
  );
}

function SavingsReport({ data, totals }) {
  return (
    <Card>
      <h3 className="font-display text-lg font-semibold mb-1">Laporan Simpanan Anggota</h3>
      <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>Posisi simpanan seluruh anggota per {fmtDate(todayISO())}</p>
      {data.members.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Belum ada data anggota.</p>
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                <th className="py-2">No</th><th className="py-2">Nama Anggota</th><th className="py-2 text-right">Pokok</th><th className="py-2 text-right">Wajib</th><th className="py-2 text-right">Sukarela</th><th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => {
                const s = totals.simpananByMember[m.id];
                return (
                  <tr key={m.id} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="py-1.5">{m.noAnggota}</td>
                    <td className="py-1.5">{m.nama}</td>
                    <td className="py-1.5 text-right font-num">{fmtIDR(s.pokok)}</td>
                    <td className="py-1.5 text-right font-num">{fmtIDR(s.wajib)}</td>
                    <td className="py-1.5 text-right font-num">{fmtIDR(s.sukarela)}</td>
                    <td className="py-1.5 text-right font-num font-semibold">{fmtIDR(s.total)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold border-t-2" style={{ borderColor: 'var(--color-text)' }}>
                <td className="py-2" colSpan={2}>Total</td>
                <td className="py-2 text-right font-num">{fmtIDR(data.members.reduce((s, m) => s + totals.simpananByMember[m.id].pokok, 0))}</td>
                <td className="py-2 text-right font-num">{fmtIDR(data.members.reduce((s, m) => s + totals.simpananByMember[m.id].wajib, 0))}</td>
                <td className="py-2 text-right font-num">{fmtIDR(data.members.reduce((s, m) => s + totals.simpananByMember[m.id].sukarela, 0))}</td>
                <td className="py-2 text-right font-num">{fmtIDR(totals.totalSimpanan)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}

function LoansReport({ data, totals }) {
  const memberName = (id) => data.members.find((m) => m.id === id)?.nama || '-';
  return (
    <Card>
      <h3 className="font-display text-lg font-semibold mb-1">Laporan Pinjaman Anggota</h3>
      <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>Status pinjaman seluruh anggota per {fmtDate(todayISO())}</p>
      {data.loans.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Belum ada data pinjaman.</p>
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                <th className="py-2">Nama Anggota</th><th className="py-2">Tgl Pencairan</th><th className="py-2 text-right">Plafon</th><th className="py-2 text-right">Pokok Terbayar</th><th className="py-2 text-right">Jasa Diterima</th><th className="py-2 text-right">Sisa</th><th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {[...data.loans].sort((a, b) => b.tanggal.localeCompare(a.tanggal)).map((l) => {
                const info = totals.loanInfo[l.id];
                return (
                  <tr key={l.id} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="py-1.5">{memberName(l.memberId)}</td>
                    <td className="py-1.5">{fmtDate(l.tanggal)}</td>
                    <td className="py-1.5 text-right font-num">{fmtIDR(l.jumlah)}</td>
                    <td className="py-1.5 text-right font-num">{fmtIDR(info.pokok)}</td>
                    <td className="py-1.5 text-right font-num">{fmtIDR(info.bunga)}</td>
                    <td className="py-1.5 text-right font-num">{fmtIDR(info.sisa)}</td>
                    <td className="py-1.5"><Badge tone={info.lunas ? 'success' : 'accent'}>{info.lunas ? 'Lunas' : 'Berjalan'}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold border-t-2" style={{ borderColor: 'var(--color-text)' }}>
                <td className="py-2" colSpan={2}>Total</td>
                <td className="py-2 text-right font-num">{fmtIDR(data.loans.reduce((s, l) => s + l.jumlah, 0))}</td>
                <td className="py-2 text-right font-num">{fmtIDR(data.loans.reduce((s, l) => s + totals.loanInfo[l.id].pokok, 0))}</td>
                <td className="py-2 text-right font-num">{fmtIDR(data.loans.reduce((s, l) => s + totals.loanInfo[l.id].bunga, 0))}</td>
                <td className="py-2 text-right font-num">{fmtIDR(totals.totalPiutang)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}

function ReportsTab({ data, totals }) {
  const [tab, setTab] = useState('shu');
  const [periodStart, setPeriodStart] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); });
  const [periodEnd, setPeriodEnd] = useState(todayISO());
  const [neracaDate, setNeracaDate] = useState(todayISO());

  return (
    <div>
      <PageHeader title="Laporan Keuangan" description="Laporan otomatis berdasarkan transaksi yang tercatat." action={<Button icon={Printer} variant="secondary" onClick={() => window.print()}>Cetak</Button>} />
      <div className="flex gap-2 overflow-x-auto scrollbar-thin mb-5 no-print pb-1">
        {REPORT_TABS.map((rt) => (
          <button
            key={rt.id}
            onClick={() => setTab(rt.id)}
            className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors"
            style={tab === rt.id ? { background: 'var(--color-primary)', color: '#fff' } : { background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
          >
            {rt.label}
          </button>
        ))}
      </div>

      <ReportLetterhead data={data} />
      {tab === 'shu' && <ShuReport data={data} start={periodStart} end={periodEnd} setStart={setPeriodStart} setEnd={setPeriodEnd} />}
      {tab === 'neraca' && <NeracaReport data={data} date={neracaDate} setDate={setNeracaDate} />}
      {tab === 'kas' && <CashReport data={data} start={periodStart} end={periodEnd} setStart={setPeriodStart} setEnd={setPeriodEnd} />}
      {tab === 'simpanan' && <SavingsReport data={data} totals={totals} />}
      {tab === 'pinjaman' && <LoansReport data={data} totals={totals} />}
    </div>
  );
}

/* ============================================================
   PENGATURAN (SETTINGS)
   ============================================================ */
function SettingsTab({ data, updateSettings, resetAll }) {
  const [form, setForm] = useState({ ...data.settings });
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const save = () => {
    updateSettings({ nama: form.nama, alamat: form.alamat, badanHukum: form.badanHukum, modalAwal: Number(form.modalAwal) || 0 });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <PageHeader title="Pengaturan" description="Atur identitas koperasi dan modal awal kas." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-display font-semibold mb-4">Identitas Koperasi</h3>
          <div className="space-y-3">
            <Field label="Nama Koperasi"><input className="input-field" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} /></Field>
            <Field label="Alamat"><textarea className="textarea-field" rows={2} value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} /></Field>
            <Field label="No. Badan Hukum (opsional)"><input className="input-field" value={form.badanHukum} onChange={(e) => setForm({ ...form, badanHukum: e.target.value })} placeholder="Contoh: 123/BH/XII/2024" /></Field>
            <Field label="Modal Awal / Saldo Kas Awal (Rp)" hint="Digunakan sebagai titik awal perhitungan saldo kas dan ekuitas pada Neraca.">
              <input type="number" min="0" className="input-field font-num" value={form.modalAwal} onChange={(e) => setForm({ ...form, modalAwal: e.target.value })} />
            </Field>
            <div className="flex items-center gap-3">
              <Button onClick={save}>Simpan Pengaturan</Button>
              {saved && <span className="text-sm flex items-center gap-1" style={{ color: 'var(--color-success)' }}><Check size={15} /> Tersimpan</span>}
            </div>
          </div>
        </Card>
        <Card>
          <h3 className="font-display font-semibold mb-4">Ringkasan Data</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span style={{ color: 'var(--color-text-muted)' }}>Jumlah Anggota</span><span className="font-num font-medium">{data.members.length}</span></li>
            <li className="flex justify-between"><span style={{ color: 'var(--color-text-muted)' }}>Transaksi Simpanan</span><span className="font-num font-medium">{data.savingsTx.length}</span></li>
            <li className="flex justify-between"><span style={{ color: 'var(--color-text-muted)' }}>Pinjaman Tercatat</span><span className="font-num font-medium">{data.loans.length}</span></li>
            <li className="flex justify-between"><span style={{ color: 'var(--color-text-muted)' }}>Transaksi Kas</span><span className="font-num font-medium">{data.cashTx.length}</span></li>
          </ul>
          <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-danger)' }}>Zona Berbahaya</p>
            <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>Menghapus seluruh data akan mengembalikan aplikasi ke kondisi awal dan tidak dapat dibatalkan.</p>
            <Button variant="danger" onClick={() => setConfirmReset(true)}>Hapus Semua Data</Button>
          </div>
        </Card>
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Hapus Semua Data"
        footer={<><Button variant="secondary" onClick={() => setConfirmReset(false)}>Batal</Button><Button variant="danger" onClick={() => { resetAll(); setConfirmReset(false); }}>Ya, Hapus Semua</Button></>}
      >
        <p className="text-sm">Tindakan ini akan menghapus seluruh data anggota, simpanan, pinjaman, dan transaksi kas secara permanen. Lanjutkan?</p>
      </Modal>
    </div>
  );
}
