import { useEffect, useState, type ReactNode } from 'react';
import { APP_NAME } from '../brand.ts';
import { api } from '../lib/api.ts';
import { Link } from '../lib/router.tsx';

const EFFECTIVE = '2026년 10월 7일';

let contactCache: string | null | undefined;
/** Operator contact address, configured on the server (CONTACT_EMAIL). */
export function useContact(): string | null {
  const [c, setC] = useState<string | null>(contactCache ?? null);
  useEffect(() => {
    if (contactCache !== undefined) return;
    api<{ contact?: string | null }>('/api/health')
      .then((h) => { contactCache = h.contact ?? null; setC(contactCache); })
      .catch(() => {});
  }, []);
  return c;
}

function Doc({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="page narrow legal">
      <div className="head">
        <div className="eyebrow">{APP_NAME}</div>
        <h1>{title}</h1>
        <p>시행일 {EFFECTIVE}</p>
      </div>
      {children}
      <nav className="legal-nav">
        <Link to="/privacy">개인정보처리방침</Link>
        <Link to="/terms">이용약관</Link>
        <Link to="/licenses">오픈소스 라이선스</Link>
      </nav>
    </div>
  );
}

function ContactLine() {
  const contact = useContact();
  return contact
    ? <>문의 메일 <a href={`mailto:${contact}`}>{contact}</a>로 연락해 주세요.</>
    : <>앱의 운영자에게 연락해 주세요.</>;
}

export function Privacy() {
  return (
    <Doc title="개인정보처리방침">
      <p>{APP_NAME}(이하 “서비스”)은 이용자의 개인정보를 소중히 다루며, 「개인정보 보호법」 등 관련 법령을 지킵니다. 서비스는 게임에 꼭 필요한 최소한의 정보만 처리합니다.</p>

      <h2>1. 처리하는 개인정보</h2>
      <table className="legal-table">
        <thead><tr><th>구분</th><th>항목</th><th>목적</th></tr></thead>
        <tbody>
          <tr><td>회원가입</td><td>아이디, 비밀번호</td><td>회원 식별, 로그인</td></tr>
          <tr><td>서비스 이용</td><td>대국 기록(수순, 사용한 카드, 결과, 일시), 레이팅, 친구 관계</td><td>대국 진행, 기보 다시 보기, 랭킹, 친구 대국, 카드 밸런스 조정</td></tr>
          <tr><td>자동 처리</td><td>접속 IP 주소</td><td>로그인 시도 횟수 제한(무차별 대입 방지)</td></tr>
        </tbody>
      </table>
      <p>이름, 이메일, 전화번호, 위치 정보는 받지 않습니다. 비밀번호는 되돌릴 수 없는 방식(scrypt)으로 암호화해 저장하므로, 운영자도 알 수 없습니다. IP 주소는 서버 메모리에서 잠시 쓰고 저장하지 않습니다.</p>

      <h2>2. 보유 기간과 파기</h2>
      <p>개인정보는 회원 탈퇴 때까지 보관합니다. 탈퇴하면 비밀번호, 로그인 기록, 레이팅, 친구 관계를 바로 지웁니다. 상대방의 기보를 보존하기 위해 지난 대국 기록은 남지만, 아이디는 “(탈퇴번호)” 형태로 바뀌어 누구인지 알 수 없게 됩니다. 탈퇴한 아이디는 다른 사람이 새로 가입할 때 쓸 수 있습니다.</p>

      <h2>3. 제3자 제공과 처리 위탁</h2>
      <p>개인정보를 제3자에게 제공하거나 판매하지 않습니다. 광고, 분석 도구, 추적 쿠키를 쓰지 않습니다. 서버는 운영자가 직접 관리하는 서버에서 운영합니다.</p>

      <h2>4. 이 기기에 저장되는 정보</h2>
      <p>로그인 상태(접속 토큰), 설정, 튜토리얼 진행도, 진행 중인 AI 대국은 이용자의 기기(브라우저 저장소)에만 저장되며 서버로 보내지 않습니다. 브라우저 데이터를 지우거나 앱을 삭제하면 함께 지워집니다.</p>

      <h2>5. 이용자의 권리</h2>
      <p>이용자는 언제든지 자신의 정보를 확인하고 삭제할 수 있습니다. 내 정보는 프로필 화면에서 볼 수 있고, <b>프로필 → 계정 삭제</b>에서 비밀번호를 입력하면 바로 탈퇴할 수 있습니다. 그 밖의 열람, 정정, 처리 정지 요청은 아래 연락처로 보내 주세요.</p>

      <h2>6. 안전성 확보 조치</h2>
      <p>비밀번호 암호화 저장, 로그인 시도 횟수 제한, 접속 토큰의 암호화 저장(해시)과 만료(60일), 데이터베이스 외부 접근 차단을 적용하고 있습니다.</p>

      <h2>7. 아동의 개인정보</h2>
      <p>서비스는 이름, 연락처 등 아동을 식별할 수 있는 정보를 받지 않습니다. 만 14세 미만 이용자는 보호자의 동의를 받고 가입해 주세요.</p>

      <h2>8. 개인정보 보호책임자와 문의</h2>
      <p>개인정보 관련 문의, 불만, 피해 구제는 <ContactLine /> 개인정보 침해에 대한 신고나 상담은 개인정보침해신고센터(국번 없이 118, privacy.kisa.or.kr)에도 할 수 있습니다.</p>

      <h2>9. 방침의 변경</h2>
      <p>이 방침이 바뀌면 시행 7일 전부터 서비스 안에서 알립니다.</p>
    </Doc>
  );
}

export function Terms() {
  return (
    <Doc title="이용약관">
      <h2>제1조 (목적)</h2>
      <p>이 약관은 {APP_NAME}(이하 “서비스”)의 이용 조건과 절차, 운영자와 이용자의 권리와 의무를 정합니다.</p>

      <h2>제2조 (서비스 내용)</h2>
      <p>서비스는 증강 카드를 더한 체스 게임을 무료로 제공합니다. AI 대국, 로컬 2인 대국, 튜토리얼, 카드 백과는 로그인 없이 쓸 수 있고, 온라인 대국, 레이팅, 친구 기능은 회원가입이 필요합니다.</p>

      <h2>제3조 (회원가입과 계정)</h2>
      <p>아이디와 비밀번호로 가입합니다. 계정과 비밀번호 관리 책임은 이용자에게 있으며, 다른 사람에게 계정을 넘기거나 빌려줄 수 없습니다. 욕설, 혐오 표현, 다른 사람을 사칭하는 아이디는 운영자가 바꾸거나 제한할 수 있습니다.</p>

      <h2>제4조 (공정한 대국)</h2>
      <p>다음 행위를 금지합니다. 위반하면 경고 없이 레이팅 초기화, 랭킹 제외, 이용 정지가 될 수 있습니다.</p>
      <ul>
        <li>대국 중에 체스 엔진, AI, 다른 사람의 도움을 받는 행위</li>
        <li>여러 계정을 만들어 일부러 지거나 이기게 하는 등 레이팅을 조작하는 행위</li>
        <li>서버 오류나 버그를 악용하거나, 서비스에 과도한 부하를 주는 행위</li>
        <li>다른 이용자를 괴롭히거나 불쾌감을 주는 행위</li>
      </ul>

      <h2>제5조 (서비스의 변경과 중단)</h2>
      <p>운영자는 카드의 효과, 게임 규칙, 레이팅 방식을 밸런스 개선을 위해 바꿀 수 있습니다. 새 시즌이 시작되면 레이팅이 조정됩니다. 점검이나 장애로 서비스가 잠시 멈출 수 있으며, 진행 중인 대국은 취소될 수 있습니다.</p>

      <h2>제6조 (탈퇴)</h2>
      <p>이용자는 프로필 화면에서 언제든지 탈퇴할 수 있습니다. 탈퇴 후의 정보 처리는 개인정보처리방침을 따릅니다.</p>

      <h2>제7조 (책임의 한계)</h2>
      <p>서비스는 무료로 “있는 그대로” 제공됩니다. 운영자는 고의나 중대한 과실이 없는 한, 서비스 중단, 데이터 손실, 레이팅 변동으로 생긴 손해를 책임지지 않습니다.</p>

      <h2>제8조 (약관의 변경)</h2>
      <p>약관이 바뀌면 시행 7일 전부터 서비스 안에서 알립니다. 바뀐 약관에 동의하지 않으면 탈퇴할 수 있습니다.</p>

      <h2>문의</h2>
      <p><ContactLine /></p>
    </Doc>
  );
}

export function Licenses() {
  return (
    <Doc title="오픈소스 라이선스">
      <p>{APP_NAME}은 아래의 오픈소스와 자료를 사용합니다. 카드의 이름과 효과, 카드 프레임, 앱 디자인은 이 프로젝트에서 직접 만들었습니다.</p>
      <div className="list" style={{ marginTop: 16 }}>
        <div className="kv" style={{ display: 'block' }}><b>체스 기물 그림</b><br />Colin M.L. Burnett (Cburnett), <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">CC BY-SA 3.0</a>. 특수 기물 배지는 이 그림을 조합해 만들었으며 같은 라이선스를 따릅니다.</div>
        <div className="kv" style={{ display: 'block' }}><b>카드 아이콘</b><br /><a href="https://game-icons.net" target="_blank" rel="noreferrer">game-icons.net</a> (Lorc, Delapouite 외), <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">CC BY 3.0</a></div>
        <div className="kv" style={{ display: 'block' }}><b>UI 아이콘</b><br /><a href="https://lucide.dev" target="_blank" rel="noreferrer">Lucide</a>, ISC License</div>
        <div className="kv" style={{ display: 'block' }}><b>글꼴</b><br /><a href="https://github.com/orioncactus/pretendard" target="_blank" rel="noreferrer">Pretendard</a>, SIL Open Font License 1.1</div>
        <div className="kv" style={{ display: 'block' }}><b>소프트웨어</b><br />React, Vite (MIT) · Capacitor (MIT) · ws (MIT) · node-postgres (MIT) · PostgreSQL (PostgreSQL License)</div>
        <div className="kv" style={{ display: 'block' }}><b>레이팅</b><br />Glicko-2 레이팅 방식, Mark E. Glickman</div>
      </div>
    </Doc>
  );
}
