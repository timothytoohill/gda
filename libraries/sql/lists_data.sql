CREATE TABLE %(tableName)s ()
ALTER TABLE %(tableName)s ADD COLUMN id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
ALTER TABLE %(tableName)s ADD COLUMN seq_num BIGSERIAL
ALTER TABLE %(tableName)s ADD COLUMN list_name VARCHAR(200) NOT NULL
ALTER TABLE %(tableName)s ADD COLUMN key VARCHAR(200) NOT NULL
ALTER TABLE %(tableName)s ADD COLUMN value TEXT

CREATE INDEX listsDataSeqNumIndex ON %(tableName)s (seq_num)
CREATE INDEX listsDataListNameIndex ON %(tableName)s (list_name)
CREATE INDEX listsDataKeyIndex ON %(tableName)s (key)

ALTER TABLE %(tableName)s ADD CONSTRAINT lists_data_list_name_and_key_unique UNIQUE (list_name, key)


