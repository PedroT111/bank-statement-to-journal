const { neon } = require('@neondatabase/serverless');

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL_UNPOOLED;

const STATE_ID = 'asientos_coop';

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS app_state (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

function checkPassword(req) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return true;
  const provided = req.headers['x-app-password'];
  return provided === expected;
}

module.exports = async (req, res) => {
  if (!connectionString) {
    res.status(500).json({ error: 'DATABASE_URL no configurada en Vercel. Instalá la integración de Neon Postgres desde el Marketplace.' });
    return;
  }
  const sql = neon(connectionString);

  try {
    await ensureTable(sql);

    if (req.method === 'GET') {
      if (!checkPassword(req)) { res.status(401).json({ error: 'Contraseña incorrecta.' }); return; }
      const rows = await sql`SELECT data, updated_at FROM app_state WHERE id = ${STATE_ID}`;
      if (rows.length === 0) { res.status(200).json({ data: null, updated_at: null }); return; }
      res.status(200).json({ data: rows[0].data, updated_at: rows[0].updated_at });
      return;
    }

    if (req.method === 'POST') {
      if (!checkPassword(req)) { res.status(401).json({ error: 'Contraseña incorrecta.' }); return; }
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
      if (!body || !body.data) { res.status(400).json({ error: 'Falta el campo "data" en el cuerpo de la petición.' }); return; }
      await sql`
        INSERT INTO app_state (id, data, updated_at)
        VALUES (${STATE_ID}, ${JSON.stringify(body.data)}::jsonb, now())
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
      `;
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error de servidor: ' + err.message });
  }
};
