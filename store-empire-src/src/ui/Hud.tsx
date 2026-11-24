import { useEffect, useState } from 'react';
import { onWorldEvent } from '../game';
import { CAREER_TITLES } from '../sim/world';
import { useHud } from './hudStore';

type Tab = 'store' | 'tasks' | 'staff' | 'me' | 'biz';
const TABS: { id: Tab; icon: string; label: string; lock?: string }[] = [
  { id: 'store', icon: '🏪', label: 'Store' },
  { id: 'tasks', icon: '📋', label: 'Tasks' },
  { id: 'staff', icon: '👥', label: 'Staff', lock: 'Mở khi lên Trưởng nhóm' },
  { id: 'me', icon: '🧑', label: 'Me' },
  { id: 'biz', icon: '💼', label: 'Business', lock: 'Mở khi làm chủ cửa hàng' },
];
const DEBUG = new URLSearchParams(location.search).has('debug');

export function Hud() {
  const h = useHud();
  const [tab, setTab] = useState<Tab>('store');
  const [toast, setToast] = useState<{ text: string; k: number } | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);

  useEffect(() => onWorldEvent(e => {
    if (e.type === 'toast') setToast({ text: e.text, k: Date.now() });
    if (e.type === 'levelup') setLevelUp(e.level);
  }), []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2200); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (!levelUp) return; const t = setTimeout(() => setLevelUp(null), 2200); return () => clearTimeout(t); }, [levelUp]);

  const pickTab = (t: typeof TABS[number]) => {
    if (t.lock) { setToast({ text: `🔒 ${t.lock}`, k: Date.now() }); return; }
    setTab(cur => (cur === t.id || t.id === 'store' ? 'store' : t.id));
  };

  const objective = h.carrying ? 'Mang thùng hàng tới kệ đang thiếu'
    : h.tasks.length ? `${h.tasks[0].text} · lấy hàng ở kho` : 'Kệ đầy đủ. Đi quanh cửa hàng và phục vụ khách';

  return (
    <div className="hud">
      <header className="topbar">
        <a className="back" href="../index.html" aria-label="Về trang chủ">‹</a>
        <div className="lvl"><b>{h.level}</b></div>
        <div className="who">
          <div className="title">{h.title}</div>
          <div className="xpbar"><i style={{ width: `${(h.xp / h.xpNext) * 100}%` }} /></div>
        </div>
        <div className="cash">💵 <b>${h.cash}</b></div>
      </header>

      <div className="objective"><span className="dot" />{objective}</div>
      <div className="storechip">🛒 ${h.revenue} · 😊 {h.satisfaction}%</div>
      {DEBUG && <div className="fps">{h.fps} fps</div>}

      {toast && <div className="toast" key={toast.k}>{toast.text}</div>}
      {levelUp && (
        <div className="levelup" key={levelUp}>
          <div className="burst">⭐</div>
          <div><small>LEVEL UP</small><b>Level {levelUp}</b></div>
        </div>
      )}

      {tab === 'tasks' && (
        <section className="sheet">
          <div className="grab" />
          <h3>Nhiệm vụ</h3>
          {h.tasks.length === 0 && <p className="muted">Không có việc gấp. Kệ đang đầy hàng.</p>}
          <ul className="tasklist">
            {h.tasks.map(t => <li key={t.id}><span>📦</span>{t.text}<small>+12 XP · $3</small></li>)}
          </ul>
          <div className="stats">
            <div><b>{h.served}</b><small>khách đã thanh toán</small></div>
            <div><b>${h.revenue}</b><small>doanh thu cửa hàng</small></div>
          </div>
        </section>
      )}
      {tab === 'me' && (
        <section className="sheet">
          <div className="grab" />
          <h3>{h.title} · Level {h.level}</h3>
          <p className="muted">{h.xp} / {h.xpNext} XP tới level tiếp theo</p>
          <ol className="career">
            {CAREER_TITLES.map(t => <li key={t} className={t === h.title ? 'on' : ''}>{t}</li>)}
            <li className="later">Chủ cửa hàng</li>
            <li className="later">Tycoon</li>
          </ol>
        </section>
      )}

      <nav className="dock">
        {TABS.map(t => (
          <button key={t.id} className={`${tab === t.id ? 'on' : ''} ${t.lock ? 'locked' : ''}`} onClick={() => pickTab(t)}>
            <span className="ic">{t.icon}{t.lock && <i className="lock">🔒</i>}</span>
            <small>{t.label}</small>
          </button>
        ))}
      </nav>
    </div>
  );
}
