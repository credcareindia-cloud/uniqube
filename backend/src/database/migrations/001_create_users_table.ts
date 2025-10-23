import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('email').unique().notNullable()
    table.string('password_hash').notNullable()
    table.string('name').notNullable()
    table.string('phone').nullable()
    table.string('location').nullable()
    table.string('company').nullable()
    table.enum('role', ['admin', 'manager', 'user']).defaultTo('user')
    table.enum('status', ['active', 'inactive', 'suspended']).defaultTo('active')
    table.string('avatar_url').nullable()
    table.timestamp('last_login').nullable()
    table.timestamp('email_verified_at').nullable()
    table.string('reset_password_token').nullable()
    table.timestamp('reset_password_expires').nullable()
    table.timestamps(true, true)
    
    // Indexes
    table.index(['email'])
    table.index(['role'])
    table.index(['status'])
    table.index(['created_at'])
  })
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('users')
}
