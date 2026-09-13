"""Verify the repository SQL against isolated PostgreSQL on 55432; rolls back fixtures."""
from pathlib import Path
import subprocess
source = (Path(__file__).parents[1] / 'src/main/java/com/fixflow/incident/IncidentRepository.java').read_text()
query = source.split('WITH terms AS (', 1)[1].split('"""', 1)[0]
query = ('WITH terms AS (' + query).replace(':id', '1').replace(':technician', "'tech'")
sql = """BEGIN;
CREATE TEMP TABLE incidents (id bigint, description text, cause text, resolution text, status text, assigned_technician text, resolved_at timestamptz);
INSERT INTO incidents VALUES
(1,'Projector disconnected',NULL,NULL,'OPEN','tech',NULL),
(2,'Projector disconnecting','Loose cable','Reconnected','RESOLVED','tech',now()),
(3,'Projector disconnected','Secret','Other technician','RESOLVED','other',now()),
(4,'Projector disconnected','Cable','Pending','IN_PROGRESS','tech',now()),
(5,'Projector disconnected',NULL,NULL,'RESOLVED','tech',now()),
(6,'Tap leaking','Washer','Replaced','RESOLVED','tech',now());
CREATE TEMP VIEW matches AS """ + query + ";" + """
DO $$ BEGIN
 IF (SELECT array_agg(id) FROM matches) IS DISTINCT FROM ARRAY[2::bigint] THEN RAISE EXCEPTION 'Wrong matches'; END IF;
END $$;
UPDATE incidents SET assigned_technician='other' WHERE id=1;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM matches) THEN RAISE EXCEPTION 'Source access leaked'; END IF; END $$;
UPDATE incidents SET assigned_technician='tech', description='the and it' WHERE id=1;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM matches) THEN RAISE EXCEPTION 'Stopwords matched'; END IF; END $$;
ROLLBACK;
"""
subprocess.run([r'C:\Program Files\PostgreSQL\18\bin\psql.exe','-X','-w','-h','127.0.0.1','-p','55432','-U','fixflow_test','-d','postgres','-v','ON_ERROR_STOP=1'], input=sql, text=True, check=True)
print('Similar-fix matching and assignment isolation passed.')
