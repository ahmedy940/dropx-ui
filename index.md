.
├── allfiles.txt
├── app
│   ├── db
│   │   ├── activityLog.db.ts
│   │   ├── config.ts
│   │   ├── errors.ts
│   │   ├── index.ts
│   │   ├── prisma.ts
│   │   ├── session.db.ts
│   │   └── shop.db.ts
│   ├── entry.server.tsx
│   ├── globals.d.ts
│   ├── lambda
│   │   ├── auth
│   │   │   ├── callback
│   │   │   │   ├── buildRedirectUrl.ts
│   │   │   │   ├── exchangeCodeForToken.ts
│   │   │   │   ├── fetchShopDetails.ts
│   │   │   │   ├── upsertSopInDB.ts
│   │   │   │   └── validateCallbackQuery.ts
│   │   │   ├── exchangeShopifyToken.ts
│   │   │   ├── fetchShopInfo.ts
│   │   │   ├── handleCallback.ts
│   │   │   ├── handleInstall.ts
│   │   │   ├── orgAuth.ts
│   │   │   ├── processShopInstall.ts
│   │   │   └── utils
│   │   ├── lambda-auth-router.ts
│   │   ├── lambda-check-merchant.ts
│   │   ├── lambda-check-org-customer.ts
│   │   ├── lambda-create-org-customer.ts
│   │   ├── lambda-post-install.ts
│   │   ├── lambda-proxy.ts
│   │   ├── lambda-shopify-auth.ts
│   │   ├── lambda-shopify-graphql.ts
│   │   ├── lambda-shopify-product.ts
│   │   ├── lambda.handler.ts
│   │   ├── remixHandler.ts
│   │   ├── services
│   │   │   ├── merchant.service.ts
│   │   │   ├── shopify-org.service.ts
│   │   │   └── syncTrigger.service.ts
│   │   ├── utils
│   │   │   ├── db.server.ts
│   │   │   ├── handleMerchantRouting.ts
│   │   │   ├── queryString.ts
│   │   │   ├── redirectWithError.ts
│   │   │   ├── stateStore.ts
│   │   │   ├── validateInstallQuery.ts
│   │   │   ├── verifyOAuthRequest.ts
│   │   │   └── verifyWebhook.ts
│   │   └── webhook
│   │       ├── webhook-handler.ts
│   │       └── webhook-product.ts
│   ├── root.tsx
│   ├── routes
│   │   ├── app-installed.tsx
│   │   ├── dashboard.tsx
│   │   ├── error.tsx
│   │   ├── loading.tsx
│   │   ├── post-install.tsx
│   │   ├── register-redirect.tsx
│   │   ├── register-success.tsx
│   │   └── sync-status.tsx
│   ├── routes.ts
│   ├── server.lambda.ts
│   ├── types
│   │   └── lru-cache.d.ts
│   └── utils
│       ├── env.ts
│       ├── getSSMParam.ts
│       └── logger.ts
├── CHANGELOG.md
├── config
│   ├── config.js
│   └── server.ts
├── dev.sqlite
├── Dockerfile
├── env.d.ts
├── extensions
├── function.zip
├── index.md
├── lambda-deployment.zip
├── migrations
├── models
│   └── index.js
├── package-lock.json
├── package.json
├── prisma
│   ├── dev.sqlite
│   ├── dev.sqlite-journal
│   ├── migrations
│   │   ├── 20250330034812_new
│   │   │   └── migration.sql
│   │   └── migration_lock.toml
│   └── schema.prisma
├── public
│   └── favicon.ico
├── README.md
├── remix.config.cjs
├── seeders
├── serverless.yml
├── shopify.app.toml
├── shopify.web.toml
├── ssm-params.json
├── test-db.js
├── tsconfig.json
├── vercel.json
└── vite.config.ts

22 directories, 88 files

