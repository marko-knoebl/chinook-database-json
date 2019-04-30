# Chinook Database JSON

The [Chinook Database](https://github.com/lerocha/chinook-database) is a sample database for a digital media store.

This repository contains the Chinook data converted to JSON.

There is a schema file under _src/schema.json_. it mostly conforms to the [Table Schema Specification](https://github.com/frictionlessdata/specs/blob/master/specs/table-schema.md) with some additions.

The data can be found in JSON files under _scr/data_; the file names correspond to table names

# Conversion to SQL code

The JSON data can be converted to SQL code

```bash
node ./scripts/createSqlFiles.js
```

Currently this will produce 2 quite similar files:

- `dist/createDbIsoAnsi.sql` - supported by _PostgreSQL_, _SQLite_
- `dist/createDbMySql.sql` - supported by _MySQL_, _SQLite_

The only difference between these two files is the former will use `TIMESTAMP` where the latter uses `DATETIME`.
