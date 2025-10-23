import { Knex } from 'knex'
import mongoose from 'mongoose'
import Redis from 'ioredis'
import { config } from './environment'

// PostgreSQL Configuration
export const knexConfig: Knex.Config = {
  client: 'postgresql',
  connection: {
    host: config.database.postgres.host,
    port: config.database.postgres.port,
    user: config.database.postgres.user,
    password: config.database.postgres.password,
    database: config.database.postgres.database,
    ssl: config.database.postgres.ssl ? { rejectUnauthorized: false } : false
  },
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 100,
  },
  migrations: {
    directory: './src/database/migrations',
    extension: 'ts'
  },
  seeds: {
    directory: './src/database/seeds',
    extension: 'ts'
  }
}

// MongoDB Configuration
export const mongoConfig = {
  uri: config.database.mongodb.uri,
  options: {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    bufferCommands: false,
    bufferMaxEntries: 0
  }
}

// Redis Configuration
export const redisConfig = {
  host: config.cache.redis.host,
  port: config.cache.redis.port,
  password: config.cache.redis.password,
  db: config.cache.redis.db,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
}

// Database Connection Classes
export class DatabaseManager {
  private static instance: DatabaseManager
  public knex: Knex | null = null
  public mongoose: typeof mongoose | null = null
  public redis: Redis | null = null

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager()
    }
    return DatabaseManager.instance
  }

  async connectPostgreSQL(): Promise<void> {
    try {
      const knex = require('knex')(knexConfig)
      await knex.raw('SELECT 1')
      this.knex = knex
      console.log('✅ PostgreSQL connected successfully')
    } catch (error) {
      console.error('❌ PostgreSQL connection failed:', error)
      throw error
    }
  }

  async connectMongoDB(): Promise<void> {
    try {
      await mongoose.connect(mongoConfig.uri, mongoConfig.options)
      this.mongoose = mongoose
      console.log('✅ MongoDB connected successfully')
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error)
      throw error
    }
  }

  async connectRedis(): Promise<void> {
    try {
      this.redis = new Redis(redisConfig)
      
      this.redis.on('connect', () => {
        console.log('✅ Redis connected successfully')
      })

      this.redis.on('error', (error) => {
        console.error('❌ Redis connection error:', error)
      })

      await this.redis.ping()
    } catch (error) {
      console.error('❌ Redis connection failed:', error)
      throw error
    }
  }

  async connectAll(): Promise<void> {
    await Promise.all([
      this.connectPostgreSQL(),
      this.connectMongoDB(),
      this.connectRedis()
    ])
  }

  async disconnect(): Promise<void> {
    if (this.knex) {
      await this.knex.destroy()
      this.knex = null
    }

    if (this.mongoose) {
      await mongoose.disconnect()
      this.mongoose = null
    }

    if (this.redis) {
      this.redis.disconnect()
      this.redis = null
    }

    console.log('🔌 All databases disconnected')
  }
}

export default DatabaseManager.getInstance()
