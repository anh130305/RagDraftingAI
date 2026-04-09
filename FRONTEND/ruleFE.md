# RuleFE - Design System va Quy Tac Dong Bo Giao Dien

Tai lieu nay la bo quy tac chuan de dong bo giao dien toan bo Frontend, trong tam la Admin page va doi chieu voi cac trang user (`Chat`, `Login`, `Register`, `Settings`).

## 1) Muc tieu he thong giao dien

- Xay dung mot visual language thong nhat: hien dai, glassmorphism nhe, do tuong phan cao, nhan manh data readability.
- Tach bach ro 2 nhom UX:
	- Admin: quan tri he thong, dashboard, du lieu, table, form cau hinh.
	- User/Auth: trai nghiem hoi thoai, onboarding, tai khoan.
- Su dung token hoa mau sac, typo, radius, border de khong hard-code style manh mun.

## 2) Nen tang token va theme

### 2.1. Nguon token

- File goc token: `src/styles/base.css`.
- Theme duoc map qua CSS variables + Tailwind theme aliases.
- 2 trang thai theme co san:
	- Light: `:root`.
	- Dark: `.dark`.

### 2.2. Quy tac dark/light mode

- Theme class duoc dat tren `document.documentElement` (html).
- Khong style theo body class rieng le.
- Ho tro 3 che do su dung:
	- `light`
	- `dark`
	- `system` (theo `prefers-color-scheme`)
- Admin dang dung default `dark`.
- Login/Register dang luu lua chon theme vao `localStorage` key `auth-theme`.

### 2.3. Bang token mau chuan

#### Light

- `--bg`: `#f9fafb`
- `--surface-low`: `#ffffff`
- `--surface`: `#ffffff`
- `--surface-high`: `#f3f4f6`
- `--surface-highest`: `#e5e7eb`
- `--on-surface`: `#111827`
- `--on-surface-variant`: `#6b7280`
- `--outline-variant`: `rgba(0, 0, 0, 0.08)`
- `--primary`: `#3b82f6`
- `--primary-container`: `#60a5fa`
- `--secondary`: `#8b5cf6`
- `--tertiary`: `#d946ef`
- `--error`: `#ef4444`

#### Dark

- `--bg`: `#0e0e0e`
- `--surface-low`: `#131313`
- `--surface`: `#1a1919`
- `--surface-high`: `#201f1f`
- `--surface-highest`: `#262626`
- `--on-surface`: `#ffffff`
- `--on-surface-variant`: `#adaaaa`
- `--outline-variant`: `rgba(255, 255, 255, 0.08)`
- `--primary`: `#85adff`
- `--primary-container`: `#6d9fff`
- `--secondary`: `#c180ff`
- `--tertiary`: `#fbb4ff`
- `--error`: `#ff716c`

### 2.4. Quy tac su dung mau

- Mau nen:
	- Man hinh tong: `bg-background`.
	- Surface card/section: `bg-surface`, `bg-surface-low`, `bg-surface-high`.
- Mau text:
	- Tieu de/noi dung chinh: `text-on-surface`.
	- Mo ta/phu tro: `text-on-surface-variant`.
- Mau nhan trang thai:
	- Chinh: `primary`.
	- Thu cap: `secondary`.
	- Nhac nhe/phu tro: `tertiary`.
	- Loi/canh bao: `error`.
- Khong dung hard-code mau ngoai he token, tru khi la block code theme den co chu dich.

## 3) Typography

### 3.1. Font family

- Font body: `Inter` (`--font-sans`, `--font-body`, `--font-label`).
- Font heading: `Manrope` (`--font-headline`).

### 3.2. Quy tac cap chu

- H1/Hero Admin: `text-4xl font-extrabold font-headline tracking-tight`.
- Tieu de section: `text-xl` hoac `text-lg`, `font-bold`, `font-headline`.
- Body chinh: `text-sm` hoac `text-base`.
- Meta/label/kicker: `text-[9px]`, `text-[10px]`, `text-xs` + `uppercase tracking-widest`.
- Monospace cho technical value: `font-mono` (thoi gian log, phan tram, API key, code).

### 3.3. Quy tac tracking va uppercase

- Tag/status/chip/label bang: uu tien `uppercase tracking-widest`.
- Khong lam dung uppercase voi text dai, chi dung cho metadata ngan.

## 4) Spacing, kich thuoc, grid, bo cuc

- Khoang cach khung chinh Admin: `p-8` cho content area.
- Grid thong dung:
	- Tong quan dashboard: `grid-cols-12 gap-6`.
	- Card nho: `grid-cols-1 md:grid-cols-3/4`.
- Sidebar Admin:
	- Co dinh trai: `fixed left-0 top-0`.
	- Chieu rong: `w-64`.
	- Main offset: `ml-64`.
- Topbar Admin:
	- Sticky tren: `sticky top-0 z-50`.
	- Chieu cao: `h-20`.
- User pages (Chat/Settings cu) dang theo side nav `w-72`; can xem xet gom ve mot he width neu muon nhat quan.

## 5) Border, radius, shadow, glass

### 5.1. Radius

- Radius co he thong:
	- Nho: `rounded-lg`
	- Vua: `rounded-xl`
	- Lon: `rounded-2xl`
	- Pill: `rounded-full`
- Uu tien `rounded-xl` cho card va input.

### 5.2. Border

- Border mac dinh: `border border-outline-variant`.
- Border nhe: `border-outline-variant/50` hoac `/10` cho layering.
- Border dashed chi dung cho dropzone upload.

### 5.3. Shadow

- Shadow data card: nhe (`shadow-sm`, `shadow-lg`) de tach lop.
- Shadow emphasis CTA: `shadow-primary/10` den `/20`.
- Glow dung co muc dich (badge live, progress, signal), khong dung tran lan.

### 5.4. Glassmorphism

- Utility da co:
	- `.glass-card`
	- `.glass-panel`
	- `.glass-morphism`
- Rule:
	- Luon di kem border subtle (`border-outline-variant`).
	- Dung cho card quan trong, overlay, floating status.
	- Khong dung cho bang data day dac de tranh giam readability.

## 6) Iconography

### 6.1. Bo icon

- Admin: `lucide-react`.
- User/Auth/Chat cu: `Material Symbols Outlined`.

### 6.2. Quy tac thong nhat de dong bo

- Neu muon dong bo toan he, uu tien 1 he icon duy nhat:
	- Lua chon khuyen nghi: chuyen user/auth/chat ve `lucide-react` de cung ecosystem voi Admin.
- Kich thuoc icon:
	- Trong button/nav: `w-4 h-4` hoac `w-5 h-5`.
	- Trong stat card: `w-6 h-6` den `w-7 h-7`.
- Icon trang thai phai co mau theo token (`primary/secondary/tertiary/error`), khong dung mau tuy y.

## 7) Motion va transition

- Thu vien: `motion/react` (framer motion style API).
- Pattern chuan:
	- Trang/module vao: `initial { opacity: 0, y: 20 } -> animate { opacity: 1, y: 0 }`.
	- Chuyen view: slide nhe ngang (`x: 10 -> 0`, exit `x: -10`).
- Transition mau/hover: `duration-200` den `duration-300`.
- Scale click CTA: `active:scale-[0.98]`.
- Khong dung animation co bien do lon gay xao nhang dashboard data.

## 8) Quy tac thanh phan (components)

### 8.1. Sidebar Admin

- Co logo area + CTA + nav chinh + profile block + logout.
- Item active:
	- Nen `bg-surface-highest`
	- Text `text-primary`
	- Font dam hon (`font-bold`)
- Item inactive: `text-on-surface-variant` + hover nen nhe.

### 8.2. Topbar Admin

- Search input dang pill, icon trai, hint shortcut ben phai.
- Theme switch dang menu dropdown 3 option Light/Dark/System.
- Notification co dot do (error) nho.

### 8.3. Card thong ke

- Cong thuc chung:
	- Card: `glass-card rounded-xl p-6`
	- Label: `text-[10px] uppercase tracking-widest`
	- Gia tri: `text-3xl/4xl font-extrabold font-headline`
	- Icon badge: nen mau token 10% + icon mau token.

### 8.4. Bang (table)

- Header row: `bg-surface-high` + uppercase 10px.
- Body row:
	- Co `divide-y divide-outline-variant`.
	- Hover row `bg-surface-highest/30`.
- Action cell:
	- Nut icon nho, hover mau theo hanh vi (`error` cho delete).
- Pagination:
	- Nam duoi card, tach bang border top.

### 8.5. Form va input

- Input/Select/Textarea:
	- Nen `bg-surface-high` hoac `bg-surface-low`.
	- `rounded-xl`
	- Focus ring theo token context (`primary`/`secondary`).
- Label truoc input:
	- Co xu huong uppercase + tracking rong + size 10px.
- Toggle switch:
	- Trang thai on: nen primary nhe + thumb primary.
	- Trang thai off: surface-highest + outline.

### 8.6. Progress, badge, status

- Progress bar:
	- Track dung surface-high/highest.
	- Fill dung token semantic.
	- Co the them glow nhe khi can nhan manh realtime.
- Badge:
	- Nen mau alpha 10% + border alpha 20% + text dam uppercase.
- Live state:
	- Dot tron nho + `animate-pulse` + shadow glow.

### 8.7. Code block tai lieu

- Nen toi rieng (`#0a0a0a`) hop ly cho code readability.
- Header code block co ten ngon ngu + action copy.

## 9) Scrollbar, accessibility, readability

- Scrollbar custom da co class `.custom-scrollbar` (4px, thumb rounded).
- Can bo sung quy tac A11y chung:
	- Dam bao contrast text/body >= muc de doc tot o ca dark va light.
	- Focus state phai ro voi keyboard navigation.
	- Input va button can co `:focus-visible` style nhat quan.
- Cursor va affordance:
	- Tat ca item clickable phai co hover/active state ro.

## 10) Responsive

- Admin hien tai manh o desktop; can mo rong rule responsive cho mobile/tablet:
	- Sidebar nen co che do collapse/drawer tren <= `lg`.
	- Bang data can fallback sang card list tren man nho.
	- Header search co the rut gon thanh icon + sheet.
- Login/Register da co split layout + fallback mobile, can giu nguyen pattern nay.

## 11) Doi chieu Admin voi User/Login/Register

### 11.1. Diem dong nhat hien co

- Dung chung token nen/text/chu de tu `base.css`.
- Dung gradient primary xanh cho CTA.
- Dung glass effect va rounded shape nhieu.

### 11.2. Diem chua dong nhat

- Pattern topbar:
	- Admin co border/day du chuc nang theme dropdown.
	- User pages dang duoc chuan hoa dan, nhung van can thong nhat hanh vi theme menu va notification theo 1 component dung chung.
- Muc do hard-code mau:
	- Da loai bo phan lon hard-code mau trong user pages.
	- Con lai 2 block code nen toi co chu dich trong tai lieu (`Documentation`) de giu do tuong phan code snippet.
- Tai su dung component:
	- Can tiep tuc trich xuat `TopBar` va `SideNav` dung chung cho nhom user/chat/settings de tranh lap JSX.

### 11.3. Quy tac bat buoc de dong bo cheo trang

- Rule 1: Moi mau su dung trong component phai uu tien token (`background/surface/on-surface/primary/...`).
- Rule 2: Chon 1 he icon duy nhat cho ca Admin + User + Auth.
- Rule 3: Chuan hoa kich thuoc sidebar (de xuat `w-64`) va pattern nav active/inactive.
- Rule 4: Chuan hoa button hierarchy:
	- Primary: gradient-primary + text sang + rounded-full.
	- Secondary: surface + border.
	- Tertiary/Ghost: text-only hoac nen trong suot.
- Rule 5: Chuan hoa form control (`rounded-xl`, focus ring token, label 10px uppercase cho setting/admin).
- Rule 6: Chuan hoa card shell (`glass-card`, border-outline-variant, shadow muc nhe).

## 12) Checklist khi tao man hinh moi

- Da dung token mau thay vi hard-code?
- Da co dark/light/system mode dung class `html`?
- Da dung font-headline cho heading va Inter cho body?
- Da dung border/radius/shadow theo pattern?
- Da co hover/focus/active state day du?
- Da co responsive cho <= `lg` va mobile?
- Da thong nhat icon set voi he thong tong?
- Da tranh visual noise (qua nhieu glow/gradient) trong man data?

## 13) Dinh huong cai tien tiep theo (de xuat)

- Trich xuat them utility component tai su dung:
	- `AppShell`
	- `PageHeader`
	- `StatCard`
	- `DataTable`
	- `FormField`
	- `StatusBadge`
- Tao file guideline ngan gon cho team:
	- "Do" va "Don't" voi screenshot mau cua Admin va User pages.
- Su dung checklist audit de review nhanh truoc merge:
	- `UI-AUDIT-CHECKLIST.md`
- Thiet lap lint rule/design token guard de canh bao khi dung mau hex hard-code.

---

Cap nhat ngay: 09/04/2026  
Pham vi phan tich: toan bo `src/AdminConsoleApp.tsx`, `src/components/*` (Admin), `src/Chat.tsx`, `src/Login.tsx`, `src/Register.tsx`, `src/Settings.tsx`, `src/styles/base.css`, `src/styles/admin.css`, `src/styles/chat-auth.css`.
