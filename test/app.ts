import express from 'express';
import APIController from '../src/routers/API-controller';

const expressApp = express();
const port = 3010;

expressApp.use(express.json());
expressApp.use('/api', APIController);

export default expressApp