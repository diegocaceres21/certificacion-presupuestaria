#!/usr/bin/env node
/**
 * create-admin.mjs
 *
 * Generates the SQL INSERT statements needed to add a new user to the
 * Certificación Presupuestaria database.
 *
 * Usage (interactive):
 *   node scripts/create-admin.mjs
 *
 * Usage (inline arguments):
 *   node scripts/create-admin.mjs --usuario admin2 --password secret123 \
 *     --nombre "Juan Pérez" --cargo "Director" --rol administrador
 *
 * Roles: administrador | encargado | lector
 */

import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output, argv } from 'node:process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const bcrypt = require('bcryptjs');

// ---------------------------------------------------------------------------
// Parse inline CLI arguments (--key value pairs)
// ---------------------------------------------------------------------------
function parseArgs() {
  const args = {};
  const raw = argv.slice(2);
  for (let i = 0; i < raw.length; i++) {
    if (raw[i].startsWith('--')) {
      args[raw[i].slice(2)] = raw[i + 1] ?? '';
      i++;
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Prompt helper
// ---------------------------------------------------------------------------
async function prompt(rl, question, defaultValue = '') {
  const hint = defaultValue ? ` [${defaultValue}]` : '';
  const answer = (await rl.question(`${question}${hint}: `)).trim();
  return answer || defaultValue;
}

// ---------------------------------------------------------------------------
// Password prompt (hidden via stderr trick — best effort on Windows)
// ---------------------------------------------------------------------------
async function promptPassword(rl) {
  const answer = (await rl.question('Contraseña: ')).trim();
  return answer;
}

// ---------------------------------------------------------------------------
// Generate SQL
// ---------------------------------------------------------------------------
function generateSQL({ usuario, passwordHash, nombre, cargo, rol }) {
  const userId   = randomUUID();
  const perfilId = randomUUID();
  const now      = new Date().toISOString().slice(0, 19).replace('T', ' ');

  return `-- ============================================================
-- Nuevo usuario: ${usuario}  (${rol})
-- Generado: ${now}
-- EJECUTAR EN ORDEN (usuario primero, luego perfil)
-- ============================================================

INSERT INTO \`usuario\` (\`id\`, \`usuario\`, \`password\`, \`activo\`)
VALUES (
  '${userId}',
  '${usuario}',
  '${passwordHash}',
  TRUE
);

INSERT INTO \`perfil\` (\`id\`, \`id_usuario\`, \`nombre_completo\`, \`cargo\`, \`rol\`)
VALUES (
  '${perfilId}',
  '${userId}',
  '${nombre}',
  '${cargo}',
  '${rol}'
);

-- Para verificar:
-- SELECT u.usuario, p.nombre_completo, p.cargo, p.rol, u.activo
-- FROM usuario u JOIN perfil p ON p.id_usuario = u.id
-- WHERE u.usuario = '${usuario}';
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const cliArgs = parseArgs();
  const hasInlineArgs = Object.keys(cliArgs).length > 0;

  let usuario, password, nombre, cargo, rol;

  if (hasInlineArgs) {
    usuario  = cliArgs['usuario']  ?? '';
    password = cliArgs['password'] ?? '';
    nombre   = cliArgs['nombre']   ?? '';
    cargo    = cliArgs['cargo']    ?? '';
    rol      = cliArgs['rol']      ?? 'administrador';

    if (!usuario || !password || !nombre || !cargo) {
      console.error(
        'Error: debes proporcionar --usuario, --password, --nombre y --cargo',
      );
      process.exit(1);
    }
  } else {
    // Interactive mode
    const rl = createInterface({ input, output });

    console.log('');
    console.log('=== Generador de SQL para nuevo usuario ===');
    console.log('');

    usuario  = await prompt(rl, 'Nombre de usuario (login)');
    password = await promptPassword(rl);
    nombre   = await prompt(rl, 'Nombre completo');
    cargo    = await prompt(rl, 'Cargo');
    rol      = await prompt(rl, 'Rol (administrador/encargado/lector)', 'administrador');

    rl.close();

    const VALID_ROLES = ['administrador', 'encargado', 'lector'];
    if (!VALID_ROLES.includes(rol)) {
      console.error(`Error: rol inválido "${rol}". Debe ser uno de: ${VALID_ROLES.join(', ')}`);
      process.exit(1);
    }

    if (!usuario || !password || !nombre || !cargo) {
      console.error('Error: todos los campos son obligatorios.');
      process.exit(1);
    }
  }

  // Hash with cost 12 — matches the Rust bcrypt crate default
  console.log('\nGenerando hash bcrypt (costo 12)...');
  const passwordHash = await bcrypt.hash(password, 12);

  const sql = generateSQL({ usuario, passwordHash, nombre, cargo, rol });

  console.log('\n' + '='.repeat(60));
  console.log(sql);
  console.log('='.repeat(60));
  console.log('\nCopia el SQL anterior y ejecútalo en tu base de datos MySQL.\n');
}

main().catch((err) => {
  console.error('Error inesperado:', err);
  process.exit(1);
});
