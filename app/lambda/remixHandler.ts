import cors from 'cors';
import helmet from 'helmet';
import serverlessExpress from '@vendia/serverless-express';
import express from 'express';
import { createRequestHandler } from '@remix-run/express';

const app = express();

const MODE = process.env.NODE_ENV || 'production';

app.use(cors({ origin: true, credentials: true }));
app.use(helmet());

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.all('*', (req, res, next) => {
  const build = require('../../build/server/index.js');
  return createRequestHandler({ build, mode: MODE })(req, res, next);
});

export const handler = serverlessExpress({ app });