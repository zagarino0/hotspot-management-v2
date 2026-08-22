# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.


src/
│
├── app/
│   ├── App.tsx
│   ├── router.tsx
│   └── providers.tsx
│
├── components/
│   ├── ui/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── DashboardLayout.tsx
│   └── feedback/
│
├── pages/
│   ├── Login/
│   ├── Dashboard/
│   ├── Organizations/
│   ├── Sites/
│   ├── Routers/
│   ├── AccessPoints/
│   ├── Plans/
│   ├── Vouchers/
│   ├── Clients/
│   ├── Sessions/
│   ├── Sales/
│   ├── Payments/
│   └── Settings/
│
├── services/
│   ├── api.ts
│   ├── authApi.ts
│   ├── organizationApi.ts
│   ├── siteApi.ts
│   ├── routerApi.ts
│   ├── accessPointApi.ts
│   ├── hotspotApi.ts
│   └── billingApi.ts
│
├── hooks/
│
├── types/
│   ├── organization.ts
│   ├── site.ts
│   ├── router.ts
│   ├── hotspot.ts
│   └── billing.ts
│
├── utils/
│
├── main.tsx
└── index.css