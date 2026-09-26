import { z } from 'zod';

const originList = z
  .string()
  .min(1)
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  )
  .pipe(z.array(z.url({ protocol: /^https?$/ })).min(1));

const port = z.coerce.number().int().min(1024).max(65535);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    CLIENT_URL: originList,
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    // Token para GET /metrics; sem ele, o endpoint não existe
    METRICS_TOKEN: z.string().min(16).optional(),
    // Segundos que uma sala pode ficar vazia antes de ser excluída (10 minutos por padrão)
    ROOM_EMPTY_TIMEOUT: z.coerce.number().int().min(10).max(86_400).default(600),
    // mediasoup: IP onde o servidor escuta e IP que os navegadores usam para chegar até ele
    MEDIASOUP_LISTEN_IP: z.union([z.ipv4(), z.ipv6()]).default('0.0.0.0'),
    MEDIASOUP_ANNOUNCED_IP: z.string().trim().min(1).optional(),
    MEDIASOUP_MIN_PORT: port.default(40000),
    MEDIASOUP_MAX_PORT: port.default(40000),
  })
  .refine((env) => env.MEDIASOUP_MIN_PORT <= env.MEDIASOUP_MAX_PORT, {
    message: 'MEDIASOUP_MIN_PORT não pode ser maior que MEDIASOUP_MAX_PORT',
    path: ['MEDIASOUP_MAX_PORT'],
  })
  .refine((env) => !['0.0.0.0', '::'].includes(env.MEDIASOUP_LISTEN_IP) || env.MEDIASOUP_ANNOUNCED_IP, {
    message: 'Com MEDIASOUP_LISTEN_IP em todas as interfaces, defina MEDIASOUP_ANNOUNCED_IP com o IP público',
    path: ['MEDIASOUP_ANNOUNCED_IP'],
  });

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('[CONFIG] Variáveis de ambiente inválidas:');
    console.error(z.prettifyError(result.error));
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv();