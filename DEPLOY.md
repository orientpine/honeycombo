# HoneyCombo 배포 가이드

## 현재 상태

| 항목 | 상태 |
|------|------|
| GitHub Repo | ✅ https://github.com/orientpine/honeycombo |
| 코드 Push | ✅ master 브랜치 |
| 빌드 | ✅ 10 pages, 28/28 테스트 통과 |
| Cloudflare Pages | ✅ `honeycombo.orientpine.workers.dev` |
| Giscus 댓글 | ⬜ 설정 필요 |
| GitHub OAuth (CMS) | ⬜ 설정 필요 |

---

## 1단계: Cloudflare Pages 연결

### 1-1. Cloudflare 계정 접속

- https://dash.cloudflare.com 접속 → 로그인

### 1-2. Pages 프로젝트 생성

1. 좌측 메뉴 **Workers & Pages** 클릭
2. **Create** 버튼 클릭
3. **Pages** 탭 선택
4. **Connect to Git** 클릭
5. **GitHub** 선택 → Cloudflare에 GitHub 권한 부여
6. **orientpine/honeycombo** 레포 선택
7. **Begin setup** 클릭

### 1-3. 빌드 설정

| 항목 | 값 |
|------|-----|
| Project name | `honeycombo` |
| Production branch | `master` |
| Framework preset | `None` (또는 `Astro` 선택 가능) |
| Build command | `bun run build` |
| Build output directory | `dist` |
| Root directory | `/` |

### 1-4. 환경 변수 (나중에 추가해도 됨)

| 변수 | 값 | 비고 |
|------|-----|------|
| `GITHUB_CLIENT_ID` | 4단계에서 생성 | Decap CMS용 |
| `GITHUB_CLIENT_SECRET` | 4단계에서 생성 | Encrypt 체크 |
| `NODE_VERSION` | `20` | 빌드 실패 시에만 추가 |

### 1-5. 배포

1. **Save and Deploy** 클릭
2. 빌드 로그에서 `10 page(s) built` 확인
3. 배포 완료 후 URL 확인: `https://honeycombo.orientpine.workers.dev`
4. 사이트 접속 → 홈페이지 렌더링 확인

> **참고**: Cloudflare Pages는 `bun`을 기본 지원합니다.

---

## 2단계: Giscus 댓글 설정

### 2-1. GitHub Discussions 활성화

1. https://github.com/orientpine/honeycombo/settings 접속
2. 아래로 스크롤 → **Features** 섹션
3. **Discussions** 체크박스 활성화
4. **Save** 클릭

### 2-2. Giscus 앱 설치

1. https://github.com/apps/giscus 접속
2. **Install** 클릭
3. `orientpine` 계정 선택
4. **Only select repositories** → `honeycombo` 선택
5. **Install** 클릭

### 2-3. Giscus 설정 생성

1. https://giscus.app 접속
2. 아래 설정 입력:

| 항목 | 값 |
|------|-----|
| Repository | `orientpine/honeycombo` |
| Page ↔️ Discussions Mapping | `pathname` |
| Discussion Category | `General` (또는 `Blog Comments` 카테고리 새로 생성) |
| Theme | `preferred_color_scheme` |
| Language | `ko` |

3. 페이지 하단에 생성된 `<script>` 태그에서 두 값을 복사:

```
data-repo-id="R_xxxxxxxxxx"       ← 이 값 복사
data-category-id="DIC_xxxxxxxxxx" ← 이 값 복사
```

### 2-4. 코드 업데이트

`src/components/Comments.astro` 파일 수정:

```diff
- data-repo-id=""
+ data-repo-id="R_xxxxxxxxxx"

- data-category-id=""
+ data-category-id="DIC_xxxxxxxxxx"
```

커밋 & 푸시:

```bash
git add src/components/Comments.astro
git commit -m "feat: configure giscus repo-id and category-id"
git push
```

Cloudflare Pages가 자동 재배포합니다.

---

## 3단계: GitHub OAuth App 생성 (Decap CMS용)

### 3-1. OAuth App 생성

1. https://github.com/settings/developers 접속
2. **OAuth Apps** 탭 클릭
3. **New OAuth App** 클릭
4. 정보 입력:

| 항목 | 값 |
|------|-----|
| Application name | `HoneyCombo CMS` |
| Homepage URL | `https://honeycombo.orientpine.workers.dev` |
| Application description | `HoneyCombo 큐레이션 CMS 인증` |
| Authorization callback URL | `https://honeycombo.orientpine.workers.dev/api/auth` |

5. **Register application** 클릭

### 3-2. 인증 정보 복사

1. 생성된 앱 페이지에서 **Client ID** 복사: `Iv1.xxxxx...`
2. **Generate a new client secret** 클릭
3. **Client Secret** 복사: `xxxxx...`

> ⚠️ **중요**: Client Secret은 이 시점에만 표시됩니다. 반드시 즉시 복사하세요.

### 3-3. Cloudflare Pages 환경 변수 설정

1. https://dash.cloudflare.com 접속
2. **Workers & Pages** → `honeycombo` 프로젝트 클릭
3. **Settings** 탭 → **Environment variables** 섹션
4. **Production** 환경에 두 변수 추가:

| 변수 | 값 | 옵션 |
|------|-----|------|
| `GITHUB_CLIENT_ID` | `Iv1.xxxxx...` | |
| `GITHUB_CLIENT_SECRET` | `xxxxx...` | **Encrypt** 체크 |

5. **Save** 클릭

### 3-4. 재배포 트리거

환경 변수 변경 후 재배포가 필요합니다:

- 다음 `git push` 시 자동 적용됨
- 또는 Cloudflare Dashboard에서 **Deployments** → 최신 배포 → **Retry deployment** 클릭

### 3-5. CMS 접속 테스트

1. `https://honeycombo.orientpine.workers.dev/admin` 접속
2. **Login with GitHub** 클릭
3. GitHub 인증 팝업 → **Authorize** 승인
4. Decap CMS 대시보드 로드 확인
5. 큐레이션 기사 목록 표시 확인

---

## 설정 완료 체크리스트

| # | 작업 | 확인 |
|---|------|------|
| 1 | Cloudflare Pages 프로젝트 생성 | ⬜ |
| 2 | `honeycombo.orientpine.workers.dev` 접속 가능 | ⬜ |
| 3 | 모든 페이지 렌더링 확인 (홈, 기사, 트렌드, 플레이리스트, 인플루언서) | ⬜ |
| 4 | GitHub Discussions 활성화 | ⬜ |
| 5 | Giscus 앱 설치 | ⬜ |
| 6 | `repo-id`, `category-id` 코드에 반영 | ⬜ |
| 7 | 기사 상세 페이지에서 댓글 로드 확인 | ⬜ |
| 8 | GitHub OAuth App 생성 | ⬜ |
| 9 | Cloudflare Pages 환경 변수 설정 | ⬜ |
| 10 | `/admin` CMS 로그인 성공 | ⬜ |

---

## 트러블슈팅

### Cloudflare Pages 빌드 실패

- `NODE_VERSION=20` 환경 변수 추가
- 빌드 로그에서 에러 메시지 확인
- 로컬에서 `bun run build` 정상 작동 확인

### CMS 로그인 실패

- OAuth App의 callback URL이 정확한지 확인: `https://honeycombo.orientpine.workers.dev/api/auth`
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` 환경 변수가 Production에 설정되었는지 확인
- 재배포 후 시도

### Giscus 댓글 미표시

- GitHub Discussions가 활성화되었는지 확인
- Giscus 앱이 `honeycombo` 레포에 설치되었는지 확인
- `repo-id`, `category-id`가 정확한지 확인
- 브라우저 콘솔에서 에러 확인
