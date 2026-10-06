import { BOARD_THEMES, useSettings, type Settings } from '../lib/settings.tsx';

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button className={`switch${on ? ' on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />;
}

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { s, set } = useSettings();
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="row between" style={{ marginBottom: 6 }}>
          <h2 id="settings-title">설정</h2>
          <button className="btn ghost sm" onClick={onClose}>닫기</button>
        </div>
        <div>
          <div className="setting">
            <div><b>화면 테마</b><span>어두운 화면은 눈이 덜 피로해요.</span></div>
            <div className="seg">
              {([['dark', '어둡게'], ['light', '밝게'], ['system', '기기 설정']] as Array<[Settings['theme'], string]>).map(([v, l]) => (
                <button key={v} className={s.theme === v ? 'on' : ''} onClick={() => set({ theme: v })}>{l}</button>
              ))}
            </div>
          </div>
          <div className="setting" style={{ alignItems: 'flex-start', flexDirection: 'column' }}>
            <div><b>보드 색</b><span>{BOARD_THEMES.find((b) => b.id === s.board)?.name}</span></div>
            <div className="board-swatches">
              {BOARD_THEMES.map((b) => (
                <button key={b.id} className={`swatch${s.board === b.id ? ' on' : ''}`} title={b.name} aria-label={b.name} onClick={() => set({ board: b.id })}>
                  <span style={{ background: b.light }} /><span style={{ background: b.dark }} /><span style={{ background: b.dark }} /><span style={{ background: b.light }} />
                </button>
              ))}
            </div>
          </div>
          <div className="setting"><div><b>효과음</b><span>수를 둘 때, 카드를 쓸 때 소리를 내요.</span></div><Toggle label="효과음" on={s.sound} onChange={(v) => set({ sound: v })} /></div>
          <div className="setting"><div><b>좌표 표시</b><span>보드 가장자리에 a~h, 1~8을 보여 줘요.</span></div><Toggle label="좌표" on={s.coords} onChange={(v) => set({ coords: v })} /></div>
          <div className="setting"><div><b>기물 애니메이션</b><span>기물이 미끄러지듯 움직여요.</span></div><Toggle label="애니메이션" on={s.animate} onChange={(v) => set({ animate: v })} /></div>
          <div className="setting"><div><b>튜토리얼 안내 표시</b><span>다음에 누를 곳을 반짝이며 알려 줘요.</span></div><Toggle label="튜토리얼 안내" on={s.guide} onChange={(v) => set({ guide: v })} /></div>
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>단축키: ← → 기보 이동 · F 판 뒤집기 · 우클릭 드래그 화살표 그리기 (Shift 빨강 · Alt 파랑 · Ctrl 노랑)</p>
      </div>
    </div>
  );
}
