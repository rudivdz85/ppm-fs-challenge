import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import type { ApiResponse, HealthCheckResponse } from '@ppm/types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  const healthResponse: HealthCheckResponse = {
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: Math.floor(process.uptime())
  };
  
  const apiResponse: ApiResponse<HealthCheckResponse> = {
    success: true,
    data: healthResponse,
    timestamp: new Date().toISOString()
  };
  
  res.status(200).json(apiResponse);
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;