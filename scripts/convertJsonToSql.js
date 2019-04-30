const fs = require('fs');

const convertJsonToIsoAnsiSql = () => {
  convertJsonToSql({ outPath: 'dist/createDbIsoAnsiSql.sql' });
};

const convertJsonToMySql = () => {
  convertJsonToSql({ useDatetime: true, outPath: 'dist/createDbMySql.sql' });
};

const convertJsonToSql = ({
  useNvarchar = false,
  useDatetime = false,
  outPath = 'dist/createDbIsoAnsiSql.sql'
}) => {
  let sqlCommands = '';

  const schemaString = fs.readFileSync('src/schema.json', 'utf8');
  const schema = JSON.parse(schemaString);

  // drop old tables
  const dropTableCommands = generateDropTableCommands(schema);

  // create tables
  const createTableCommands = generateCreateTableCommands(schema, {
    useNvarchar,
    useDatetime
  });

  // create indexes
  const createIndexesCommands = generateCreateIndexesCommands(schema);

  // enter data
  const enterDataCommands = generateEnterDataCommands(schema);

  sqlCommands += dropTableCommands.join('');
  sqlCommands += '\n';
  sqlCommands += createTableCommands.join('\n');
  sqlCommands += '\n';
  for (let createIndexesCommandGroup of createIndexesCommands) {
    sqlCommands += createIndexesCommandGroup.join('');
    sqlCommands += '\n';
  }
  sqlCommands += '\n';
  for (let enterDataCommandGroup of enterDataCommands) {
    sqlCommands += enterDataCommandGroup.join('');
    sqlCommands += '\n';
  }

  // TODO: ensure dist exists
  fs.writeFileSync(outPath, sqlCommands);
};

/* Dialects: iso_ansi, mysql
  example: {
    type: 'string',
    constraints: {maxLength: 60, required: true},
    sqlDialect: 'iso_ansi/postgresql'
  }
  => "VARCHAR(60) NOT NULL"
*/
const tableSchemaTypeToSqlType = ({
  type,
  constraints = {},
  useNvarchar = false,
  useDatetime = false
}) => {
  let baseType;
  if (type === 'string') {
    let baseTypeStart = useNvarchar ? 'NVARCHAR' : 'VARCHAR';
    baseType = `${baseTypeStart}(${constraints.maxLength})`;
  } else if (type === 'integer') {
    baseType = 'INT';
  } else if (type.slice(0, 8) === 'decimal(') {
    baseType = type.toUpperCase();
  } else if (type === 'datetime') {
    baseType = useDatetime ? 'DATETIME' : 'TIMESTAMP';
  } else {
    throw new Error(`type ${type} not supported`);
  }

  if (constraints && constraints.required) {
    return `${baseType} NOT NULL`;
  }
  return baseType;
};

const generateDropTableCommands = schema => {
  const reversedSchema = schema.slice();
  reversedSchema.reverse();
  return reversedSchema.map(table => `DROP TABLE IF EXISTS ${table.name};\n`);
};

const generateCreateTableCommands = (dbSchema, { useNvarchar, useDatetime }) =>
  dbSchema.map(table => {
    const fieldDefinitionLines = table.schema.fields.map(field => {
      const sqlType = tableSchemaTypeToSqlType({
        type: field.type,
        constraints: field.constraints,
        useNvarchar,
        useDatetime
      });
      return `  ${field.name} ${sqlType}`;
    });

    let tableDefinitionLines = fieldDefinitionLines.slice();

    // add primary key (if it exists)
    const primaryKey = table.schema.primaryKey;
    if (typeof primaryKey === 'string') {
      tableDefinitionLines.push(
        `  CONSTRAINT PK_${primaryKey} PRIMARY KEY (${primaryKey})`
      );
    } else if (Array.isArray(primaryKey)) {
      tableDefinitionLines.push(
        `  CONSTRAINT PK_${table.name} PRIMARY KEY(${primaryKey.join(', ')})`
      );
    }

    // add any foreign keys
    let foreignKeyLines = [];
    if (table.schema.foreignKeys) {
      foreignKeyLines = table.schema.foreignKeys.map(
        foreignKey =>
          `  CONSTRAINT FK_${foreignKey.name} FOREIGN KEY (${foreignKey.fields})
  REFERENCES ${foreignKey.reference.resource}(${foreignKey.reference.fields})`
      );
    }

    tableDefinitionLines = tableDefinitionLines.concat(foreignKeyLines);

    let command = `CREATE TABLE ${table.name} (\n`;
    command += tableDefinitionLines.join(',\n');
    command += '\n);\n';
    return command;
  });

const generateCreateIndexesCommands = dbSchema =>
  dbSchema
    .filter(table => table.schema.foreignKeys)
    .map(table =>
      table.schema.foreignKeys.map(
        foreignKey =>
          `CREATE INDEX IFK_${foreignKey.name} ON ${table.name}(${
            foreignKey.fields
          });\n`
      )
    );

const generateEnterDataCommands = (dbSchema, tableData) =>
  dbSchema.map(table => {
    const tableData = JSON.parse(
      fs.readFileSync(`src/data/${table.name}.json`)
    );

    const enterDataCommands = tableData.map(row => {
      const fieldNames = table.schema.fields.map(field => field.name);

      const fieldValueStrings = table.schema.fields.map(field => {
        const value = row[field.name];
        if (value === null) {
          if (field.constraints && field.constraints.required) {
            throw new Error('null value in not-null column');
          }
          return 'NULL';
        } else if (field.type === 'string') {
          return `'${value.replace(/'/g, "''")}'`;
        } else if (field.type === 'integer') {
          return String(value);
        } else if (field.type === 'number') {
          return String(value);
        } else if (field.type.slice(0, 8) === 'decimal(') {
          // TODO: format number properly
          return String(value);
        } else if (field.type === 'datetime') {
          return `'${value}'`;
        } else {
          throw new Error(`invalid type: ${field.type}`);
        }
      });

      const enterDataCommand = `INSERT INTO ${table.name} (${fieldNames.join(
        ', '
      )}) VALUES (${fieldValueStrings.join(', ')});\n`;
      return enterDataCommand;
    });
    return enterDataCommands;
  });

module.exports = {
  convertJsonToSql,
  convertJsonToIsoAnsiSql,
  convertJsonToMySql
};
