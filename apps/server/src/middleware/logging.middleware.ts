import morgan from 'morgan';
import logger from '../utils/logger';

const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

export const requestLogger = morgan(
  ':method :url :status :response-time ms - :res[content-length]',
  { 
    stream,
    skip: (req, res) => {
      return process.env.NODE_ENV === 'test';
    }
  }
);

export default requestLogger;