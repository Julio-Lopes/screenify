/** Estado do servidor para acompanhar a saúde em produção (GET /metrics) */
export interface ServerMetrics {
  uptimeSeconds: number;
  rooms: {
    /** Salas com pelo menos uma pessoa conectada agora */
    active: number;
    participants: number;
  };
  media: {
    routers: number;
    transports: number;
    producers: number;
    consumers: number;
  };
  workers: {
    pid: number;
    /** Tempo de CPU usado desde que o worker subiu (usuário + sistema) */
    cpuSeconds: number;
    /** Pico de memória do processo do worker */
    maxMemoryMb: number;
  }[];
  process: {
    memoryMb: number;
  };
}