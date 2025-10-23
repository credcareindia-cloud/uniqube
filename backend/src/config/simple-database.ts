import { Knex } from 'knex'
import { config } from './environment'

// Simplified Single Database Configuration (PostgreSQL Only)
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
  },
  migrations: {
    directory: './src/database/migrations',
    extension: 'ts'
  }
}

// Simple Database Manager (PostgreSQL Only)
export class SimpleDatabaseManager {
  private static instance: SimpleDatabaseManager
  public knex: Knex | null = null

  private constructor() {}

  public static getInstance(): SimpleDatabaseManager {
    if (!SimpleDatabaseManager.instance) {
      SimpleDatabaseManager.instance = new SimpleDatabaseManager()
    }
    return SimpleDatabaseManager.instance
  }

  async connect(): Promise<void> {
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

  async disconnect(): Promise<void> {
    if (this.knex) {
      await this.knex.destroy()
      this.knex = null
      console.log('🔌 Database disconnected')
    }
  }
}

export default SimpleDatabaseManager.getInstance()
