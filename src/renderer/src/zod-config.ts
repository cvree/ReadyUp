import { z } from 'zod'

// zod probes `new Function` to speed up parsing. The UI's Content-Security-Policy forbids eval,
// so turn that off here rather than trigger (harmless, but noisy) CSP violations.
z.config({ jitless: true })
