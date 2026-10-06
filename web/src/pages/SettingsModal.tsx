import { X } from 'lucide-react';
import { BOARD_THEMES, useSettings, type Settings } from '../lib/settings.tsx';
import { Sheet } from '../lib/ui.tsx';

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button className={`switch${on ? ' on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />;
}

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { s, set } = useSettings();
  return (
    <Sheet onClose={onClose} label="설정">
      <div className="row between" style={{ marginBottom: 4 }}>
        <h2>설정</h2>
        <button className="icon-btn" onClick={onClose} aria-label="닫기"><X /></button>
      </div>
      <div className="setting" style={{ flexWrap: 'wrap' }}>
        <div><b>화면</b><span>어두운 화면은 눈이 덜 피로해요</span></div>
        <div className="seg">
          {([['dark', '어둡게'], ['light', '밝게'], ['system', '기기 설정']] as Array<[Settings['theme'], string]>).map(([v, l]) => (
            <button key={v} className={s.theme === v ? 'on' : ''} onClick={() => set({ theme: v })}>{l}</button>
          ))}
        </div>
      </div>
      <div className="setting" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 10 }}>
        <div><b>보드 색</b><span>{BOARD_THEMES.find((b) => b.id === s.board)?.name}</span></div>
        <div className="swatches">
          {BOARD_THEMES.map((b) => (
            <button key={b.id} className={`swatch${s.board === b.id ? ' on' : ''}`} title={b.name} aria-label={b.name} onClick={() => set({ board: b.id })}>
              <span style={{ background: b.light }} /><span style={{ background: b.dark }} /><span style={{ background: b.dark }} /><span style={{ background: b.light }} />
            </button>
          ))}
        </div>
      </div>
      <div className="setting"><div><b>효과음과 진동</b><span>수를 두거나 카드를 쓸 때 알려 줘요</span></div><Toggle label="효과음과 진동" on={s.sound} onChange={(v) => set({ sound: v })} /></div>
      <div className="setting"><div><b>좌표 표시</b><span>보드 가장자리에 a~h, 1~8을 보여 줘요</span></div><Toggle label="좌표" on={s.coords} onChange={(v) => set({ coords: v })} /></div>
      <div className="setting"><div><b>기물 애니메이션</b><span>기물이 부드럽게 미끄러져요</span></div><Toggle label="애니메이션" on={s.animate} onChange={(v) => set({ animate: v })} /></div>
      <div className="setting"><div><b>튜토리얼 안내</b><span>다음에 누를 곳을 반짝이며 알려 줘요</span></div><Toggle label="튜토리얼 안내" on={s.guide} onChange={(v) => set({ guide: v })} /></div>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>PC 단축키: ← → 기보 이동 · F 판 뒤집기 · 마우스 오른쪽 드래그로 화살표 그리기</p>
    </Sheet>
  );
}

