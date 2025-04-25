import serverlessExpress from '@vendia/serverless-express';
import { createRequestHandler } from '@remix-run/express';
import express from 'express';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';

const MODE = process.env.NODE_ENV;
const BUILD_DIR = path.join(process.cwd(), 'build');

const app = express();

// Basic middleware setup
app.use(compression());
app.use(morgan('tiny'));

// Serve static files from /public
app.use(express.static('public'));

app.all(
  '*',
  createRequestHandler({
    build: require(BUILD_DIR),
    mode: MODE,
  })
);

export const handler = serverlessExpress({ app });