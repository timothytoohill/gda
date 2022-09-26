CREATE TABLE %(tableName)s ()
ALTER TABLE %(tableName)s ADD COLUMN id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
ALTER TABLE %(tableName)s ADD COLUMN seq_num BIGSERIAL
ALTER TABLE %(tableName)s ADD COLUMN name VARCHAR(200) NOT NULL
ALTER TABLE %(tableName)s ADD COLUMN list_name VARCHAR(200) NOT NULL
ALTER TABLE %(tableName)s ADD COLUMN list_seq_num BIGINT DEFAULT 0

CREATE INDEX listsSubscribersNameIndex ON %(tableName)s (name)
CREATE INDEX listsSubscribersListNameIndex ON %(tableName)s (list_name)

ALTER TABLE %(tableName)s ADD CONSTRAINT lists_subscribers_name_and_list_name_unique UNIQUE (name, list_name)