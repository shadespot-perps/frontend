// Shim to provide a default export for `tweetnacl/nacl-fast.js`.
// Some dependencies import it as `import nacl from 'tweetnacl/nacl-fast.js'`,
// but the package doesn't expose a default export under Vite's native ESM dev server.

import * as nacl from 'tweetnacl';

export default nacl;

