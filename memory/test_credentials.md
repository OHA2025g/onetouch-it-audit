# Test Credentials — One Touch IT Audit AI

## Admin (full access — recommended for testing)
- Email: `admin@auditai.com`
- Password: `Admin@123`
- Role: Admin

## Other roles (all share password `Welcome@123`)
- `rohan.mehta@auditai.com` — CIO
- `priya.iyer@auditai.com` — CISO
- `vikram.shetty@auditai.com` — IT_Head
- `karan.malhotra@auditai.com` — Auditor
- `neha.b@auditai.com` — Compliance_Officer
- `suresh.pillai@auditai.com` — Board_Viewer
- `ananya.reddy@auditai.com` — App_Owner

## API base
- `${REACT_APP_BACKEND_URL}/api`
- POST `/api/auth/login` with `{email, password}` returns `{access_token, user}`
- Pass `Authorization: Bearer <token>` on all subsequent requests
