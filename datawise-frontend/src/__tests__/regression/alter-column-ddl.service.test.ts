import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {
    buildAlterColumnSql,
    buildBatchAlterColumnDdl,
    supportsAlterColumnWizard,
} from '@/features/workspace/services/alter-column-ddl.service'

describe('alter-column-ddl.service', () => {
    it('supports common JDBC dialects and rejects redis', () => {
        assert.equal(supportsAlterColumnWizard('mysql'), true)
        assert.equal(supportsAlterColumnWizard('postgresql'), true)
        assert.equal(supportsAlterColumnWizard('sqlserver'), true)
        assert.equal(supportsAlterColumnWizard('redis'), false)
        assert.equal(supportsAlterColumnWizard(undefined), false)
    })

    it('builds mysql add / modify / drop column SQL', () => {
        const add = buildAlterColumnSql('add', {
            dbType: 'mysql',
            tableName: 'orders',
            database: 'shop',
            column: {
                name: 'note',
                dataType: 'VARCHAR(64)',
                nullable: true,
                defaultValue: null,
            },
        })
        assert.equal(add, 'ALTER TABLE `shop`.`orders` ADD COLUMN `note` VARCHAR(64);')

        const modify = buildAlterColumnSql('modify', {
            dbType: 'mysql',
            tableName: 'orders',
            database: 'shop',
            column: {
                name: 'note',
                dataType: 'VARCHAR(128)',
                nullable: false,
                defaultValue: "''",
            },
        })
        assert.equal(
            modify,
            "ALTER TABLE `shop`.`orders` MODIFY COLUMN `note` VARCHAR(128) NOT NULL DEFAULT '';",
        )

        const drop = buildAlterColumnSql('drop', {
            dbType: 'mysql',
            tableName: 'orders',
            database: 'shop',
            column: {name: 'note', dataType: '', nullable: true},
        })
        assert.equal(drop, 'ALTER TABLE `shop`.`orders` DROP COLUMN `note`;')
    })

    it('builds postgresql alter as multiple statements', () => {
        const sql = buildAlterColumnSql('modify', {
            dbType: 'postgresql',
            tableName: 'orders',
            database: 'shop',
            column: {
                name: 'note',
                dataType: 'varchar(64)',
                nullable: true,
                defaultValue: null,
            },
        })
        assert.ok(sql)
        assert.match(sql!, /ALTER COLUMN "note" TYPE varchar\(64\);/)
        assert.match(sql!, /DROP NOT NULL;/)
        assert.match(sql!, /DROP DEFAULT;/)
    })

    it('returns null when required fields are missing', () => {
        assert.equal(
            buildAlterColumnSql('add', {
                dbType: 'mysql',
                tableName: 'orders',
                column: {name: '', dataType: 'INT', nullable: true},
            }),
            null,
        )
        assert.equal(
            buildAlterColumnSql('add', {
                dbType: 'mysql',
                tableName: 'orders',
                column: {name: 'id', dataType: '', nullable: true},
            }),
            null,
        )
    })

    it('builds batch drop column DDL', () => {
        const sql = buildBatchAlterColumnDdl('drop', {
            dbType: 'mysql',
            tableName: 'orders',
            database: 'shop',
            columnNames: ['note', 'legacy_flag'],
        })
        assert.equal(
            sql,
            'ALTER TABLE `shop`.`orders` DROP COLUMN `note`;\nALTER TABLE `shop`.`orders` DROP COLUMN `legacy_flag`;',
        )
        assert.equal(
            buildBatchAlterColumnDdl('drop', {
                dbType: 'mysql',
                tableName: 'orders',
                columnNames: [],
            }),
            null,
        )
    })
})
