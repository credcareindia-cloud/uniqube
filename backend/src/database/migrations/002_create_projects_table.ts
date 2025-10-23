import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('projects', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('name').notNullable()
    table.text('description').nullable()
    table.uuid('owner_id').notNullable()
    table.enum('status', ['planning', 'active', 'on-hold', 'completed', 'cancelled']).defaultTo('planning')
    table.string('location').nullable()
    table.date('start_date').nullable()
    table.date('end_date').nullable()
    table.decimal('budget', 15, 2).nullable()
    table.integer('total_panels').defaultTo(0)
    table.integer('completed_panels').defaultTo(0)
    table.string('primary_ifc_file_id').nullable()
    table.json('metadata').nullable()
    table.timestamps(true, true)
    
    // Foreign keys
    table.foreign('owner_id').references('id').inTable('users').onDelete('CASCADE')
    
    // Indexes
    table.index(['owner_id'])
    table.index(['status'])
    table.index(['created_at'])
    table.index(['name'])
  })
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('projects')
}
