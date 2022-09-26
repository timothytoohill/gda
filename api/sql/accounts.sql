CREATE TABLE %(tableName)s ()
ALTER TABLE %(tableName)s ADD COLUMN id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
ALTER TABLE %(tableName)s ADD COLUMN seq_num BIGSERIAL
ALTER TABLE %(tableName)s ADD COLUMN name VARCHAR(200) NOT NULL
ALTER TABLE %(tableName)s ADD COLUMN data TEXT NOT NULL

CREATE INDEX graphDBAccountsSeqNumIndex ON %(tableName)s (seq_num)
CREATE INDEX graphDBAccountsNameIndex ON %(tableName)s (name)

