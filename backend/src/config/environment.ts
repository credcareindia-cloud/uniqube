import dotenv from 'dotenv'
import Joi from 'joi'

dotenv.config()

// Environment validation schema
const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),
  
  // JWT Configuration
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('24h'),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  
  // PostgreSQL Configuration
  POSTGRES_HOST: Joi.string().default('localhost'),
  POSTGRES_PORT: Joi.number().default(5432),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_DATABASE: Joi.string().required(),
  POSTGRES_SSL: Joi.boolean().default(false),
  
  // MongoDB Configuration
  MONGODB_URI: Joi.string().required(),
  
  // Redis Configuration
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional(),
  REDIS_DB: Joi.number().default(0),
  
  // AWS S3 Configuration
  AWS_ACCESS_KEY_ID: Joi.string().required(),
  AWS_SECRET_ACCESS_KEY: Joi.string().required(),
  AWS_REGION: Joi.string().default('us-east-1'),
  AWS_S3_BUCKET: Joi.string().required(),
  
  // Email Configuration
  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().required(),
  SMTP_PASSWORD: Joi.string().required(),
  FROM_EMAIL: Joi.string().email().required(),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
  
  // File Upload Limits
  MAX_FILE_SIZE: Joi.number().default(5368709120), // 5GB in bytes
  MAX_FILES_PER_UPLOAD: Joi.number().default(10),
  
  // IFC Processing
  IFC_PROCESSING_TIMEOUT: Joi.number().default(300000), // 5 minutes
  IFC_CHUNK_SIZE: Joi.number().default(1048576), // 1MB chunks
  
  // Monitoring
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  SENTRY_DSN: Joi.string().optional(),
}).unknown()

const { error, value: envVars } = envSchema.validate(process.env)

if (error) {
  throw new Error(`Config validation error: ${error.message}`)
}

export const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  
  jwt: {
    secret: envVars.JWT_SECRET,
    expiresIn: envVars.JWT_EXPIRES_IN,
    refreshSecret: envVars.JWT_REFRESH_SECRET,
    refreshExpiresIn: envVars.JWT_REFRESH_EXPIRES_IN,
  },
  
  database: {
    postgres: {
      host: envVars.POSTGRES_HOST,
      port: envVars.POSTGRES_PORT,
      user: envVars.POSTGRES_USER,
      password: envVars.POSTGRES_PASSWORD,
      database: envVars.POSTGRES_DATABASE,
      ssl: envVars.POSTGRES_SSL,
    },
    mongodb: {
      uri: envVars.MONGODB_URI,
    },
  },
  
  cache: {
    redis: {
      host: envVars.REDIS_HOST,
      port: envVars.REDIS_PORT,
      password: envVars.REDIS_PASSWORD,
      db: envVars.REDIS_DB,
    },
  },
  
  aws: {
    accessKeyId: envVars.AWS_ACCESS_KEY_ID,
    secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY,
    region: envVars.AWS_REGION,
    s3: {
      bucket: envVars.AWS_S3_BUCKET,
    },
  },
  
  email: {
    smtp: {
      host: envVars.SMTP_HOST,
      port: envVars.SMTP_PORT,
      auth: {
        user: envVars.SMTP_USER,
        pass: envVars.SMTP_PASSWORD,
      },
    },
    from: envVars.FROM_EMAIL,
  },
  
  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS,
  },
  
  upload: {
    maxFileSize: envVars.MAX_FILE_SIZE,
    maxFilesPerUpload: envVars.MAX_FILES_PER_UPLOAD,
  },
  
  ifc: {
    processingTimeout: envVars.IFC_PROCESSING_TIMEOUT,
    chunkSize: envVars.IFC_CHUNK_SIZE,
  },
  
  logging: {
    level: envVars.LOG_LEVEL,
    sentryDsn: envVars.SENTRY_DSN,
  },
}
