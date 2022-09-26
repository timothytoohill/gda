CREATE TABLE %(tableName)s ()
ALTER TABLE %(tableName)s ADD COLUMN id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
ALTER TABLE %(tableName)s ADD COLUMN seq_num BIGSERIAL
ALTER TABLE %(tableName)s ADD COLUMN name VARCHAR(200) NOT NULL

CREATE INDEX listsSeqNumIndex ON %(tableName)s (seq_num)
CREATE INDEX listsNameIndex ON %(tableName)s (name)

ALTER TABLE %(tableName)s ADD CONSTRAINT lists_name_unique UNIQUE (name)


