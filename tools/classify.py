"""카드 설명을 키워드 규칙으로 효과 유형/리스크 태그로 분류한다.
usage: python3 -I tools/classify.py  (data/cards.json -> data/cards.classified.json, docs/classification.md)
휴리스틱이므로 결과는 사람이 검수할 후보 목록이다."""
import json, re, collections, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
cards = json.loads((root / 'data/cards.json').read_text(encoding='utf-8'))

TAGS = {
 'WIN_CONDITION': r'즉시 승리|승리합니다|패배하지 않|패배합니다|패배|게임에서 승리',
 'MOVE_RULE':     r'처럼 ?(도 )?움직|움직일 수|이동할 수|이동 방식|한 번 더 움직|점프|뛰어넘|행마법|앙파상|칸씩만|전진',
 'SUMMON':        r'소환',
 'CONVERT':       r'(으로|로) (변경|변환|바꿉|바꿔)|변경합니다|변환합니다|바꿉니다',
 'REMOVE':        r'제거|추방|희생|사라집니다|파괴',
 'CAPTURE_RULE':  r'잡을 수 없|잡지 못|잡을 때|잡으면|잡힌|잡히면|자동으로 잡',
 'PROTECT':       r'보호|막|진입할\s?수 없|도착하거나 배치될 수 없',
 'RANDOM':        r'무작위|랜덤|확률',
 'TIMED':         r'\d+수 (뒤|후|동안)|매 수|매 턴|다음 턴|다음 \d*수|이후',
 'BOARD_GLOBAL':  r'보드|파일|랭크|테두리|판 전체|모든 기물|모든 아군|양쪽|양측|모든 폰',
 'REUSE_COPY':    r'다시 사용|복제|되돌립니다|사용할 수 있게',
 'DISABLE':       r'움직이지 못|행동할 수 없|사용할 수 없|봉인|정지|얼어붙은',
 'RESOURCE':      r'골드|마나|HP|체력',
 'STATUS':        r'가호|회피|잠복|은신|빙결|얼립|얼어|금속화|고스트|상쇄|회귀|부여합니다|독',
 'HIDDEN_INFO':   r'비밀리|보이지 않|표시됩니다|지정합니다',
 'CONVERT_TEAM':  r'전향|내 편|내 기물이 됩니다|변신|승진|프로모션|행마법을 (습득|추가)|배웁니다',
 'PLACE':         r'설치|배치|벽|고속도로',
 'FORCE_MOVE':    r'반드시|강제|무작위 (합법 )?빈칸으로 이동|섞습니다',
 'TRANSPORT':     r'순간이동|위치를 (바꿉|교환)|교체|스왑|이동시킵니다',
}
def tag(c):
    d = c['description']; t = [k for k, p in TAGS.items() if re.search(p, d)]
    return t

risk_rules = {
 'INSTANT_WIN':  lambda c, t: bool(re.search(r'즉시 승리|즉시 게임에서 승리', c['description'])),
 'BOARD_RESET':  lambda c, t: 'BOARD_GLOBAL' in t and bool(re.search(r'모든[^.]{0,20}(제거|추방|바꿉|변경|변환)|전부', c['description'])),
 'HIGH_VARIANCE':lambda c, t: 'RANDOM' in t,
 'ANTI_COUNTERPLAY': lambda c, t: 'DISABLE' in t or 'INSTANT_WIN' in t,
 'DEPENDS_ON_OPPONENT': lambda c, t: 'REUSE_COPY' in t or '상대가' in c['description'] and '카드' in c['description'],
}
for c in cards:
    t = tag(c); c['tags'] = t
    c['risks'] = [k for k, f in risk_rules.items() if f(c, t + (['INSTANT_WIN'] if re.search(r'즉시 승리', c['description']) else []))]
    # 주 유형: 우선순위
    for k in ['WIN_CONDITION','SUMMON','CONVERT_TEAM','CONVERT','MOVE_RULE','FORCE_MOVE','DISABLE','REMOVE','CAPTURE_RULE','PROTECT','TRANSPORT','STATUS','HIDDEN_INFO','PLACE','REUSE_COPY','RESOURCE']:
        if k in t: c['primary'] = k; break
    else: c['primary'] = 'RULE_MOD' if c['category'] == 'RULE' else 'OTHER'
(root / 'data/cards.classified.json').write_text(json.dumps(cards, ensure_ascii=False, indent=1), encoding='utf-8')

prim = collections.Counter(c['primary'] for c in cards)
risk = collections.Counter(r for c in cards for r in c['risks'])
out = ['# 카드 효과 분류 (키워드 휴리스틱, 검수 필요)', '',
       '`tools/classify.py`가 설명문에서 자동 태깅한 결과. 정확한 구현 규칙은 알 수 없으므로 *후보 목록*으로 쓰고, 시뮬레이션 데이터로 확정한다.', '',
       '## 주 효과 유형 분포', '', '| 유형 | 장수 | 의미 |', '|---|---|---|']
mean = {'WIN_CONDITION':'승리/패배 조건 변경','SUMMON':'기물 소환','CONVERT':'기물 변환','MOVE_RULE':'이동 규칙 변경','REMOVE':'제거/추방/희생','CAPTURE_RULE':'포획 규칙 변경','PROTECT':'보호/금지 구역','TRANSPORT':'위치 이동/교환','DISABLE':'행동 봉인','REUSE_COPY':'카드 재사용/복제','RESOURCE':'자원(HP/골드/마나)','CONVERT_TEAM':'전향/변신/승진','FORCE_MOVE':'강제 이동/셔플','STATUS':'상태 부여(가호·잠복 등)','HIDDEN_INFO':'비공개 정보','PLACE':'장애물/구역 설치','RULE_MOD':'판 전체 규칙(RULE 카테고리)','OTHER':'기타'}
for k, n in prim.most_common(): out.append(f'| {k} | {n} | {mean.get(k,"")} |')
out += ['', '## 리스크 플래그', '', '| 플래그 | 장수 | 의미 |', '|---|---|---|']
rm = {'INSTANT_WIN':'즉승 조건','BOARD_RESET':'판 전체를 갈아엎음','HIGH_VARIANCE':'무작위 요소','ANTI_COUNTERPLAY':'봉인/즉승 등 대응 수단 부족 가능','DEPENDS_ON_OPPONENT':'상대 카드·상태에 가치가 좌우됨'}
for k, n in risk.most_common(): out.append(f'| {k} | {n} | {rm[k]} |')
for r in ['INSTANT_WIN','BOARD_RESET','ANTI_COUNTERPLAY','HIGH_VARIANCE','DEPENDS_ON_OPPONENT']:
    out += ['', f'### {r} 후보', '', '| 카드 | ★ | 카테고리 | 효과 |', '|---|---|---|---|']
    for c in sorted([c for c in cards if r in c['risks']], key=lambda c: -c['stars']):
        out.append(f"| {c['name']} | {c['stars'] or '-'} | {c['category']} | {c['description'].replace('|','\\|')} |")
(root / 'docs/classification.md').write_text('\n'.join(out), encoding='utf-8')
print(prim.most_common()); print(risk.most_common())
print('OTHER sample:', [c['name'] for c in cards if c['primary']=='OTHER'][:15])
